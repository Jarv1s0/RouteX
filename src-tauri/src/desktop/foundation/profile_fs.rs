use crate::desktop::prelude::*;
use crate::desktop::*;

pub(crate) fn profile_file_path(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
    Ok(storage_dir(app, PROFILE_DIR_NAME)?.join(format!("{id}.yaml")))
}

pub(crate) fn read_profile_text(app: &tauri::AppHandle, id: &str) -> Result<String, String> {
    let path = profile_file_path(app, id)?;
    if path.exists() {
        return fs::read_to_string(path).map_err(|e| e.to_string());
    }

    Ok(DEFAULT_PROFILE_TEXT.to_string())
}

pub(crate) fn write_profile_text(
    app: &tauri::AppHandle,
    id: &str,
    content: &str,
) -> Result<(), String> {
    let path = profile_file_path(app, id)?;
    ensure_parent(&path)?;
    invalidate_profile_runtime_config_cache_after(
        fs::write(path, content).map_err(|e| e.to_string()),
    )
}
