use super::super::prelude::*;
use super::super::*;

// Keep configuration, downloaded content and rollback files together. Execution logs
// deliberately survive a failed update so the user can inspect the actual error.
pub(crate) struct ProfileStorageSnapshot {
    files: HashMap<PathBuf, Option<Vec<u8>>>,
    directories: Vec<PathBuf>,
}

impl ProfileStorageSnapshot {
    pub(crate) fn capture(root: &Path) -> Result<Self, String> {
        let directories = vec![root.join(PROFILE_DIR_NAME), root.join(OVERRIDE_DIR_NAME)];
        let mut paths = vec![
            root.join(PROFILE_CONFIG_FILE),
            root.join(OVERRIDE_CONFIG_FILE),
        ];
        for directory in &directories {
            paths.extend(Self::content_files(directory)?);
        }
        let mut files = HashMap::new();
        for path in paths {
            let content = match fs::read(&path) {
                Ok(content) => Some(content),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
                Err(error) => return Err(error.to_string()),
            };
            files.insert(path, content);
        }
        Ok(Self { files, directories })
    }

    fn content_files(directory: &Path) -> Result<Vec<PathBuf>, String> {
        let entries = match fs::read_dir(directory) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(error) => return Err(error.to_string()),
        };
        let mut paths = Vec::new();
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if entry.file_type().map_err(|e| e.to_string())?.is_file()
                && path.extension().is_none_or(|ext| ext != "log")
            {
                paths.push(path);
            }
        }
        Ok(paths)
    }

    pub(crate) fn restore(&self) -> Result<(), String> {
        let mut paths = self.files.keys().cloned().collect::<HashSet<_>>();
        let mut errors = Vec::new();
        for directory in &self.directories {
            match Self::content_files(directory) {
                Ok(files) => paths.extend(files),
                Err(error) => errors.push(error),
            }
        }
        for path in paths {
            let result = if let Some(content) = self.files.get(&path).and_then(Option::as_ref) {
                if fs::read(&path).ok().as_ref() == Some(content) {
                    continue;
                }
                ensure_parent(&path)
                    .and_then(|()| fs::write(&path, content).map_err(|e| e.to_string()))
            } else {
                match fs::remove_file(&path) {
                    Ok(()) => Ok(()),
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
                    Err(error) => Err(error.to_string()),
                }
            };
            if let Err(error) = result {
                errors.push(format!("{}: {error}", path.display()));
            }
        }
        invalidate_profile_runtime_config_cache();
        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors.join("; "))
        }
    }
}

pub(crate) fn is_profile_mutation_channel(channel: &str) -> bool {
    matches!(
        channel,
        "setProfileConfig"
            | "setProfileMergeTargets"
            | "changeCurrentProfile"
            | "setActiveProfiles"
            | "addProfileItem"
            | "updateProfileItem"
            | "removeProfileItem"
            | "setProfileStr"
            | "setOverrideConfig"
            | "addOverrideItem"
            | "updateOverrideItem"
            | "removeOverrideItem"
            | "rollbackOverride"
            | "setOverride"
    )
}

pub(crate) fn with_profile_mutation<T>(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    action: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let _guard = state
        .profile_mutation_lock
        .lock()
        .map_err(|e| e.to_string())?;
    let snapshot = ProfileStorageSnapshot::capture(&app_storage_root(app)?)?;
    let (was_running, previous_runtime) = {
        let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
        (
            runtime.controller_url.is_some(),
            runtime
                .cached_runtime_config
                .as_ref()
                .map(|cached| (cached.path.clone(), cached.value.clone())),
        )
    };
    match action() {
        Ok(value) => Ok(value),
        Err(mut error) => {
            if let Err(restore_error) = snapshot.restore() {
                return Err(format!("{error}; 恢复订阅和覆写失败: {restore_error}"));
            }
            let (is_running, current_runtime) = {
                let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
                (
                    runtime.controller_url.is_some(),
                    runtime
                        .cached_runtime_config
                        .as_ref()
                        .map(|cached| (cached.path.clone(), cached.value.clone())),
                )
            };
            if was_running && (!is_running || current_runtime != previous_runtime) {
                if let Err(restore_error) = restart_core_and_emit(app, state) {
                    error = format!("{error}; 恢复旧内核失败: {restore_error}");
                }
            } else if !was_running && is_running {
                if let Err(stop_error) = stop_core_process(app, state) {
                    error = format!("{error}; 停止失败的内核失败: {stop_error}");
                }
            }
            emit_ipc_event(app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Err(error)
        }
    }
}
