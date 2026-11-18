use super::prelude::*;
use super::*;

// Ordinary file operations share access. A validated WebDAV restore holds the
// exclusive guard only while exchanging directories, so no reader recreates root.
pub(crate) static CONFIG_DIRECTORY_SWAP_LOCK: std::sync::RwLock<()> = std::sync::RwLock::new(());

pub(crate) fn default_app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

pub(crate) fn ensure_dir(path: PathBuf) -> Result<PathBuf, String> {
    let _guard = CONFIG_DIRECTORY_SWAP_LOCK
        .read()
        .map_err(|e| e.to_string())?;
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
    let _guard = CONFIG_DIRECTORY_SWAP_LOCK
        .read()
        .map_err(|e| e.to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub(crate) fn read_json_file<T: DeserializeOwned>(path: &Path) -> Result<Option<T>, String> {
    let _guard = CONFIG_DIRECTORY_SWAP_LOCK
        .read()
        .map_err(|e| e.to_string())?;
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
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    atomic_write_file(path, text.as_bytes())
}

pub(crate) fn atomic_write_file(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let _guard = CONFIG_DIRECTORY_SWAP_LOCK
        .read()
        .map_err(|e| e.to_string())?;
    let parent = path.parent().ok_or("文件缺少父目录")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temporary.write_all(bytes).map_err(|e| e.to_string())?;
    temporary.as_file().sync_all().map_err(|e| e.to_string())?;
    temporary.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn replace_file_with_rollback<T>(
    candidate: &Path,
    target: &Path,
    apply: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let parent = target.parent().ok_or("文件缺少父目录")?;
    let backup_dir = tempfile::Builder::new()
        .prefix("routex-rollback-")
        .tempdir_in(parent)
        .map_err(|e| e.to_string())?;
    let backup = backup_dir.path().join("original");
    let had_original = target.exists();
    if had_original {
        fs::rename(target, &backup).map_err(|e| format!("保留旧文件失败: {e}"))?;
    }
    let result = fs::rename(candidate, target)
        .map_err(|e| format!("替换文件失败: {e}"))
        .and_then(|_| apply());
    match result {
        Ok(value) => Ok(value),
        Err(error) => {
            let restore = (|| -> Result<(), String> {
                if target.exists() {
                    fs::remove_file(target).map_err(|e| e.to_string())?;
                }
                if had_original {
                    fs::rename(&backup, target).map_err(|e| e.to_string())?;
                }
                Ok(())
            })();
            if let Err(restore_error) = restore {
                let retained = backup_dir.keep();
                return Err(format!(
                    "{error}; 回滚失败: {restore_error}; 旧文件保留在 {}",
                    retained.display()
                ));
            }
            Err(error)
        }
    }
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
