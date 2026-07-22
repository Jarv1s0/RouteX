use crate::desktop::prelude::*;
use crate::desktop::*;

pub(crate) fn tauri_build_variant() -> &'static str {
    match option_env!("ROUTEX_TAURI_BUILD_VARIANT") {
        Some("dev") => "dev",
        Some("autobuild") => "autobuild",
        Some("release") => "release",
        Some(value) if !value.trim().is_empty() => value,
        _ if cfg!(debug_assertions) => "dev",
        _ => "release",
    }
}

pub(crate) fn global_shortcut_plugin_enabled() -> bool {
    true
}

#[cfg(target_os = "windows")]
pub(crate) fn primary_tauri_app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let default_root = default_app_data_root(app)?;
    let base = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .or_else(|| default_root.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| default_root.clone());
    ensure_windows_app_data_root_migrated(&base)
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn primary_tauri_app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    default_app_data_root(app)
}

#[cfg(target_os = "windows")]
pub(crate) fn routex_run_task_name() -> &'static str {
    match tauri_build_variant() {
        "dev" => "routex-run-dev",
        _ => ROUTEX_RUN_TASK_NAME,
    }
}

#[cfg(target_os = "windows")]
pub(crate) fn routex_autorun_task_name() -> &'static str {
    match tauri_build_variant() {
        "dev" => "routex-dev",
        _ => ROUTEX_AUTORUN_TASK_NAME,
    }
}

pub(crate) fn platform_name() -> &'static str {
    match std::env::consts::OS {
        "windows" => "win32",
        "macos" => "darwin",
        other => other,
    }
}

pub(crate) fn apply_window_theme(_window: &tauri::WebviewWindow, theme: Option<&str>) {
    let _ = theme;
}

pub(crate) fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub(crate) fn current_local_timestamp_string() -> String {
    OffsetDateTime::now_local()
        .unwrap_or_else(|_| OffsetDateTime::now_utc())
        .format(&format_description!(
            "[year]-[month]-[day]-[hour][minute][second]"
        ))
        .unwrap_or_else(|_| current_timestamp_ms().to_string())
}

pub(crate) fn create_id() -> String {
    format!("{:x}", current_timestamp_ms())
}
