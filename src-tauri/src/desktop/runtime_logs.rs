use super::prelude::*;
use super::*;

pub(crate) fn read_max_log_days(app: &tauri::AppHandle) -> u64 {
    read_app_config_store(app)
        .ok()
        .map(|config| json_u64(config.get("maxLogDays")))
        .filter(|days| *days > 0)
        .map(|days| days.min(3650))
        .unwrap_or(7)
}

pub(crate) fn runtime_log_archive_path(log_path: &Path) -> Option<PathBuf> {
    let parent = log_path.parent()?;
    let timestamp = current_local_timestamp_string();

    for suffix in 0..100 {
        let file_name = if suffix == 0 {
            format!("mihomo-{timestamp}.log")
        } else {
            format!("mihomo-{timestamp}-{suffix}.log")
        };
        let archive_path = parent.join(file_name);
        if !archive_path.exists() {
            return Some(archive_path);
        }
    }

    Some(parent.join(format!("mihomo-{}.log", current_timestamp_ms())))
}

pub(crate) fn archive_current_runtime_log(log_path: &Path) {
    let Ok(metadata) = fs::metadata(log_path) else {
        return;
    };
    if !metadata.is_file() || metadata.len() == 0 {
        return;
    }

    let Some(archive_path) = runtime_log_archive_path(log_path) else {
        return;
    };

    if let Err(error) = fs::rename(log_path, &archive_path) {
        eprintln!(
            "[desktop.log] failed to rotate {} to {}: {}",
            log_path.display(),
            archive_path.display(),
            error
        );
    }
}

pub(crate) fn cleanup_old_runtime_logs(logs_dir: &Path, max_log_days: u64) {
    let Some(cutoff) =
        SystemTime::now().checked_sub(Duration::from_secs(max_log_days.saturating_mul(86_400)))
    else {
        return;
    };

    let Ok(entries) = fs::read_dir(logs_dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !file_name.starts_with("mihomo-") || !file_name.ends_with(".log") {
            continue;
        }

        let is_expired = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .map(|modified| modified < cutoff)
            .unwrap_or(false);
        if is_expired {
            let _ = fs::remove_file(path);
        }
    }
}

pub(crate) fn prepare_runtime_log_file(app: &tauri::AppHandle, log_path: &Path) {
    let max_log_days = read_max_log_days(app);
    archive_current_runtime_log(log_path);
    if let Some(logs_dir) = log_path.parent() {
        cleanup_old_runtime_logs(logs_dir, max_log_days);
    }
}
