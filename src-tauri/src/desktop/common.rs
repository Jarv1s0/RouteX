use super::prelude::*;
use super::*;

pub(crate) fn read_string_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

pub(crate) fn read_webdav_config(app: &tauri::AppHandle) -> Result<WebdavConfig, String> {
    let config = read_app_config_store(app)?;
    Ok(WebdavConfig {
        url: read_string_field(&config, "webdavUrl"),
        username: read_string_field(&config, "webdavUsername"),
        password: read_string_field(&config, "webdavPassword"),
        dir: {
            let dir = read_string_field(&config, "webdavDir");
            if dir.trim().is_empty() {
                "routex".to_string()
            } else {
                dir
            }
        },
    })
}

pub(crate) fn ensure_webdav_config(config: &WebdavConfig) -> Result<(), String> {
    if config.url.trim().is_empty() {
        return Err("WebDAV 地址未配置".to_string());
    }

    Ok(())
}

pub(crate) fn build_webdav_url(config: &WebdavConfig, child: Option<&str>) -> String {
    let mut base = config.url.trim_end_matches('/').to_string();
    let mut segments = Vec::new();

    if !config.dir.trim().is_empty() {
        segments.extend(
            config
                .dir
                .split('/')
                .filter(|segment| !segment.trim().is_empty())
                .map(|segment| urlencoding::encode(segment).into_owned()),
        );
    }

    if let Some(child) = child {
        segments.extend(
            child
                .split('/')
                .filter(|segment| !segment.trim().is_empty())
                .map(|segment| urlencoding::encode(segment).into_owned()),
        );
    }

    if !segments.is_empty() {
        base.push('/');
        base.push_str(&segments.join("/"));
    }

    base
}

pub(crate) fn get_app_name_value(app_path: &str) -> String {
    Path::new(app_path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(app_path)
        .to_string()
}

pub(crate) fn default_icon_data_url() -> &'static str {
    "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\"><rect width=\"64\" height=\"64\" rx=\"18\" fill=\"%231f6feb\"/><path d=\"M20 21h24a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3V24a3 3 0 0 1 3-3Z\" fill=\"%23fff\" fill-opacity=\".92\"/><path d=\"M24 28h16M24 34h10\" stroke=\"%231f6feb\" stroke-width=\"4\" stroke-linecap=\"round\"/></svg>"
}

pub(crate) fn emit_ipc_event(app: &tauri::AppHandle, channel: &str, payload: Value) {
    let _ = app.emit(channel, payload);
}

#[cfg(target_os = "windows")]
const WEBVIEW2_DISABLE_GPU_BROWSER_ARGS: &str =
    "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --disable-gpu";

#[cfg(target_os = "windows")]
fn app_config_disables_gpu(config: &Value) -> bool {
    config
        .get("disableGPU")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
pub(crate) fn webview_browser_args_for_config(config: &Value) -> Option<&'static str> {
    app_config_disables_gpu(config).then_some(WEBVIEW2_DISABLE_GPU_BROWSER_ARGS)
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn webview_browser_args_for_config(_config: &Value) -> Option<&'static str> {
    None
}

pub(crate) fn webview_browser_args(app: &tauri::AppHandle) -> Option<&'static str> {
    read_app_config_store(app)
        .ok()
        .and_then(|config| webview_browser_args_for_config(&config))
}

#[cfg(target_os = "windows")]
pub(crate) fn webview_browser_args_before_tauri() -> Option<&'static str> {
    let config_path =
        app_config_root_path(&app_data_root_before_tauri().ok()?).join(APP_CONFIG_FILE);
    let config = read_json_file::<Value>(&config_path).ok().flatten()?;
    webview_browser_args_for_config(&config)
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn webview_browser_args_before_tauri() -> Option<&'static str> {
    None
}

pub(crate) fn apply_webview_browser_args_to_config(config: &mut tauri::Config) {
    let Some(browser_args) = webview_browser_args_before_tauri() else {
        return;
    };

    for window in &mut config.app.windows {
        window.additional_browser_args = Some(browser_args.to_string());
    }
}

pub(crate) fn apply_background_command(command: &mut Command) -> &mut Command {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
}

#[cfg(target_os = "windows")]
pub(crate) fn powershell_command() -> Command {
    let mut command = Command::new("powershell");
    apply_background_command(&mut command);
    command
}

pub(crate) fn guess_mime_from_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    }
}

pub(crate) fn to_data_url(mime: &str, bytes: &[u8]) -> String {
    format!("data:{mime};base64,{}", BASE64_STANDARD.encode(bytes))
}
