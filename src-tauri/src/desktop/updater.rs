use super::*;

pub(super) fn fetch_text(url: &str, timeout_secs: u64) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client.get(url).send().map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("请求失败: {}", response.status()));
    }
    response.text().map_err(|e| e.to_string())
}

fn update_channel(app: &tauri::AppHandle) -> Result<String, String> {
    Ok(read_app_config_store(app)?
        .get("updateChannel")
        .and_then(Value::as_str)
        .unwrap_or("stable")
        .to_string())
}

fn update_manifest_url(app: &tauri::AppHandle) -> Result<String, String> {
    let update_channel = update_channel(app)?;
    Ok(if update_channel == "beta" {
        String::from("https://github.com/Jarv1s0/RouteX/releases/download/pre-release/latest.json")
    } else {
        String::from("https://github.com/Jarv1s0/RouteX/releases/latest/download/latest.json")
    })
}

pub(super) fn update_client(app: &tauri::AppHandle, timeout_secs: u64) -> Result<Client, String> {
    let controlled_config = read_controlled_config_store(app)?;
    let mixed_port = controlled_config
        .get("mixed-port")
        .and_then(Value::as_u64)
        .unwrap_or(7890);

    let mut client_builder = Client::builder().timeout(Duration::from_secs(timeout_secs));
    if mixed_port != 0 {
        let proxy = reqwest::Proxy::http(format!("http://127.0.0.1:{mixed_port}"))
            .map_err(|e| e.to_string())?;
        client_builder = client_builder.proxy(proxy);
    }

    client_builder.build().map_err(|e| e.to_string())
}

fn emit_update_status(
    app: &tauri::AppHandle,
    downloading: bool,
    progress: u64,
    error: Option<&str>,
) {
    let payload = match error {
        Some(message) => json!({
            "downloading": downloading,
            "progress": progress,
            "error": message,
        }),
        None => json!({
            "downloading": downloading,
            "progress": progress,
        }),
    };
    emit_ipc_event(app, "update-status", payload);
}

fn start_update_download(state: &State<'_, CoreState>) -> Result<Arc<AtomicBool>, String> {
    let mut guard = state
        .update_download_cancel
        .lock()
        .map_err(|_| String::from("更新状态锁已损坏"))?;
    if guard.is_some() {
        return Err(String::from("已有更新下载任务正在进行"));
    }

    let cancel_flag = Arc::new(AtomicBool::new(false));
    *guard = Some(cancel_flag.clone());
    Ok(cancel_flag)
}

fn finish_update_download(state: &State<'_, CoreState>) {
    if let Ok(mut guard) = state.update_download_cancel.lock() {
        *guard = None;
    }
}

fn updater_public_key() -> Result<&'static str, String> {
    option_env!("ROUTEX_UPDATER_PUBLIC_KEY")
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| String::from("缺少 ROUTEX_UPDATER_PUBLIC_KEY，无法启用官方更新校验"))
}

fn official_updater(
    app: &tauri::AppHandle,
    timeout_secs: u64,
) -> Result<tauri_plugin_updater::Updater, String> {
    let endpoint = reqwest::Url::parse(&update_manifest_url(app)?).map_err(|e| e.to_string())?;
    let mut builder = app
        .updater_builder()
        .pubkey(updater_public_key()?)
        .endpoints(vec![endpoint])
        .map_err(|e| e.to_string())?
        .timeout(Duration::from_secs(timeout_secs));

    let controlled_config = read_controlled_config_store(app)?;
    let mixed_port = controlled_config
        .get("mixed-port")
        .and_then(Value::as_u64)
        .unwrap_or(7890);
    if mixed_port != 0 {
        let proxy = reqwest::Url::parse(&format!("http://127.0.0.1:{mixed_port}"))
            .map_err(|e| e.to_string())?;
        builder = builder.proxy(proxy);
    }

    builder.build().map_err(|e| e.to_string())
}

pub(super) async fn download_and_install_update(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    version: &str,
) -> Result<(), String> {
    let _cancel_flag = start_update_download(state)?;
    let result = async {
        let updater = official_updater(app, 600)?;
        let update = updater
            .check()
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| String::from("未找到可用更新，请重新检查更新"))?;
        if update.version != version {
            return Err(String::from("更新信息已变化，请重新检查更新"));
        }

        emit_update_status(app, true, 0, None);
        let mut downloaded_bytes = 0_u64;
        update
            .download_and_install(
                |chunk_length, content_length| {
                    downloaded_bytes += chunk_length as u64;
                    let progress = content_length
                        .map(|size| ((downloaded_bytes * 100) / size.max(1)).min(100))
                        .unwrap_or(0);
                    emit_update_status(app, true, progress, None);
                },
                || {
                    emit_update_status(app, false, 100, None);
                },
            )
            .await
            .map_err(|e| e.to_string())
    }
    .await;

    if let Err(error) = &result {
        emit_update_status(app, false, 0, Some(error));
    }
    finish_update_download(state);
    result
}

pub(super) fn cancel_update_download(state: &State<'_, CoreState>) -> Result<(), String> {
    let guard = state
        .update_download_cancel
        .lock()
        .map_err(|_| String::from("更新状态锁已损坏"))?;
    if let Some(cancel_flag) = guard.as_ref() {
        cancel_flag.store(true, AtomicOrdering::SeqCst);
        return Err(String::from("官方 updater 下载开始后暂不支持取消"));
    }
    Ok(())
}

pub(super) async fn check_update_manifest(app: &tauri::AppHandle) -> Result<Option<Value>, String> {
    let updater = official_updater(app, 20)?;
    let update = updater.check().await.map_err(|e| e.to_string())?;
    Ok(update.map(|update| {
        json!({
            "version": update.version,
            "releaseNotes": update.body.unwrap_or_default(),
        })
    }))
}
