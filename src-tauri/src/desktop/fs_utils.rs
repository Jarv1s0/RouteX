use super::prelude::*;
use super::*;

pub(crate) fn default_app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

pub(crate) fn ensure_dir(path: PathBuf) -> Result<PathBuf, String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

pub(crate) fn copy_path_if_missing(source: &Path, target: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }

    if source.is_dir() {
        fs::create_dir_all(target).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            copy_path_if_missing(&entry.path(), &target.join(entry.file_name()))?;
        }
        return Ok(());
    }

    if target.exists() {
        return Ok(());
    }

    ensure_parent(target)?;
    fs::copy(source, target)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

pub(crate) fn migrate_tauri_app_data_root_if_needed(
    source_root: &Path,
    target_root: &Path,
) -> Result<(), String> {
    if source_root == target_root || !source_root.exists() {
        return Ok(());
    }

    let target_store = target_root.join(ROUTEX_STORE_DIR_NAME);
    let target_core = target_root.join(MIHOMO_RUNTIME_DIR_NAME);
    if target_store.exists() && target_core.exists() {
        return Ok(());
    }

    fs::create_dir_all(target_root).map_err(|e| e.to_string())?;

    for entry_name in [
        ROUTEX_STORE_DIR_NAME,
        MIHOMO_RUNTIME_DIR_NAME,
        UPDATES_DIR_NAME,
        TASKS_DIR_NAME,
        RUNTIME_ASSETS_DIR_NAME,
    ] {
        copy_path_if_missing(&source_root.join(entry_name), &target_root.join(entry_name))?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
pub(crate) fn app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let default_root = default_app_data_root(app)?;
    let primary_root = primary_tauri_app_data_root(app)?;
    migrate_tauri_app_data_root_if_needed(&default_root, &primary_root)?;
    ensure_dir(primary_root)
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    ensure_dir(primary_tauri_app_data_root(app)?)
}

pub(crate) fn app_storage_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    ensure_dir(app_data_root(app)?.join(ROUTEX_STORE_DIR_NAME))
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
