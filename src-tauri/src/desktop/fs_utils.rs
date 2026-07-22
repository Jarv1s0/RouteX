use super::prelude::*;
use super::*;

pub(crate) fn default_app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

pub(crate) fn ensure_dir(path: PathBuf) -> Result<PathBuf, String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

pub(crate) fn app_config_root_path(root: &Path) -> PathBuf {
    root.join(APP_CONFIG_DIR_NAME)
}

pub(crate) fn app_runtime_root_path(root: &Path) -> PathBuf {
    root.join(APP_RUNTIME_DIR_NAME)
}

pub(crate) fn app_bin_root_path(root: &Path) -> PathBuf {
    root.join(APP_BIN_DIR_NAME)
}

pub(crate) fn app_runtime_logs_root_path(root: &Path) -> PathBuf {
    app_runtime_root_path(root).join(APP_RUNTIME_LOGS_DIR_NAME)
}

pub(crate) fn app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = primary_tauri_app_data_root(app)?;
    ensure_app_data_layout_migrated(&root)?;
    ensure_dir(root)
}

pub(crate) fn app_storage_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    ensure_dir(app_config_root_path(&app_data_root(app)?))
}

pub(crate) fn storage_file(app: &tauri::AppHandle, file_name: &str) -> Result<PathBuf, String> {
    Ok(app_storage_root(app)?.join(file_name))
}

pub(crate) fn storage_dir(app: &tauri::AppHandle, dir_name: &str) -> Result<PathBuf, String> {
    ensure_dir(app_storage_root(app)?.join(dir_name))
}

pub(crate) fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub(crate) fn read_json_file<T: DeserializeOwned>(path: &Path) -> Result<Option<T>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if text.trim().is_empty() {
        return Ok(None);
    }

    serde_json::from_str::<T>(&text)
        .map(Some)
        .map_err(|e| e.to_string())
}

pub(crate) fn write_json_file<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    ensure_parent(path)?;
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

pub(crate) fn read_floating_window_state(
    app: &tauri::AppHandle,
) -> Result<Option<FloatingWindowState>, String> {
    let path = storage_file(app, FLOATING_WINDOW_STATE_FILE)?;
    read_json_file(&path)
}

pub(crate) fn write_floating_window_state(
    app: &tauri::AppHandle,
    state: &FloatingWindowState,
) -> Result<(), String> {
    let path = storage_file(app, FLOATING_WINDOW_STATE_FILE)?;
    write_json_file(&path, state)
}
