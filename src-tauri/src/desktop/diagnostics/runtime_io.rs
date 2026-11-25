use crate::desktop::prelude::*;
use crate::desktop::*;

fn resolve_runtime_base_dir(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<PathBuf, String> {
    let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    if let Some(work_dir) = runtime.work_dir.as_ref() {
        return Ok(work_dir.clone());
    }
    drop(runtime);

    storage_dir(app, RUNTIME_DIR_NAME)
}

fn runtime_read_roots(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<Vec<PathBuf>, String> {
    let work_dir = resolve_runtime_base_dir(app, state)?;
    let app_root = app_data_root(app)?;
    let mut roots = vec![work_dir.clone(), app_root];
    for safe_path in read_safe_paths(app).unwrap_or_default() {
        let candidate = PathBuf::from(safe_path.trim());
        if candidate.as_os_str().is_empty() {
            continue;
        }
        if candidate.is_absolute() {
            roots.push(candidate);
        } else {
            roots.push(work_dir.join(candidate));
        }
    }
    Ok(roots)
}

fn runtime_write_roots(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<Vec<PathBuf>, String> {
    let work_dir = resolve_runtime_base_dir(app, state)?;
    let runtime_root = app_runtime_root_path(&app_data_root(app)?);
    Ok(vec![work_dir, runtime_root])
}

fn resolve_raw_runtime_candidate(work_dir: &Path, raw_path: &str) -> Result<PathBuf, String> {
    if raw_path.trim().is_empty() {
        return Err("文件路径不能为空".to_string());
    }
    let path = PathBuf::from(raw_path);
    Ok(if path.is_absolute() {
        path
    } else {
        work_dir.join(path)
    })
}

pub(crate) fn authorize_read_paths(
    state: &State<'_, CoreState>,
    paths: &[String],
) -> Result<(), String> {
    let mut authorized = state
        .authorized_read_paths
        .lock()
        .map_err(|e| e.to_string())?;
    for raw in paths {
        if raw.trim().is_empty() {
            continue;
        }
        if let Ok(canonical) = canonicalize_path_with_tail(Path::new(raw)) {
            authorized.insert(canonical);
        }
    }
    Ok(())
}

pub(crate) fn resolve_runtime_file_path(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
) -> Result<PathBuf, String> {
    let work_dir = resolve_runtime_base_dir(app, state)?;
    let candidate = resolve_raw_runtime_candidate(&work_dir, raw_path)?;
    let roots = runtime_read_roots(app, state)?;
    resolve_path_within_roots(&candidate, &roots)
}

pub(crate) fn resolve_runtime_write_path(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
) -> Result<PathBuf, String> {
    let work_dir = resolve_runtime_base_dir(app, state)?;
    let candidate = resolve_raw_runtime_candidate(&work_dir, raw_path)?;
    let roots = runtime_write_roots(app, state)?;
    resolve_path_within_roots(&candidate, &roots)
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
    let path = resolve_runtime_write_path(app, state, raw_path)?;
    ensure_parent(&path)?;
    atomic_write_file(&path, content.as_bytes())
}

pub(crate) fn is_authorized_read_path(
    raw_path: &str,
    authorized_paths: &HashSet<PathBuf>,
    internal_roots: &[PathBuf],
) -> Result<PathBuf, String> {
    if raw_path.trim().is_empty() {
        return Err("文件路径不能为空".to_string());
    }
    let path = PathBuf::from(raw_path);
    let canonical = canonicalize_path_with_tail(&path)?;
    if authorized_paths.contains(&canonical) {
        return Ok(canonical);
    }

    resolve_path_within_roots(&path, internal_roots)?;
    Ok(canonical)
}

pub(crate) fn read_authorized_text(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
) -> Result<String, String> {
    let work_dir = resolve_runtime_base_dir(app, state)?;
    let app_root = app_data_root(app)?;
    let internal_roots = vec![work_dir.clone(), app_root];
    let candidate = if Path::new(raw_path).is_absolute() {
        raw_path.to_string()
    } else {
        work_dir.join(raw_path).to_string_lossy().to_string()
    };
    let path = {
        let authorized = state
            .authorized_read_paths
            .lock()
            .map_err(|e| e.to_string())?;
        is_authorized_read_path(&candidate, &authorized, &internal_roots)?
    };
    if !path.exists() {
        return Ok(String::new());
    }

    fs::read_to_string(path).map_err(|e| e.to_string())
}
