use crate::desktop::prelude::*;
use crate::desktop::*;

pub(crate) fn resolve_runtime_file_path(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw_path);
    if path.is_absolute() {
        return Ok(path);
    }

    let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    if let Some(work_dir) = runtime.work_dir.as_ref() {
        return Ok(work_dir.join(raw_path));
    }
    drop(runtime);

    Ok(storage_dir(app, RUNTIME_DIR_NAME)?.join(raw_path))
}

pub(crate) fn read_runtime_text(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
) -> Result<String, String> {
    let path = resolve_runtime_file_path(app, state, raw_path)?;
    if !path.exists() {
        return Ok(String::new());
    }

    fs::read_to_string(path).map_err(|e| e.to_string())
}

pub(crate) fn write_runtime_text(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
    content: &str,
) -> Result<(), String> {
    let path = resolve_runtime_file_path(app, state, raw_path)?;
    ensure_parent(&path)?;
    fs::write(path, content).map_err(|e| e.to_string())
}
