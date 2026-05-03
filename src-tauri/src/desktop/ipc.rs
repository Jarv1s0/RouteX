use super::*;

#[tauri::command]
pub(super) async fn desktop_check_update(app: tauri::AppHandle) -> Result<Value, String> {
    let started_at = Instant::now();
    let result = check_update_manifest(&app).await.map(|value| json!(value));

    let elapsed_ms = started_at.elapsed().as_millis();
    match &result {
        Ok(_) => eprintln!("[desktop.invoke] checkUpdate {}ms", elapsed_ms),
        Err(error) if !should_suppress_update_check_error_log(error) => eprintln!(
            "[desktop.invoke] checkUpdate failed in {}ms: {}",
            elapsed_ms, error
        ),
        Err(_) => {}
    }

    result
}

fn should_suppress_update_check_error_log(error: &str) -> bool {
    error.contains("error sending request for url")
}

fn should_suppress_desktop_invoke_error_log(channel: &str, error: &str) -> bool {
    matches!(channel, "mihomoProxyDelay" | "mihomoGroupDelay")
        && (error.contains("Mihomo API request failed: 503 Service Unavailable")
            || error.contains("Mihomo API request failed: 504 Gateway Timeout"))
}

#[tauri::command]
pub(super) async fn desktop_get_icon_data_urls(app_paths: Vec<String>) -> Result<Value, String> {
    let started_at = Instant::now();
    let paths = app_paths;
    let result =
        tauri::async_runtime::spawn_blocking(move || Ok(json!(resolve_icon_data_urls(&paths))))
            .await
            .map_err(|e| e.to_string())?;

    let elapsed_ms = started_at.elapsed().as_millis();
    if elapsed_ms >= 80 {
        match &result {
            Ok(_) => eprintln!("[desktop.invoke] getIconDataURLs {}ms", elapsed_ms),
            Err(error) => eprintln!(
                "[desktop.invoke] getIconDataURLs failed in {}ms: {}",
                elapsed_ms, error
            ),
        }
    }

    result
}

include!("ipc/config.rs");
include!("ipc/network.rs");
include!("ipc/system.rs");
include!("ipc/shell.rs");
include!("ipc/mihomo.rs");

fn desktop_invoke_sync(
    app: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
    state: State<'_, CoreState>,
    channel: String,
    args: Vec<Value>,
) -> Result<Value, String> {
    let started_at = Instant::now();
    let result = if let Some(value) = handle_config_invoke(app, &state, &channel, &args)? {
        Ok(value)
    } else if let Some(value) = handle_network_invoke(app, &state, &channel, &args)? {
        Ok(value)
    } else if let Some(value) = handle_system_invoke(app, &state, &channel, &args)? {
        Ok(value)
    } else if let Some(value) = handle_shell_invoke(app, window, &state, &channel, &args)? {
        Ok(value)
    } else if let Some(value) = handle_mihomo_invoke(app, window, &state, &channel, &args)? {
        Ok(value)
    } else {
        Err(format!("Unsupported Tauri desktop channel: {channel}"))
    };

    let elapsed_ms = started_at.elapsed().as_millis();
    if elapsed_ms >= 80
        || channel == "getRuntimeConfig"
        || channel == "getRuntimeConfigStr"
        || channel == "mihomoRules"
        || channel == "mihomoRuleProviders"
        || channel == "mihomoProxyProviders"
    {
        match &result {
            Ok(_) => eprintln!("[desktop.invoke] {} {}ms", channel, elapsed_ms),
            Err(error) if !should_suppress_desktop_invoke_error_log(&channel, error) => eprintln!(
                "[desktop.invoke] {} failed in {}ms: {}",
                channel, elapsed_ms, error
            ),
            Err(_) => {}
        }
    }

    result
}

#[tauri::command]
pub(super) async fn desktop_invoke(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    channel: String,
    args: Vec<Value>,
) -> Result<Value, String> {
    let app_for_task = app.clone();
    let window_for_task = window.clone();
    let channel_for_task = channel.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let state = app_for_task.state::<CoreState>();
        desktop_invoke_sync(
            &app_for_task,
            &window_for_task,
            state,
            channel_for_task,
            args,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}
