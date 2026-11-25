use crate::desktop::prelude::*;
use crate::desktop::*;

pub(crate) fn validate_override_extension(ext: &str) -> Result<&str, String> {
    match ext {
        "yaml" | "yml" | "js" | "log" => Ok(ext),
        _ => Err(format!("不支持的覆写文件扩展名: {ext}")),
    }
}

pub(crate) fn override_file_path(
    app: &tauri::AppHandle,
    id: &str,
    ext: &str,
) -> Result<PathBuf, String> {
    let id = validate_single_path_segment(id, "覆写 ID")?;
    let ext = validate_override_extension(ext)?;
    Ok(storage_dir(app, OVERRIDE_DIR_NAME)?.join(format!("{id}.{ext}")))
}

pub(crate) fn override_rollback_path(
    app: &tauri::AppHandle,
    id: &str,
    ext: &str,
) -> Result<PathBuf, String> {
    let id = validate_single_path_segment(id, "覆写 ID")?;
    let ext = validate_override_extension(ext)?;
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
    if ext == "yaml" {
        parse_profile_yaml_value(content)?;
    }
    let path = override_file_path(app, id, ext)?;
    let rollback_path = override_rollback_path(app, id, ext)?;

    if path.exists() {
        let previous = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        if previous != content {
            ensure_parent(&rollback_path)?;
            atomic_write_file(&rollback_path, previous.as_bytes())?;
        }
    }

    ensure_parent(&path)?;
    invalidate_profile_runtime_config_cache_after(atomic_write_file(&path, content.as_bytes()))
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
        atomic_write_file(&rollback_path, current.as_bytes())?;
    }
    invalidate_profile_runtime_config_cache_after(atomic_write_file(
        &target_path,
        rollback_content.as_bytes(),
    ))
}
