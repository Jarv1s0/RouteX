use super::prelude::*;
use super::*;

pub(crate) fn read_value_store(
    app: &tauri::AppHandle,
    file_name: &str,
    default: Value,
) -> Result<Value, String> {
    let path = storage_file(app, file_name)?;
    Ok(read_json_file(&path)?.unwrap_or(default))
}

pub(crate) fn write_value_store(
    app: &tauri::AppHandle,
    file_name: &str,
    value: &Value,
) -> Result<(), String> {
    let path = storage_file(app, file_name)?;
    write_json_file(&path, value)
}

pub(crate) fn read_traffic_stats_store(
    app: &tauri::AppHandle,
) -> Result<TrafficStatsStore, String> {
    let path = storage_file(app, TRAFFIC_STATS_FILE)?;
    let state = app.state::<CoreState>();
    let mut buffer = state.traffic_stats.lock().map_err(|e| e.to_string())?;
    Ok(buffer.load(&path)?.clone())
}

#[derive(Default)]
pub(crate) struct TrafficStatsBuffer {
    stats: Option<TrafficStatsStore>,
    dirty: bool,
    last_write: Option<Instant>,
}

impl TrafficStatsBuffer {
    pub(crate) fn load(&mut self, path: &Path) -> Result<&mut TrafficStatsStore, String> {
        if self.stats.is_none() {
            self.stats = Some(read_json_file(path)?.unwrap_or_default());
        }
        Ok(self.stats.as_mut().expect("traffic stats loaded"))
    }

    pub(crate) fn record(
        &mut self,
        path: &Path,
        upload: u64,
        download: u64,
        now: OffsetDateTime,
    ) -> Result<(u64, u64), String> {
        let stats = self.load(path)?;
        if upload > 0 || download > 0 {
            let date = format!(
                "{:04}-{:02}-{:02}",
                now.year(),
                u8::from(now.month()),
                now.day()
            );
            let hour = format!("{date}-{:02}", now.hour());
            accumulate_hourly_traffic_record(&mut stats.hourly, &hour, upload, download);
            accumulate_daily_traffic_record(&mut stats.daily, &date, upload, download);
            stats.session_upload += upload;
            stats.session_download += download;
            stats.last_update = (now.unix_timestamp_nanos() / 1_000_000).max(0) as u64;
        }
        let totals = (stats.session_upload, stats.session_download);
        self.dirty |= upload > 0 || download > 0;
        Ok(totals)
    }

    pub(crate) fn flush(&mut self, path: &Path, force: bool) -> Result<(), String> {
        if self.dirty
            && (force
                || self
                    .last_write
                    .is_none_or(|at| at.elapsed() >= Duration::from_secs(5)))
        {
            if let Some(stats) = &self.stats {
                write_json_file(path, stats)?;
            }
            self.dirty = false;
            self.last_write = Some(Instant::now());
        }
        Ok(())
    }
}

pub(crate) fn flush_traffic_stats(app: &tauri::AppHandle) -> Result<(), String> {
    let path = storage_file(app, TRAFFIC_STATS_FILE)?;
    app.state::<CoreState>()
        .traffic_stats
        .lock()
        .map_err(|e| e.to_string())?
        .flush(&path, true)
}

pub(crate) fn initialize_traffic_stats_store(app: &tauri::AppHandle) -> Result<(), String> {
    let path = storage_file(app, TRAFFIC_STATS_FILE)?;
    let state = app.state::<CoreState>();
    let mut buffer = state.traffic_stats.lock().map_err(|e| e.to_string())?;
    let stats = buffer.load(&path)?;
    stats.session_upload = 0;
    stats.session_download = 0;
    stats.last_update = current_timestamp_ms();
    buffer.dirty = true;
    buffer.flush(&path, true)
}

pub(crate) fn trim_recent_records<T>(records: &mut Vec<T>, max_len: usize) {
    if records.len() > max_len {
        let keep_from = records.len().saturating_sub(max_len);
        records.drain(0..keep_from);
    }
}

pub(crate) fn accumulate_hourly_traffic_record(
    records: &mut Vec<TrafficHourlyStats>,
    hour_key: &str,
    upload: u64,
    download: u64,
) {
    if let Some(record) = records.iter_mut().find(|item| item.hour == hour_key) {
        record.upload += upload;
        record.download += download;
        return;
    }

    records.push(TrafficHourlyStats {
        hour: hour_key.to_string(),
        upload,
        download,
    });
    trim_recent_records(records, MAX_TRAFFIC_HOURLY_RECORDS);
}

pub(crate) fn accumulate_daily_traffic_record(
    records: &mut Vec<TrafficDailyStats>,
    date_key: &str,
    upload: u64,
    download: u64,
) {
    if let Some(record) = records.iter_mut().find(|item| item.date == date_key) {
        record.upload += upload;
        record.download += download;
        return;
    }

    records.push(TrafficDailyStats {
        date: date_key.to_string(),
        upload,
        download,
    });
    trim_recent_records(records, MAX_TRAFFIC_DAILY_RECORDS);
}

pub(crate) fn clear_traffic_stats_store(app: &tauri::AppHandle) -> Result<(), String> {
    let path = storage_file(app, TRAFFIC_STATS_FILE)?;
    let state = app.state::<CoreState>();
    let mut buffer = state.traffic_stats.lock().map_err(|e| e.to_string())?;
    let stats = TrafficStatsStore::default();
    write_json_file(&path, &stats)?;
    buffer.stats = Some(stats);
    buffer.dirty = false;
    buffer.last_write = Some(Instant::now());
    Ok(())
}

pub(crate) fn read_app_config_store(app: &tauri::AppHandle) -> Result<Value, String> {
    read_value_store(app, APP_CONFIG_FILE, json!({}))
}

pub(crate) fn patch_app_config_store(
    app: &tauri::AppHandle,
    patch: &Value,
) -> Result<Value, String> {
    let state = app.state::<CoreState>();
    let _guard = state.config_write_lock.lock().map_err(|e| e.to_string())?;
    let mut value = read_app_config_store(app)?;
    let previous = value.clone();
    merge_json(&mut value, patch);
    write_value_store(app, APP_CONFIG_FILE, &value)?;
    if app_config_changes_runtime(&previous, &value) {
        invalidate_profile_runtime_config_cache();
    }
    Ok(value)
}

pub(crate) fn app_config_changes_runtime(previous: &Value, next: &Value) -> bool {
    ["controlDns", "controlSniff"].iter().any(|key| {
        previous.get(*key).and_then(Value::as_bool).unwrap_or(true)
            != next.get(*key).and_then(Value::as_bool).unwrap_or(true)
    })
}

pub(crate) fn patch_requires_shell_surface_sync(patch: &Value) -> bool {
    let Some(patch_map) = patch.as_object() else {
        return false;
    };

    [
        "disableTray",
        "showFloatingWindow",
        "proxyInTray",
        "language",
    ]
    .iter()
    .any(|key| patch_map.contains_key(*key))
        || patch_map.contains_key("sysProxy")
}

pub(crate) fn read_connection_interval_ms(app: &tauri::AppHandle) -> u64 {
    read_app_config_store(app)
        .ok()
        .and_then(|config| config.get("connectionInterval").and_then(Value::as_u64))
        .map(|value| value.max(MIN_CONNECTION_INTERVAL_MS))
        .unwrap_or(MIN_CONNECTION_INTERVAL_MS)
}

pub(crate) fn read_controlled_config_store(app: &tauri::AppHandle) -> Result<Value, String> {
    read_value_store(app, CONTROLLED_CONFIG_FILE, json!({}))
}

pub(crate) fn patch_controlled_config_store(
    app: &tauri::AppHandle,
    patch: &Value,
) -> Result<Value, String> {
    let state = app.state::<CoreState>();
    let _guard = state.config_write_lock.lock().map_err(|e| e.to_string())?;
    let mut value = read_controlled_config_store(app)?;
    let app_config = read_app_config_store(app)?;
    let control_dns = app_config
        .get("controlDns")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let control_sniff = app_config
        .get("controlSniff")
        .and_then(Value::as_bool)
        .unwrap_or(true);

    if let Some(object) = value.as_object_mut() {
        if !control_dns {
            object.remove("dns");
            object.remove("hosts");
        }
        if !control_sniff {
            object.remove("sniffer");
        }
    }

    merge_json(&mut value, patch);

    if let Some(object) = value.as_object_mut() {
        if !control_dns {
            object.remove("dns");
            object.remove("hosts");
        }
        if !control_sniff {
            object.remove("sniffer");
        }
    }

    invalidate_profile_runtime_config_cache_after(
        write_value_store(app, CONTROLLED_CONFIG_FILE, &value).map(|_| value),
    )
}

pub(crate) fn read_profile_config(app: &tauri::AppHandle) -> Result<ProfileConfigData, String> {
    let path = storage_file(app, PROFILE_CONFIG_FILE)?;
    Ok(normalize_profile_config(
        read_json_file(&path)?.unwrap_or_default(),
    ))
}

pub(crate) fn write_profile_config(
    app: &tauri::AppHandle,
    config: &ProfileConfigData,
) -> Result<(), String> {
    let path = storage_file(app, PROFILE_CONFIG_FILE)?;
    let normalized = normalize_profile_config(config.clone());
    invalidate_profile_runtime_config_cache_after(write_json_file(&path, &normalized))
}

pub(crate) fn read_override_config(app: &tauri::AppHandle) -> Result<OverrideConfigData, String> {
    let path = storage_file(app, OVERRIDE_CONFIG_FILE)?;
    Ok(read_json_file(&path)?.unwrap_or_default())
}

pub(crate) fn write_override_config(
    app: &tauri::AppHandle,
    config: &OverrideConfigData,
) -> Result<(), String> {
    let path = storage_file(app, OVERRIDE_CONFIG_FILE)?;
    invalidate_profile_runtime_config_cache_after(write_json_file(&path, config))
}

pub(crate) fn read_chains_config(app: &tauri::AppHandle) -> Result<ChainsConfigData, String> {
    let path = storage_file(app, CHAINS_CONFIG_FILE)?;
    Ok(read_json_file(&path)?.unwrap_or_default())
}

pub(crate) fn write_chains_config(
    app: &tauri::AppHandle,
    config: &ChainsConfigData,
) -> Result<(), String> {
    let path = storage_file(app, CHAINS_CONFIG_FILE)?;
    invalidate_profile_runtime_config_cache_after(write_json_file(&path, config))
}

// Callers share with_storage_mutation so file changes and runtime application roll back together.
pub(crate) fn apply_configuration_change(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    app_patch: &Value,
    core_patch: &Value,
    force_restart: bool,
) -> Result<Value, String> {
    if !app_patch.is_object() || !core_patch.is_object() {
        return Err("配置补丁必须是对象".to_string());
    }
    patch_app_config_store(app, app_patch)?;
    patch_controlled_config_store(app, core_patch)?;
    let hot_reload = read_app_config_store(app)?
        .get("hotReloadCoreOnSave")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let running = state
        .runtime
        .lock()
        .map_err(|e| e.to_string())?
        .controller_url
        .is_some();
    let result = if running && hot_reload && !force_restart {
        reload_core_config_process(app, state, true)?
    } else {
        restart_core_process(app, state, None)?
    };
    if patch_requires_shell_surface_sync(app_patch) {
        sync_shell_surfaces(app)?;
    }
    emit_ipc_event(app, "appConfigUpdated", Value::Null);
    emit_ipc_event(app, "controledMihomoConfigUpdated", Value::Null);
    emit_ipc_event(app, "core-started", result.clone());
    emit_ipc_event(app, "groupsUpdated", Value::Null);
    emit_ipc_event(app, "rulesUpdated", Value::Null);
    Ok(result)
}

pub(crate) fn set_core_mode(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    mode: &str,
) -> Result<(), String> {
    patch_controlled_config_store(app, &json!({ "mode": mode }))?;
    if let Err(error) = core_request(
        state,
        reqwest::Method::PATCH,
        "/configs",
        None,
        Some(json!({ "mode": mode })),
    ) {
        if error != "Mihomo controller is not available" {
            return Err(error);
        }
    }
    emit_ipc_event(app, "controledMihomoConfigUpdated", Value::Null);
    emit_ipc_event(app, "groupsUpdated", Value::Null);
    emit_ipc_event(app, "rulesUpdated", Value::Null);
    Ok(())
}
