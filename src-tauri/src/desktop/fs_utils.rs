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

pub(crate) fn validate_single_path_segment<'a>(
    value: &'a str,
    label: &str,
) -> Result<&'a str, String> {
    if value.trim().is_empty()
        || value == "."
        || value == ".."
        || value.contains(['/', '\\', ':', '\0'])
    {
        return Err(format!("{label}包含无效路径字符"));
    }

    let mut components = Path::new(value).components();
    match (components.next(), components.next()) {
        (Some(std::path::Component::Normal(_)), None) => {}
        _ => return Err(format!("{label}必须是单一文件名")),
    }

    let stem = value
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    if value.ends_with([' ', '.'])
        || matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && matches!(stem.as_bytes()[3], b'1'..=b'9'))
    {
        return Err(format!("{label}包含系统保留文件名"));
    }

    Ok(value)
}

pub(crate) fn lexical_normalize_path(path: &Path) -> PathBuf {
    use std::path::Component;

    let mut result = PathBuf::new();
    let mut has_root = false;

    for component in path.components() {
        match component {
            Component::Prefix(prefix) => result.push(prefix.as_os_str()),
            Component::RootDir => {
                has_root = true;
                result.push(component.as_os_str());
            }
            Component::CurDir => {}
            Component::ParentDir => {
                let can_pop = matches!(result.components().next_back(), Some(Component::Normal(_)));
                if can_pop {
                    result.pop();
                } else if !has_root {
                    result.push(component.as_os_str());
                }
            }
            Component::Normal(part) => result.push(part),
        }
    }

    result
}

pub(crate) fn canonicalize_path_with_tail(path: &Path) -> Result<PathBuf, String> {
    let normalized = lexical_normalize_path(path);
    let mut cursor = normalized.as_path();
    let mut tail = Vec::new();

    loop {
        if let Ok(canonical) = fs::canonicalize(cursor) {
            let mut resolved = canonical;
            for part in tail.into_iter().rev() {
                resolved.push(part);
            }
            return Ok(resolved);
        }

        let Some(file_name) = cursor.file_name() else {
            return Err(format!("无法解析路径边界: {}", path.display()));
        };
        tail.push(file_name.to_os_string());
        let Some(parent) = cursor.parent() else {
            return Err(format!("无法解析路径边界: {}", path.display()));
        };
        cursor = parent;
    }
}

pub(crate) fn resolve_path_within_roots(
    candidate: &Path,
    roots: &[PathBuf],
) -> Result<PathBuf, String> {
    let normalized_candidate = lexical_normalize_path(candidate);
    let lexical_ok = roots
        .iter()
        .map(|root| lexical_normalize_path(root))
        .any(|root| normalized_candidate.starts_with(&root));
    if !lexical_ok {
        return Err(format!(
            "拒绝访问受限目录之外的路径: {}",
            candidate.display()
        ));
    }

    let canonical_candidate = canonicalize_path_with_tail(&normalized_candidate)?;
    let canonical_ok = roots.iter().any(|root| {
        canonicalize_path_with_tail(root)
            .is_ok_and(|canonical_root| canonical_candidate.starts_with(&canonical_root))
    });
    if !canonical_ok {
        return Err(format!(
            "拒绝访问受限目录之外的路径: {}",
            candidate.display()
        ));
    }

    Ok(normalized_candidate)
}
