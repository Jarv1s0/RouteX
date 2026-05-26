use super::prelude::*;
use super::*;

#[tauri::command]
pub(crate) async fn desktop_check_update(app: tauri::AppHandle) -> Result<Value, String> {
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

pub(crate) fn should_suppress_update_check_error_log(error: &str) -> bool {
    error.contains("error sending request for url")
}

pub(crate) fn should_suppress_desktop_invoke_error_log(channel: &str, error: &str) -> bool {
    matches!(channel, "mihomoProxyDelay" | "mihomoGroupDelay")
        && (error.contains("Mihomo API request failed: 503 Service Unavailable")
            || error.contains("Mihomo API request failed: 504 Gateway Timeout"))
}

#[tauri::command]
pub(crate) async fn desktop_get_icon_data_urls(app_paths: Vec<String>) -> Result<Value, String> {
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

pub(crate) type IpcHandler = fn(
    &tauri::AppHandle,
    &tauri::WebviewWindow,
    &State<'_, CoreState>,
    &[Value],
) -> Result<Value, String>;

static IPC_HANDLERS: OnceLock<HashMap<&'static str, IpcHandler>> = OnceLock::new();
static LOG_CHANNELS: OnceLock<HashSet<&'static str>> = OnceLock::new();

fn init_ipc_handlers() -> HashMap<&'static str, IpcHandler> {
    let mut map = HashMap::new();
    register_config_handlers(&mut map);
    register_network_handlers(&mut map);
    register_system_handlers(&mut map);
    register_shell_handlers(&mut map);
    register_mihomo_handlers(&mut map);
    map
}

fn init_log_channels() -> HashSet<&'static str> {
    HashSet::from([
        "getRuntimeConfig",
        "getRuntimeConfigStr",
        "mihomoRules",
        "mihomoRuleProviders",
        "mihomoProxyProviders",
    ])
}

pub(crate) fn desktop_invoke_sync(
    app: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
    state: State<'_, CoreState>,
    channel: String,
    args: Vec<Value>,
) -> Result<Value, String> {
    let started_at = Instant::now();
    let map = IPC_HANDLERS.get_or_init(init_ipc_handlers);
    let result = match map.get(channel.as_str()) {
        Some(handler) => handler(app, window, &state, &args),
        None => Err(format!("Unsupported Tauri desktop channel: {channel}")),
    };

    let elapsed_ms = started_at.elapsed().as_millis();
    if elapsed_ms >= 80
        || LOG_CHANNELS
            .get_or_init(init_log_channels)
            .contains(channel.as_str())
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
pub(crate) async fn desktop_invoke(
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
