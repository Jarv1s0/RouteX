use super::prelude::*;
use super::*;

pub(crate) const RUNTIME_CHECK_DIR_NAME: &str = "check";
pub(crate) const LEGACY_RUNTIME_TEST_DIR_NAME: &str = "test";
const RUNTIME_DATA_FILE_NAMES: [&str; 4] =
    ["country.mmdb", "geoip.metadb", "geoip.dat", "geosite.dat"];

pub(crate) fn migrate_legacy_runtime_check_dir(profile_base: &Path) -> Result<(), String> {
    let legacy_test_dir = profile_base.join(LEGACY_RUNTIME_TEST_DIR_NAME);
    let check_dir = profile_base.join(RUNTIME_CHECK_DIR_NAME);
    migrate_directory(&legacy_test_dir, &check_dir)
}

pub(crate) fn migrate_legacy_runtime_work_dir(profile_base: &Path) -> Result<(), String> {
    migrate_directory(&profile_base.join("work"), profile_base)
}

pub(crate) fn prepare_runtime_data_dir(
    app: &tauri::AppHandle,
    data_dir: &Path,
) -> Result<(), String> {
    for file_name in RUNTIME_DATA_FILE_NAMES {
        let target_path = data_dir.join(file_name);
        let should_copy = if target_path.exists() {
            fs::metadata(&target_path)
                .map(|metadata| metadata.len() == 0)
                .unwrap_or(true)
        } else {
            true
        };

        if !should_copy {
            continue;
        }

        if target_path.exists() {
            let _ = fs::remove_file(&target_path);
        }

        let Ok(source_path) = resolve_resource_binary(app, "tools", file_name) else {
            continue;
        };

        fs::copy(source_path, target_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub(crate) fn link_or_copy_runtime_data_file_with(
    source_path: &Path,
    target_path: &Path,
    hard_link: impl FnOnce(&Path, &Path) -> std::io::Result<()>,
) -> Result<(), String> {
    match hard_link(source_path, target_path) {
        Ok(()) => Ok(()),
        Err(link_error) => fs::copy(source_path, target_path)
            .map(|_| ())
            .map_err(|copy_error| {
                format!(
                    "无法准备校验数据文件 {}（硬链接失败: {link_error}; 复制失败: {copy_error}）",
                    target_path.display()
                )
            }),
    }
}

fn remove_file_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("无法删除文件 {}: {error}", path.display())),
    }
}

pub(crate) fn cleanup_runtime_check_cache(check_dir: &Path) {
    if let Err(error) = remove_file_if_exists(&check_dir.join("cache.db")) {
        eprintln!("[desktop.core_check] {error}");
    }
}

pub(crate) fn prepare_runtime_check_dir(
    runtime_dir: &Path,
    check_dir: &Path,
) -> Result<(), String> {
    fs::create_dir_all(check_dir).map_err(|e| e.to_string())?;
    remove_file_if_exists(&check_dir.join("cache.db"))?;

    for file_name in RUNTIME_DATA_FILE_NAMES {
        let source_path = runtime_dir.join(file_name);
        let target_path = check_dir.join(file_name);
        remove_file_if_exists(&target_path)?;

        if source_path.is_file() {
            link_or_copy_runtime_data_file_with(&source_path, &target_path, |source, target| {
                fs::hard_link(source, target)
            })?;
        }
    }

    Ok(())
}

pub(crate) fn ensure_runtime_dirs(
    app: &tauri::AppHandle,
    current_profile_id: Option<&str>,
    diff_work_dir: bool,
) -> Result<(PathBuf, PathBuf, PathBuf, PathBuf), String> {
    let app_root = app_data_root(app)?;
    let base = app_runtime_root_path(&app_root);
    let logs_base = app_runtime_logs_root_path(&app_root);
    let profile_base = if diff_work_dir {
        current_profile_id
            .filter(|value| !value.trim().is_empty())
            .map(|id| base.join("profiles").join(id))
            .unwrap_or_else(|| base.clone())
    } else {
        base.clone()
    };
    let profile_logs_base = if diff_work_dir {
        current_profile_id
            .filter(|value| !value.trim().is_empty())
            .map(|id| logs_base.join("profiles").join(id))
            .unwrap_or_else(|| logs_base.clone())
    } else {
        logs_base.clone()
    };

    migrate_legacy_runtime_check_dir(&profile_base)?;
    migrate_legacy_runtime_work_dir(&profile_base)?;

    let logs_dir = profile_logs_base;
    let check_dir = profile_base.join(RUNTIME_CHECK_DIR_NAME);
    let work_dir = profile_base;
    let log_path = logs_dir.join("mihomo.log");

    fs::create_dir_all(&work_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&check_dir).map_err(|e| e.to_string())?;

    Ok((base, work_dir, log_path, check_dir))
}
