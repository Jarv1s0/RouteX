use super::prelude::*;
use super::*;

static APP_DATA_LAYOUT_MIGRATION: OnceLock<Result<(), String>> = OnceLock::new();
#[cfg(target_os = "windows")]
static WINDOWS_APP_DATA_ROOT_MIGRATION: OnceLock<PathBuf> = OnceLock::new();

fn is_real_directory(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|metadata| metadata.file_type().is_dir())
        .unwrap_or(false)
}

fn move_directory_contents(source: &Path, target: &Path) -> Result<(), String> {
    if !is_real_directory(source) {
        return Ok(());
    }

    fs::create_dir_all(target).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        let source_type = entry.file_type().map_err(|error| error.to_string())?;
        if source_type.is_symlink() {
            continue;
        }

        if !target_path.exists() {
            fs::rename(&source_path, &target_path).map_err(|error| {
                format!(
                    "迁移目录失败 {} -> {}: {error}",
                    source_path.display(),
                    target_path.display()
                )
            })?;
        } else if source_type.is_dir() && is_real_directory(&target_path) {
            move_directory_contents(&source_path, &target_path)?;
        }
    }

    Ok(())
}

fn copy_directory_contents_if_missing(source: &Path, target: &Path) -> Result<(), String> {
    if !is_real_directory(source) {
        return Ok(());
    }

    fs::create_dir_all(target).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        let source_type = entry.file_type().map_err(|error| error.to_string())?;
        if source_type.is_symlink() {
            continue;
        }
        if source_type.is_dir() {
            copy_directory_contents_if_missing(&source_path, &target_path)?;
        } else if !target_path.exists() {
            fs::copy(&source_path, &target_path).map_err(|error| {
                format!(
                    "复制兼容文件失败 {} -> {}: {error}",
                    source_path.display(),
                    target_path.display()
                )
            })?;
        }
    }
    Ok(())
}

pub(crate) fn migrate_directory(source: &Path, target: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }
    if fs::symlink_metadata(source)
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false)
    {
        return Ok(());
    }
    if !target.exists() {
        fs::rename(source, target).map_err(|error| {
            format!(
                "迁移目录失败 {} -> {}: {error}",
                source.display(),
                target.display()
            )
        })?;
        return Ok(());
    }
    move_directory_contents(source, target)?;
    if is_real_directory(source) {
        fs::remove_dir_all(source).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn flatten_redundant_ui_directories(ui_root: &Path) -> Result<(), String> {
    if !is_real_directory(ui_root) {
        return Ok(());
    }

    for entry in fs::read_dir(ui_root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let ui_dir = entry.path();
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_dir()
        {
            continue;
        }
        let Some(name) = ui_dir.file_name() else {
            continue;
        };
        let redundant_child = ui_dir.join(name);
        if is_real_directory(&redundant_child) {
            migrate_directory(&redundant_child, &ui_dir)?;
        }
    }
    Ok(())
}

fn migrate_controlled_external_ui_path(root: &Path) -> Result<(), String> {
    let path = app_config_root_path(root).join(CONTROLLED_CONFIG_FILE);
    let Some(mut config) = read_json_file::<Value>(&path)? else {
        return Ok(());
    };
    let Some(object) = config.as_object_mut() else {
        return Ok(());
    };
    let Some(ui_name) = object
        .get("external-ui-name")
        .and_then(Value::as_str)
        .map(str::to_string)
    else {
        return Ok(());
    };
    let legacy_path = format!("ui/{ui_name}");
    if object.get("external-ui").and_then(Value::as_str) != Some(legacy_path.as_str()) {
        return Ok(());
    }

    object.insert("external-ui".to_string(), Value::String("ui".to_string()));
    write_json_file(&path, &config)
}

fn migrate_profile_runtime_layout(profiles_root: &Path) -> Result<(), String> {
    if !is_real_directory(profiles_root) {
        return Ok(());
    }
    for entry in fs::read_dir(profiles_root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let profile_root = entry.path();
        if entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_dir()
        {
            migrate_directory(&profile_root.join("work"), &profile_root)?;
            flatten_redundant_ui_directories(&profile_root.join("ui"))?;
        }
    }
    Ok(())
}

pub(crate) fn migrate_app_data_layout(root: &Path) -> Result<(), String> {
    fs::create_dir_all(root).map_err(|error| error.to_string())?;
    let runtime_root = app_runtime_root_path(root);
    let bin_root = app_bin_root_path(root);

    migrate_directory(&root.join(LEGACY_APP_CORE_DIR_NAME), &bin_root)?;
    copy_directory_contents_if_missing(
        &runtime_root.join(LEGACY_APP_RUNTIME_TASKS_DIR_NAME),
        &bin_root,
    )?;
    migrate_directory(
        &runtime_root.join(LEGACY_APP_RUNTIME_TOOLS_DIR_NAME),
        &bin_root,
    )?;
    migrate_directory(&runtime_root.join("work"), &runtime_root)?;
    flatten_redundant_ui_directories(&runtime_root.join("ui"))?;
    migrate_profile_runtime_layout(&runtime_root.join("profiles"))?;
    migrate_controlled_external_ui_path(root)
}

pub(crate) fn cleanup_legacy_runtime_tasks(root: &Path) -> Result<(), String> {
    let legacy_tasks = app_runtime_root_path(root).join(LEGACY_APP_RUNTIME_TASKS_DIR_NAME);
    if is_real_directory(&legacy_tasks) {
        fs::remove_dir_all(&legacy_tasks).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub(crate) fn ensure_app_data_layout_migrated(root: &Path) -> Result<(), String> {
    APP_DATA_LAYOUT_MIGRATION
        .get_or_init(|| migrate_app_data_layout(root))
        .clone()
}

#[cfg(target_os = "windows")]
pub(crate) fn migrate_windows_app_data_root(base: &Path) -> Result<PathBuf, String> {
    let root = base.join(WINDOWS_APP_DATA_DIR_NAME);
    let legacy_root = base.join(LEGACY_WINDOWS_APP_DATA_DIR_NAME);
    migrate_directory(&legacy_root, &root)?;
    Ok(root)
}

#[cfg(target_os = "windows")]
pub(crate) fn ensure_windows_app_data_root_migrated(base: &Path) -> Result<PathBuf, String> {
    if let Some(root) = WINDOWS_APP_DATA_ROOT_MIGRATION.get() {
        return Ok(root.clone());
    }
    let root = migrate_windows_app_data_root(base)?;
    let _ = WINDOWS_APP_DATA_ROOT_MIGRATION.set(root.clone());
    Ok(root)
}
