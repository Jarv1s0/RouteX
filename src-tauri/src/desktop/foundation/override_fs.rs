use crate::desktop::prelude::*;
use crate::desktop::*;

pub(crate) fn override_file_path(
    app: &tauri::AppHandle,
    id: &str,
    ext: &str,
) -> Result<PathBuf, String> {
    Ok(storage_dir(app, OVERRIDE_DIR_NAME)?.join(format!("{id}.{ext}")))
}

pub(crate) fn override_rollback_path(
    app: &tauri::AppHandle,
    id: &str,
    ext: &str,
) -> Result<PathBuf, String> {
    Ok(storage_dir(app, OVERRIDE_DIR_NAME)?.join(format!("{id}.{ext}.rollback")))
}

pub(crate) fn read_override_text(
    app: &tauri::AppHandle,
    id: &str,
    ext: &str,
) -> Result<String, String> {
    let path = override_file_path(app, id, ext)?;
    if path.exists() {
        return fs::read_to_string(path).map_err(|e| e.to_string());
    }

    Ok(String::new())
}

pub(crate) fn write_override_text(
    app: &tauri::AppHandle,
    id: &str,
    ext: &str,
    content: &str,
) -> Result<(), String> {
    let path = override_file_path(app, id, ext)?;
    let rollback_path = override_rollback_path(app, id, ext)?;

    if path.exists() {
        let previous = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        if previous != content {
            ensure_parent(&rollback_path)?;
            fs::write(&rollback_path, previous).map_err(|e| e.to_string())?;
        }
    }

    ensure_parent(&path)?;
    invalidate_profile_runtime_config_cache_after(
        fs::write(path, content).map_err(|e| e.to_string()),
    )
}

pub(crate) fn rollback_override_text(
    app: &tauri::AppHandle,
    id: &str,
    ext: &str,
) -> Result<(), String> {
    let target_path = override_file_path(app, id, ext)?;
    let rollback_path = override_rollback_path(app, id, ext)?;

    if !rollback_path.exists() {
        return Err("当前覆写没有可回滚的上次内容".to_string());
    }

    let rollback_content = fs::read_to_string(&rollback_path).map_err(|e| e.to_string())?;
    if target_path.exists() {
        let current = fs::read_to_string(&target_path).map_err(|e| e.to_string())?;
        fs::write(&rollback_path, current).map_err(|e| e.to_string())?;
    }
    invalidate_profile_runtime_config_cache_after(
        fs::write(target_path, rollback_content).map_err(|e| e.to_string()),
    )
}
