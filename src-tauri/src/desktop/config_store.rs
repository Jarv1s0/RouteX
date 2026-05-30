use super::prelude::*;
use super::*;

pub(crate) fn read_value_store(
    app: &tauri::AppHandle,
    file_name: &str,
    default: Value,
) -> Result<Value, String> {
    let path = storage_file(app, file_name)?;
    Ok(read_json_file(&path)?.unwrap_or(default))
}

pub(crate) fn write_value_store(
    app: &tauri::AppHandle,
    file_name: &str,
    value: &Value,
) -> Result<(), String> {
    let path = storage_file(app, file_name)?;
    write_json_file(&path, value)
}

pub(crate) fn read_traffic_stats_store(
    app: &tauri::AppHandle,
) -> Result<TrafficStatsStore, String> {
    let path = storage_file(app, TRAFFIC_STATS_FILE)?;
    Ok(read_json_file(&path)?.unwrap_or_default())
}

pub(crate) fn write_traffic_stats_store(
    app: &tauri::AppHandle,
    stats: &TrafficStatsStore,
) -> Result<(), String> {
    let path = storage_file(app, TRAFFIC_STATS_FILE)?;
    write_json_file(&path, stats)
}

pub(crate) fn initialize_traffic_stats_store(app: &tauri::AppHandle) -> Result<(), String> {
    let mut stats = read_traffic_stats_store(app)?;
    stats.session_upload = 0;
    stats.session_download = 0;
    stats.last_update = current_timestamp_ms();
    write_traffic_stats_store(app, &stats)
}

pub(crate) fn trim_recent_records<T>(records: &mut Vec<T>, max_len: usize) {
    if records.len() > max_len {
        let keep_from = records.len().saturating_sub(max_len);
        records.drain(0..keep_from);
    }
}

pub(crate) fn accumulate_hourly_traffic_record(
    records: &mut Vec<TrafficHourlyStats>,
    hour_key: &str,
    upload: u64,
    download: u64,
) {
    if let Some(record) = records.iter_mut().find(|item| item.hour == hour_key) {
        record.upload += upload;
        record.download += download;
        return;
    }

    records.push(TrafficHourlyStats {
        hour: hour_key.to_string(),
        upload,
        download,
    });
    trim_recent_records(records, MAX_TRAFFIC_HOURLY_RECORDS);
}

pub(crate) fn accumulate_daily_traffic_record(
    records: &mut Vec<TrafficDailyStats>,
    date_key: &str,
    upload: u64,
    download: u64,
) {
    if let Some(record) = records.iter_mut().find(|item| item.date == date_key) {
        record.upload += upload;
        record.download += download;
        return;
    }

    records.push(TrafficDailyStats {
        date: date_key.to_string(),
        upload,
        download,
    });
    trim_recent_records(records, MAX_TRAFFIC_DAILY_RECORDS);
}

pub(crate) fn record_traffic_sample(
    app: &tauri::AppHandle,
    sample: TrafficSampleInput,
) -> Result<TrafficStatsStore, String> {
    let Some(hour_key) = sample.hour.filter(|value| !value.trim().is_empty()) else {
        return read_traffic_stats_store(app);
    };
    let Some(date_key) = sample.date.filter(|value| !value.trim().is_empty()) else {
        return read_traffic_stats_store(app);
    };

    let upload = sample.up.unwrap_or(0);
    let download = sample.down.unwrap_or(0);
    let mut stats = read_traffic_stats_store(app)?;

    accumulate_hourly_traffic_record(&mut stats.hourly, &hour_key, upload, download);
    accumulate_daily_traffic_record(&mut stats.daily, &date_key, upload, download);

    stats.session_upload += upload;
    stats.session_download += download;
    stats.last_update = sample.timestamp.unwrap_or_else(current_timestamp_ms);

    write_traffic_stats_store(app, &stats)?;
    Ok(stats)
}

pub(crate) fn clear_traffic_stats_store(app: &tauri::AppHandle) -> Result<(), String> {
    write_traffic_stats_store(app, &TrafficStatsStore::default())
}

pub(crate) fn read_app_config_store(app: &tauri::AppHandle) -> Result<Value, String> {
    read_value_store(app, APP_CONFIG_FILE, json!({}))
}

pub(crate) fn patch_app_config_store(
    app: &tauri::AppHandle,
    patch: &Value,
) -> Result<Value, String> {
    let mut value = read_app_config_store(app)?;
    merge_json(&mut value, patch);
    invalidate_profile_runtime_config_cache_after(
        write_value_store(app, APP_CONFIG_FILE, &value).map(|_| value),
    )
}

pub(crate) fn patch_requires_shell_surface_sync(patch: &Value) -> bool {
    let Some(patch_map) = patch.as_object() else {
        return false;
    };

    [
        "disableTray",
        "showFloatingWindow",
        "proxyInTray",
        "language",
    ]
    .iter()
    .any(|key| patch_map.contains_key(*key))
        || patch_map.contains_key("sysProxy")
        || (cfg!(target_os = "macos") && patch_map.contains_key("showTraffic"))
}

pub(crate) fn read_connection_interval_ms(app: &tauri::AppHandle) -> u64 {
    read_app_config_store(app)
        .ok()
        .and_then(|config| config.get("connectionInterval").and_then(Value::as_u64))
        .map(|value| value.max(MIN_CONNECTION_INTERVAL_MS))
        .unwrap_or(MIN_CONNECTION_INTERVAL_MS)
}

pub(crate) fn read_controlled_config_store(app: &tauri::AppHandle) -> Result<Value, String> {
    read_value_store(app, CONTROLLED_CONFIG_FILE, json!({}))
}

pub(crate) fn patch_controlled_config_store(
    app: &tauri::AppHandle,
    patch: &Value,
) -> Result<Value, String> {
    let mut value = read_controlled_config_store(app)?;
    let app_config = read_app_config_store(app)?;
    let control_dns = app_config
        .get("controlDns")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let control_sniff = app_config
        .get("controlSniff")
        .and_then(Value::as_bool)
        .unwrap_or(true);

    if let Some(object) = value.as_object_mut() {
        if !control_dns {
            object.remove("dns");
            object.remove("hosts");
        }
        if !control_sniff {
            object.remove("sniffer");
        }
    }

    merge_json(&mut value, patch);

    if let Some(object) = value.as_object_mut() {
        if !control_dns {
            object.remove("dns");
            object.remove("hosts");
        }
        if !control_sniff {
            object.remove("sniffer");
        }
    }

    invalidate_profile_runtime_config_cache_after(
        write_value_store(app, CONTROLLED_CONFIG_FILE, &value).map(|_| value),
    )
}

pub(crate) fn read_profile_config(app: &tauri::AppHandle) -> Result<ProfileConfigData, String> {
    let path = storage_file(app, PROFILE_CONFIG_FILE)?;
    Ok(normalize_profile_config(
        read_json_file(&path)?.unwrap_or_default(),
    ))
}

pub(crate) fn write_profile_config(
    app: &tauri::AppHandle,
    config: &ProfileConfigData,
) -> Result<(), String> {
    let path = storage_file(app, PROFILE_CONFIG_FILE)?;
    let normalized = normalize_profile_config(config.clone());
    invalidate_profile_runtime_config_cache_after(write_json_file(&path, &normalized))
}

pub(crate) fn read_override_config(app: &tauri::AppHandle) -> Result<OverrideConfigData, String> {
    let path = storage_file(app, OVERRIDE_CONFIG_FILE)?;
    Ok(read_json_file(&path)?.unwrap_or_default())
}

pub(crate) fn write_override_config(
    app: &tauri::AppHandle,
    config: &OverrideConfigData,
) -> Result<(), String> {
    let path = storage_file(app, OVERRIDE_CONFIG_FILE)?;
    invalidate_profile_runtime_config_cache_after(write_json_file(&path, config))
}

pub(crate) fn read_chains_config(app: &tauri::AppHandle) -> Result<ChainsConfigData, String> {
    let path = storage_file(app, CHAINS_CONFIG_FILE)?;
    Ok(read_json_file(&path)?.unwrap_or_default())
}

pub(crate) fn write_chains_config(
    app: &tauri::AppHandle,
    config: &ChainsConfigData,
) -> Result<(), String> {
    let path = storage_file(app, CHAINS_CONFIG_FILE)?;
    invalidate_profile_runtime_config_cache_after(write_json_file(&path, config))
}
