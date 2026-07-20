use super::super::prelude::*;
use super::super::*;

const PROFILE_UPDATER_POLL_INTERVAL: Duration = Duration::from_secs(60);
const PROFILE_UPDATER_INITIAL_DELAY: Duration = Duration::from_secs(10);
const MILLIS_PER_MINUTE: u64 = 60_000;

struct ProfileUpdateAttempt {
    signature: String,
    attempted_at: u64,
}

fn shutdown_requested(receiver: &mpsc::Receiver<()>, timeout: Duration) -> bool {
    !matches!(
        receiver.recv_timeout(timeout),
        Err(mpsc::RecvTimeoutError::Timeout)
    )
}

pub(crate) fn is_profile_auto_update_enabled(item: &ProfileItemData) -> bool {
    item.item_type == "remote"
        && item.interval.is_some_and(|interval| interval > 0)
        && item.auto_update.unwrap_or(true)
}

pub(crate) fn profile_update_delay_ms(
    item: &ProfileItemData,
    now: u64,
    last_attempt_at: Option<u64>,
) -> Option<u64> {
    if !is_profile_auto_update_enabled(item) {
        return None;
    }

    let interval_ms = item.interval?.saturating_mul(MILLIS_PER_MINUTE);
    let reference_time = item.updated.unwrap_or(0).max(last_attempt_at.unwrap_or(0));
    Some(interval_ms.saturating_sub(now.saturating_sub(reference_time)))
}

fn profile_update_signature(item: &ProfileItemData) -> String {
    serde_json::to_string(item).unwrap_or_else(|_| item.id.clone())
}

pub(crate) fn profile_matches_update_attempt(
    item: &ProfileItemData,
    expected_signature: &str,
) -> bool {
    is_profile_auto_update_enabled(item) && profile_update_signature(item) == expected_signature
}

fn refresh_profile(
    app: &tauri::AppHandle,
    id: &str,
    expected_signature: &str,
) -> Result<Option<bool>, String> {
    let config = read_profile_config(app)?;
    let item = get_profile_item_from_config(&config, Some(id))
        .ok_or_else(|| "Profile not found".to_string())?;
    if !profile_matches_update_attempt(&item, expected_signature) {
        return Ok(None);
    }

    let url = item
        .url
        .as_deref()
        .ok_or_else(|| "远程配置缺少 URL".to_string())?;
    let content = fetch_remote_text(
        app,
        url,
        RemoteFetchOptions {
            user_agent: item.ua.as_deref(),
            use_proxy: item.use_proxy.unwrap_or(false),
        },
    )?;
    if item.verify.unwrap_or(false) {
        parse_profile_yaml_value(&content)?;
    }

    let mut latest_config = read_profile_config(app)?;
    let Some(index) = latest_config.items.iter().position(|value| value.id == id) else {
        return Ok(None);
    };
    if !profile_matches_update_attempt(&latest_config.items[index], expected_signature) {
        return Ok(None);
    }

    let runtime_profile_affected = profile_affects_runtime(&latest_config, id);
    write_profile_text(app, id, &content)?;
    latest_config.items[index].updated = Some(current_timestamp_ms());
    write_profile_config(app, &latest_config)?;
    Ok(Some(runtime_profile_affected))
}

fn run_profile_update_tick(
    app: &tauri::AppHandle,
    attempts: &mut HashMap<String, ProfileUpdateAttempt>,
) -> Result<(), String> {
    let config = read_profile_config(app)?;
    let known_ids = config
        .items
        .iter()
        .map(|item| item.id.clone())
        .collect::<HashSet<_>>();
    attempts.retain(|id, _| known_ids.contains(id));
    let mut any_profile_updated = false;
    let mut runtime_profile_affected = false;

    for item in config.items {
        if !is_profile_auto_update_enabled(&item) {
            attempts.remove(&item.id);
            continue;
        }

        let signature = profile_update_signature(&item);
        let last_attempt_at = attempts
            .get(&item.id)
            .filter(|attempt| attempt.signature == signature)
            .map(|attempt| attempt.attempted_at);
        let now = current_timestamp_ms();
        if profile_update_delay_ms(&item, now, last_attempt_at) != Some(0) {
            continue;
        }

        attempts.insert(
            item.id.clone(),
            ProfileUpdateAttempt {
                signature: signature.clone(),
                attempted_at: now,
            },
        );

        match refresh_profile(app, &item.id, &signature) {
            Ok(Some(affects_runtime)) => {
                any_profile_updated = true;
                runtime_profile_affected |= affects_runtime;
            }
            Ok(None) => {}
            Err(_) => {
                eprintln!("scheduled profile update failed for {}", item.id);
            }
        }
    }

    let state = app.state::<CoreState>();
    if state.shutdown_started.load(AtomicOrdering::SeqCst) {
        return Ok(());
    }

    if any_profile_updated {
        emit_ipc_event(app, "profileConfigUpdated", Value::Null);
        emit_ipc_event(app, "rulesUpdated", Value::Null);
    }
    if runtime_profile_affected {
        if let Err(error) = restart_core_and_emit(app, &state) {
            eprintln!("scheduled profile core restart failed: {error}");
        }
    }

    Ok(())
}

pub(crate) fn start_profile_updater(app: &tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<CoreState>();
    let mut handle = state.profile_updater.lock().map_err(|e| e.to_string())?;
    if handle.is_some() {
        return Ok(());
    }

    let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>();
    let app_handle = app.clone();
    thread::spawn(move || {
        let mut attempts = HashMap::new();
        if shutdown_requested(&shutdown_rx, PROFILE_UPDATER_INITIAL_DELAY) {
            return;
        }
        loop {
            if let Err(error) = run_profile_update_tick(&app_handle, &mut attempts) {
                eprintln!("scheduled profile update tick failed: {error}");
            }
            if shutdown_requested(&shutdown_rx, PROFILE_UPDATER_POLL_INTERVAL) {
                break;
            }
        }
    });

    *handle = Some(ProfileUpdaterHandle {
        shutdown: shutdown_tx,
    });
    Ok(())
}

pub(crate) fn stop_profile_updater(state: &State<'_, CoreState>) -> Result<(), String> {
    let mut handle = state.profile_updater.lock().map_err(|e| e.to_string())?;
    if let Some(handle) = handle.take() {
        let _ = handle.shutdown.send(());
    }
    Ok(())
}
