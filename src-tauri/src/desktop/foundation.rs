fn tauri_build_variant() -> &'static str {
    match option_env!("ROUTEX_TAURI_BUILD_VARIANT") {
        Some("dev") => "dev",
        Some("autobuild") => "autobuild",
        Some("release") => "release",
        Some(value) if !value.trim().is_empty() => value,
        _ if cfg!(debug_assertions) => "dev",
        _ => "release",
    }
}

fn global_shortcut_plugin_enabled() -> bool {
    true
}

#[cfg(target_os = "windows")]
fn primary_tauri_app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let default_root = default_app_data_root(app)?;
    Ok(std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|base| base.join(WINDOWS_APP_DATA_DIR_NAME))
        .or_else(|| {
            default_root
                .parent()
                .map(|parent| parent.join(WINDOWS_APP_DATA_DIR_NAME))
        })
        .unwrap_or(default_root))
}

#[cfg(not(target_os = "windows"))]
fn primary_tauri_app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    default_app_data_root(app)
}

#[cfg(target_os = "windows")]
fn routex_run_task_name() -> &'static str {
    match tauri_build_variant() {
        "dev" => "routex-run-dev",
        "autobuild" => "routex-run-autobuild",
        _ => ROUTEX_RUN_TASK_NAME,
    }
}

#[cfg(target_os = "windows")]
fn routex_autorun_task_name() -> &'static str {
    match tauri_build_variant() {
        "dev" => "routex-dev",
        "autobuild" => "routex-autobuild",
        _ => ROUTEX_AUTORUN_TASK_NAME,
    }
}

fn platform_name() -> &'static str {
    match std::env::consts::OS {
        "windows" => "win32",
        "macos" => "darwin",
        other => other,
    }
}

fn apply_window_theme(_window: &tauri::WebviewWindow, theme: Option<&str>) {
    let _ = theme;
}

fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn runtime_tun_enabled(runtime_config: &Value) -> bool {
    runtime_config
        .get("tun")
        .and_then(Value::as_object)
        .and_then(|tun| tun.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn runtime_config_modified_at_ms(path: &Path) -> Option<u64> {
    fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as u64)
}

fn profile_runtime_config_cache() -> &'static Mutex<Option<Value>> {
    PROFILE_RUNTIME_CONFIG_CACHE.get_or_init(|| Mutex::new(None))
}

fn read_cached_profile_runtime_config() -> Option<Value> {
    profile_runtime_config_cache()
        .lock()
        .ok()
        .and_then(|cache| cache.clone())
}

fn write_cached_profile_runtime_config(value: &Value) {
    if let Ok(mut cache) = profile_runtime_config_cache().lock() {
        *cache = Some(value.clone());
    }
}

fn invalidate_profile_runtime_config_cache() {
    if let Ok(mut cache) = profile_runtime_config_cache().lock() {
        *cache = None;
    }
}

fn invalidate_profile_runtime_config_cache_after<T>(
    result: Result<T, String>,
) -> Result<T, String> {
    let value = result?;
    invalidate_profile_runtime_config_cache();
    Ok(value)
}

fn mihomo_http_client() -> Result<&'static Client, String> {
    match MIHOMO_HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())
    }) {
        Ok(client) => Ok(client),
        Err(error) => Err(error.clone()),
    }
}

fn current_local_date_string() -> String {
    OffsetDateTime::now_local()
        .unwrap_or_else(|_| OffsetDateTime::now_utc())
        .format(&format_description!("[year]-[month]-[day]"))
        .unwrap_or_else(|_| "1970-01-01".to_string())
}

fn current_local_timestamp_string() -> String {
    OffsetDateTime::now_local()
        .unwrap_or_else(|_| OffsetDateTime::now_utc())
        .format(&format_description!(
            "[year]-[month]-[day]-[hour][minute][second]"
        ))
        .unwrap_or_else(|_| current_timestamp_ms().to_string())
}

fn get_app_memory_value() -> u64 {
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = powershell_command()
            .args([
                "-NoProfile",
                "-Command",
                &format!("(Get-Process -Id {}).WorkingSet64", std::process::id()),
            ])
            .output()
        {
            if output.status.success() {
                if let Ok(value) = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .parse::<u64>()
                {
                    return value;
                }
            }
        }
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        if let Ok(output) = Command::new("ps")
            .args(["-o", "rss=", "-p", &std::process::id().to_string()])
            .output()
        {
            if output.status.success() {
                if let Ok(value) = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .parse::<u64>()
                {
                    return value.saturating_mul(1024);
                }
            }
        }
    }

    0
}

fn default_sysproxy_bypass() -> Vec<String> {
    if cfg!(target_os = "linux") {
        return vec![
            "localhost".to_string(),
            ".local".to_string(),
            "127.0.0.1/8".to_string(),
            "192.168.0.0/16".to_string(),
            "10.0.0.0/8".to_string(),
            "172.16.0.0/12".to_string(),
            "::1".to_string(),
        ];
    }

    if cfg!(target_os = "macos") {
        return vec![
            "127.0.0.1/8".to_string(),
            "192.168.0.0/16".to_string(),
            "10.0.0.0/8".to_string(),
            "172.16.0.0/12".to_string(),
            "localhost".to_string(),
            "*.local".to_string(),
            "*.crashlytics.com".to_string(),
            "<local>".to_string(),
        ];
    }

    vec![
        "localhost".to_string(),
        "127.*".to_string(),
        "192.168.*".to_string(),
        "10.*".to_string(),
        "172.16.*".to_string(),
        "172.17.*".to_string(),
        "172.18.*".to_string(),
        "172.19.*".to_string(),
        "172.20.*".to_string(),
        "172.21.*".to_string(),
        "172.22.*".to_string(),
        "172.23.*".to_string(),
        "172.24.*".to_string(),
        "172.25.*".to_string(),
        "172.26.*".to_string(),
        "172.27.*".to_string(),
        "172.28.*".to_string(),
        "172.29.*".to_string(),
        "172.30.*".to_string(),
        "172.31.*".to_string(),
        "<local>".to_string(),
    ]
}

fn json_array_strings(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn create_id() -> String {
    format!("{:x}", current_timestamp_ms())
}

fn default_empty_profile_item() -> ProfileItemData {
    ProfileItemData {
        id: "default".to_string(),
        item_type: "local".to_string(),
        name: "空白订阅".to_string(),
        url: None,
        fingerprint: None,
        ua: None,
        file: None,
        verify: None,
        interval: None,
        home: None,
        updated: None,
        override_ids: None,
        use_proxy: None,
        extra: None,
        reset_day: None,
        locked: None,
        auto_update: Some(true),
    }
}

fn dedupe_ids(ids: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();

    for id in ids {
        if id.trim().is_empty() {
            continue;
        }

        if seen.insert(id.clone()) {
            result.push(id);
        }
    }

    result
}

fn normalize_profile_config(mut config: ProfileConfigData) -> ProfileConfigData {
    let valid_ids = config
        .items
        .iter()
        .map(|item| item.id.clone())
        .collect::<HashSet<_>>();

    let current = config
        .current
        .as_ref()
        .filter(|id| valid_ids.contains(*id))
        .cloned();

    let mut actives = dedupe_ids(config.actives.unwrap_or_default())
        .into_iter()
        .filter(|id| valid_ids.contains(id))
        .collect::<Vec<_>>();

    let next_current = if let Some(current) = current {
        if !actives.contains(&current) {
            actives.insert(0, current.clone());
        }
        Some(current)
    } else if let Some(first_active) = actives.first().cloned() {
        Some(first_active)
    } else {
        config.items.first().map(|item| item.id.clone())
    };

    if let Some(current) = next_current.as_ref() {
        if !actives.contains(current) {
            actives.insert(0, current.clone());
        }
    }

    config.current = next_current;
    config.actives = if actives.is_empty() {
        None
    } else {
        Some(actives)
    };
    config
}

fn default_app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

fn ensure_dir(path: PathBuf) -> Result<PathBuf, String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

fn copy_path_if_missing(source: &Path, target: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }

    if source.is_dir() {
        fs::create_dir_all(target).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            copy_path_if_missing(&entry.path(), &target.join(entry.file_name()))?;
        }
        return Ok(());
    }

    if target.exists() {
        return Ok(());
    }

    ensure_parent(target)?;
    fs::copy(source, target)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn migrate_tauri_app_data_root_if_needed(
    source_root: &Path,
    target_root: &Path,
) -> Result<(), String> {
    if source_root == target_root || !source_root.exists() {
        return Ok(());
    }

    let target_store = target_root.join(ROUTEX_STORE_DIR_NAME);
    let target_core = target_root.join(MIHOMO_RUNTIME_DIR_NAME);
    if target_store.exists() && target_core.exists() {
        return Ok(());
    }

    fs::create_dir_all(target_root).map_err(|e| e.to_string())?;

    for entry_name in [
        ROUTEX_STORE_DIR_NAME,
        MIHOMO_RUNTIME_DIR_NAME,
        UPDATES_DIR_NAME,
        TASKS_DIR_NAME,
        RUNTIME_ASSETS_DIR_NAME,
    ] {
        copy_path_if_missing(&source_root.join(entry_name), &target_root.join(entry_name))?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let default_root = default_app_data_root(app)?;
    let primary_root = primary_tauri_app_data_root(app)?;
    migrate_tauri_app_data_root_if_needed(&default_root, &primary_root)?;
    ensure_dir(primary_root)
}

#[cfg(not(target_os = "windows"))]
fn app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    ensure_dir(primary_tauri_app_data_root(app)?)
}

fn app_storage_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    ensure_dir(app_data_root(app)?.join(ROUTEX_STORE_DIR_NAME))
}

fn storage_file(app: &tauri::AppHandle, file_name: &str) -> Result<PathBuf, String> {
    Ok(app_storage_root(app)?.join(file_name))
}

fn storage_dir(app: &tauri::AppHandle, dir_name: &str) -> Result<PathBuf, String> {
    ensure_dir(app_storage_root(app)?.join(dir_name))
}

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn read_json_file<T: DeserializeOwned>(path: &Path) -> Result<Option<T>, String> {
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

fn write_json_file<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    ensure_parent(path)?;
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

fn read_floating_window_state(
    app: &tauri::AppHandle,
) -> Result<Option<FloatingWindowState>, String> {
    let path = storage_file(app, FLOATING_WINDOW_STATE_FILE)?;
    read_json_file(&path)
}

fn write_floating_window_state(
    app: &tauri::AppHandle,
    state: &FloatingWindowState,
) -> Result<(), String> {
    let path = storage_file(app, FLOATING_WINDOW_STATE_FILE)?;
    write_json_file(&path, state)
}

fn merge_json(base: &mut Value, patch: &Value) {
    match (base, patch) {
        (Value::Object(base_map), Value::Object(patch_map)) => {
            for (key, value) in patch_map {
                if value.is_null() {
                    base_map.remove(key);
                    continue;
                }

                if let Some(base_value) = base_map.get_mut(key) {
                    merge_json(base_value, value);
                } else {
                    base_map.insert(key.clone(), value.clone());
                }
            }
        }
        (base_value, patch_value) => {
            *base_value = patch_value.clone();
        }
    }
}

fn trim_wrapped_key(key: &str) -> &str {
    if key.starts_with('<') && key.ends_with('>') && key.len() > 2 {
        &key[1..key.len() - 1]
    } else {
        key
    }
}

fn merge_config_value(base: &mut Value, patch: &Value, is_override: bool) {
    match patch {
        Value::Object(patch_map) => {
            if !base.is_object() {
                *base = json!({});
            }

            let Some(base_map) = base.as_object_mut() else {
                *base = patch.clone();
                return;
            };

            for (raw_key, value) in patch_map {
                if is_override && value.is_object() && raw_key.ends_with('!') {
                    let key = trim_wrapped_key(&raw_key[..raw_key.len() - 1]).to_string();
                    base_map.insert(key, value.clone());
                    continue;
                }

                if is_override && value.is_array() && raw_key.starts_with('+') {
                    let key = trim_wrapped_key(&raw_key[1..]).to_string();
                    let mut merged = value.as_array().cloned().unwrap_or_default();
                    let existing = base_map
                        .get(&key)
                        .and_then(Value::as_array)
                        .cloned()
                        .unwrap_or_default();
                    merged.extend(existing);
                    base_map.insert(key, Value::Array(merged));
                    continue;
                }

                if is_override && value.is_array() && raw_key.ends_with('+') {
                    let key = trim_wrapped_key(&raw_key[..raw_key.len() - 1]).to_string();
                    let mut merged = base_map
                        .get(&key)
                        .and_then(Value::as_array)
                        .cloned()
                        .unwrap_or_default();
                    merged.extend(value.as_array().cloned().unwrap_or_default());
                    base_map.insert(key, Value::Array(merged));
                    continue;
                }

                let key = trim_wrapped_key(raw_key).to_string();
                if let Some(base_value) = base_map.get_mut(&key) {
                    merge_config_value(base_value, value, is_override);
                } else {
                    base_map.insert(key, value.clone());
                }
            }
        }
        _ => {
            *base = patch.clone();
        }
    }
}

fn read_value_store(
    app: &tauri::AppHandle,
    file_name: &str,
    default: Value,
) -> Result<Value, String> {
    let path = storage_file(app, file_name)?;
    Ok(read_json_file(&path)?.unwrap_or(default))
}

fn write_value_store(app: &tauri::AppHandle, file_name: &str, value: &Value) -> Result<(), String> {
    let path = storage_file(app, file_name)?;
    write_json_file(&path, value)
}

fn read_traffic_stats_store(app: &tauri::AppHandle) -> Result<TrafficStatsStore, String> {
    let path = storage_file(app, TRAFFIC_STATS_FILE)?;
    Ok(read_json_file(&path)?.unwrap_or_default())
}

fn write_traffic_stats_store(
    app: &tauri::AppHandle,
    stats: &TrafficStatsStore,
) -> Result<(), String> {
    let path = storage_file(app, TRAFFIC_STATS_FILE)?;
    write_json_file(&path, stats)
}

fn initialize_traffic_stats_store(app: &tauri::AppHandle) -> Result<(), String> {
    let mut stats = read_traffic_stats_store(app)?;
    stats.session_upload = 0;
    stats.session_download = 0;
    stats.last_update = current_timestamp_ms();
    write_traffic_stats_store(app, &stats)
}

fn trim_recent_records<T>(records: &mut Vec<T>, max_len: usize) {
    if records.len() > max_len {
        let keep_from = records.len().saturating_sub(max_len);
        records.drain(0..keep_from);
    }
}

fn accumulate_hourly_traffic_record(
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

fn accumulate_daily_traffic_record(
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

fn record_traffic_sample(
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

fn clear_traffic_stats_store(app: &tauri::AppHandle) -> Result<(), String> {
    write_traffic_stats_store(app, &TrafficStatsStore::default())
}

fn read_app_config_store(app: &tauri::AppHandle) -> Result<Value, String> {
    read_value_store(app, APP_CONFIG_FILE, json!({}))
}

fn patch_app_config_store(app: &tauri::AppHandle, patch: &Value) -> Result<Value, String> {
    let mut value = read_app_config_store(app)?;
    merge_json(&mut value, patch);
    invalidate_profile_runtime_config_cache_after(
        write_value_store(app, APP_CONFIG_FILE, &value).map(|_| value),
    )
}

fn patch_requires_shell_surface_sync(patch: &Value) -> bool {
    let Some(patch_map) = patch.as_object() else {
        return false;
    };

    ["disableTray", "showFloatingWindow", "proxyInTray"]
        .iter()
        .any(|key| patch_map.contains_key(*key))
        || patch_map.contains_key("sysProxy")
        || (cfg!(target_os = "macos") && patch_map.contains_key("showTraffic"))
}

fn read_connection_interval_ms(app: &tauri::AppHandle) -> u64 {
    read_app_config_store(app)
        .ok()
        .and_then(|config| config.get("connectionInterval").and_then(Value::as_u64))
        .map(|value| value.max(MIN_CONNECTION_INTERVAL_MS))
        .unwrap_or(MIN_CONNECTION_INTERVAL_MS)
}

fn read_controlled_config_store(app: &tauri::AppHandle) -> Result<Value, String> {
    read_value_store(app, CONTROLLED_CONFIG_FILE, json!({}))
}

fn patch_controlled_config_store(app: &tauri::AppHandle, patch: &Value) -> Result<Value, String> {
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

fn read_profile_config(app: &tauri::AppHandle) -> Result<ProfileConfigData, String> {
    let path = storage_file(app, PROFILE_CONFIG_FILE)?;
    Ok(normalize_profile_config(
        read_json_file(&path)?.unwrap_or_default(),
    ))
}

fn write_profile_config(app: &tauri::AppHandle, config: &ProfileConfigData) -> Result<(), String> {
    let path = storage_file(app, PROFILE_CONFIG_FILE)?;
    let normalized = normalize_profile_config(config.clone());
    invalidate_profile_runtime_config_cache_after(write_json_file(&path, &normalized))
}

fn read_override_config(app: &tauri::AppHandle) -> Result<OverrideConfigData, String> {
    let path = storage_file(app, OVERRIDE_CONFIG_FILE)?;
    Ok(read_json_file(&path)?.unwrap_or_default())
}

fn write_override_config(
    app: &tauri::AppHandle,
    config: &OverrideConfigData,
) -> Result<(), String> {
    let path = storage_file(app, OVERRIDE_CONFIG_FILE)?;
    invalidate_profile_runtime_config_cache_after(write_json_file(&path, config))
}

fn read_chains_config(app: &tauri::AppHandle) -> Result<ChainsConfigData, String> {
    let path = storage_file(app, CHAINS_CONFIG_FILE)?;
    Ok(read_json_file(&path)?.unwrap_or_default())
}

fn write_chains_config(app: &tauri::AppHandle, config: &ChainsConfigData) -> Result<(), String> {
    let path = storage_file(app, CHAINS_CONFIG_FILE)?;
    invalidate_profile_runtime_config_cache_after(write_json_file(&path, config))
}

fn default_quick_rules_config() -> QuickRulesConfigData {
    QuickRulesConfigData {
        version: 1,
        migrated_legacy_quick_rules: false,
        profiles: HashMap::new(),
    }
}

fn normalize_quick_rule(rule: QuickRule) -> Option<QuickRule> {
    if rule.id.trim().is_empty()
        || rule.rule_type.trim().is_empty()
        || rule.value.trim().is_empty()
        || rule.target.trim().is_empty()
    {
        return None;
    }

    Some(QuickRule {
        id: rule.id,
        rule_type: rule.rule_type,
        value: rule.value,
        target: rule.target,
        no_resolve: rule.no_resolve,
        enabled: rule.enabled,
        source: if rule.source == "connection" {
            "connection".to_string()
        } else {
            "manual".to_string()
        },
        created_at: rule.created_at,
        updated_at: rule.updated_at,
    })
}

fn normalize_quick_rules_config(mut config: QuickRulesConfigData) -> QuickRulesConfigData {
    config.version = 1;
    config.profiles = config
        .profiles
        .into_iter()
        .map(|(profile_id, profile)| {
            let rules = profile
                .rules
                .into_iter()
                .filter_map(normalize_quick_rule)
                .collect::<Vec<_>>();
            (
                profile_id,
                QuickRuleProfileConfig {
                    enabled: profile.enabled,
                    rules,
                },
            )
        })
        .collect();
    config
}

fn quick_rule_string(rule: &QuickRule) -> String {
    let mut text = format!("{},{},{}", rule.rule_type, rule.value, rule.target);
    if rule.no_resolve.unwrap_or(false) {
        text.push_str(",no-resolve");
    }
    text
}

fn parse_quick_rule_string(raw: &str) -> Option<QuickRuleInput> {
    let parts = raw
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    if parts.len() < 3 {
        return None;
    }

    Some(QuickRuleInput {
        id: None,
        rule_type: Some(parts[0].to_string()),
        value: Some(parts[1].to_string()),
        target: Some(parts[2].to_string()),
        no_resolve: Some(parts.get(3).copied() == Some("no-resolve")),
        enabled: Some(true),
        source: Some("connection".to_string()),
    })
}

fn parse_legacy_quick_rules(content: &str) -> Vec<QuickRuleInput> {
    content
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            trimmed
                .strip_prefix("- ")
                .and_then(|rule| parse_quick_rule_string(rule.trim()))
        })
        .collect()
}

fn ensure_quick_rule_profile_mut<'a>(
    config: &'a mut QuickRulesConfigData,
    profile_id: &str,
) -> &'a mut QuickRuleProfileConfig {
    config
        .profiles
        .entry(profile_id.to_string())
        .or_insert_with(|| QuickRuleProfileConfig {
            enabled: true,
            rules: Vec::new(),
        })
}

fn read_quick_rules_config_raw(app: &tauri::AppHandle) -> Result<QuickRulesConfigData, String> {
    let path = storage_file(app, QUICK_RULES_CONFIG_FILE)?;
    Ok(normalize_quick_rules_config(
        read_json_file(&path)?.unwrap_or_else(default_quick_rules_config),
    ))
}

fn write_quick_rules_config(
    app: &tauri::AppHandle,
    config: &QuickRulesConfigData,
) -> Result<(), String> {
    let path = storage_file(app, QUICK_RULES_CONFIG_FILE)?;
    let normalized = normalize_quick_rules_config(config.clone());
    invalidate_profile_runtime_config_cache_after(write_json_file(&path, &normalized))
}

fn quick_rule_from_input(
    input: QuickRuleInput,
    fallback_index: usize,
) -> Result<QuickRule, String> {
    let now = current_timestamp_ms();
    let rule_type = input
        .rule_type
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Quick rule type is required".to_string())?;
    let value = input
        .value
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Quick rule value is required".to_string())?;
    let target = input
        .target
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Quick rule target is required".to_string())?;

    Ok(QuickRule {
        id: input
            .id
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| format!("{:x}-{fallback_index:x}", now)),
        rule_type,
        value,
        target,
        no_resolve: Some(input.no_resolve.unwrap_or(false)),
        enabled: input.enabled.unwrap_or(true),
        source: input.source.unwrap_or_else(|| "manual".to_string()),
        created_at: now,
        updated_at: now,
    })
}

fn migrate_legacy_quick_rules_if_needed(
    app: &tauri::AppHandle,
    config: &mut QuickRulesConfigData,
) -> Result<(), String> {
    const LEGACY_QUICK_RULES_ID: &str = "quick-rules";
    if config.migrated_legacy_quick_rules {
        return Ok(());
    }

    let override_config = read_override_config(app)?;
    let Some(legacy_item) = override_config
        .items
        .iter()
        .find(|item| item.id == LEGACY_QUICK_RULES_ID)
    else {
        config.migrated_legacy_quick_rules = true;
        write_quick_rules_config(app, config)?;
        return Ok(());
    };

    let legacy_content = read_override_text(app, LEGACY_QUICK_RULES_ID, &legacy_item.ext)?;
    let legacy_rules = parse_legacy_quick_rules(&legacy_content);
    let mut profile_config = read_profile_config(app)?;
    let mut profile_config_changed = false;

    if !legacy_rules.is_empty() {
        let target_profile_ids = profile_config
            .items
            .iter()
            .filter(|profile| {
                profile
                    .override_ids
                    .as_ref()
                    .map(|ids| ids.iter().any(|id| id == LEGACY_QUICK_RULES_ID))
                    .unwrap_or(false)
            })
            .map(|profile| profile.id.clone())
            .collect::<Vec<_>>();

        for profile_id in target_profile_ids {
            let profile_rules = ensure_quick_rule_profile_mut(config, &profile_id);
            let mut existing = profile_rules
                .rules
                .iter()
                .map(quick_rule_string)
                .collect::<HashSet<_>>();
            for legacy_rule in legacy_rules.iter().cloned() {
                let rule = quick_rule_from_input(legacy_rule, profile_rules.rules.len())?;
                let rule_string = quick_rule_string(&rule);
                if existing.insert(rule_string) {
                    profile_rules.rules.push(rule);
                }
            }
        }
    }

    for profile in &mut profile_config.items {
        let Some(ids) = profile.override_ids.as_mut() else {
            continue;
        };
        let before_len = ids.len();
        ids.retain(|id| id != LEGACY_QUICK_RULES_ID);
        if ids.len() != before_len {
            profile_config_changed = true;
        }
        if ids.is_empty() {
            profile.override_ids = None;
        }
    }

    if profile_config_changed {
        write_profile_config(app, &profile_config)?;
    }

    config.migrated_legacy_quick_rules = true;
    write_quick_rules_config(app, config)
}

fn read_quick_rules_config(app: &tauri::AppHandle) -> Result<QuickRulesConfigData, String> {
    let mut config = read_quick_rules_config_raw(app)?;
    migrate_legacy_quick_rules_if_needed(app, &mut config)?;
    Ok(config)
}

fn read_quick_rules(
    app: &tauri::AppHandle,
    profile_id: &str,
) -> Result<QuickRuleProfileConfig, String> {
    let mut config = read_quick_rules_config(app)?;
    Ok(ensure_quick_rule_profile_mut(&mut config, profile_id).clone())
}

fn add_quick_rule_store(
    app: &tauri::AppHandle,
    profile_id: &str,
    input: QuickRuleInput,
) -> Result<QuickRule, String> {
    let mut config = read_quick_rules_config(app)?;
    let profile = ensure_quick_rule_profile_mut(&mut config, profile_id);
    let rule = quick_rule_from_input(input, profile.rules.len())?;
    profile.rules.insert(0, rule.clone());
    write_quick_rules_config(app, &config)?;
    Ok(rule)
}

fn update_quick_rule_store(
    app: &tauri::AppHandle,
    profile_id: &str,
    rule_id: &str,
    patch: Value,
) -> Result<(), String> {
    let mut config = read_quick_rules_config(app)?;
    let profile = ensure_quick_rule_profile_mut(&mut config, profile_id);
    let rule = profile
        .rules
        .iter_mut()
        .find(|rule| rule.id == rule_id)
        .ok_or_else(|| "Quick rule not found".to_string())?;

    if let Some(value) = patch.get("type").and_then(Value::as_str) {
        rule.rule_type = value.to_string();
    }
    if let Some(value) = patch.get("value").and_then(Value::as_str) {
        rule.value = value.to_string();
    }
    if let Some(value) = patch.get("target").and_then(Value::as_str) {
        rule.target = value.to_string();
    }
    if let Some(value) = patch.get("noResolve").and_then(Value::as_bool) {
        rule.no_resolve = Some(value);
    }
    if let Some(value) = patch.get("enabled").and_then(Value::as_bool) {
        rule.enabled = value;
    }
    if let Some(value) = patch.get("source").and_then(Value::as_str) {
        rule.source = if value == "connection" {
            "connection".to_string()
        } else {
            "manual".to_string()
        };
    }
    rule.updated_at = current_timestamp_ms();
    write_quick_rules_config(app, &config)
}

fn remove_quick_rule_store(
    app: &tauri::AppHandle,
    profile_id: &str,
    rule_id: &str,
) -> Result<(), String> {
    let mut config = read_quick_rules_config(app)?;
    let profile = ensure_quick_rule_profile_mut(&mut config, profile_id);
    profile.rules.retain(|rule| rule.id != rule_id);
    write_quick_rules_config(app, &config)
}

fn set_quick_rules_enabled_store(
    app: &tauri::AppHandle,
    profile_id: &str,
    enabled: bool,
) -> Result<(), String> {
    let mut config = read_quick_rules_config(app)?;
    ensure_quick_rule_profile_mut(&mut config, profile_id).enabled = enabled;
    write_quick_rules_config(app, &config)
}

fn reorder_quick_rules_store(
    app: &tauri::AppHandle,
    profile_id: &str,
    rule_ids: &[String],
) -> Result<(), String> {
    let mut config = read_quick_rules_config(app)?;
    let profile = ensure_quick_rule_profile_mut(&mut config, profile_id);
    let mut rules_by_id = profile
        .rules
        .iter()
        .cloned()
        .map(|rule| (rule.id.clone(), rule))
        .collect::<HashMap<_, _>>();
    let mut ordered = Vec::new();
    for id in rule_ids {
        if let Some(rule) = rules_by_id.remove(id) {
            ordered.push(rule);
        }
    }
    ordered.extend(
        profile
            .rules
            .iter()
            .filter(|rule| rules_by_id.contains_key(&rule.id))
            .cloned(),
    );
    profile.rules = ordered;
    write_quick_rules_config(app, &config)
}

fn clear_quick_rules_store(app: &tauri::AppHandle, profile_id: &str) -> Result<(), String> {
    let mut config = read_quick_rules_config(app)?;
    ensure_quick_rule_profile_mut(&mut config, profile_id)
        .rules
        .clear();
    write_quick_rules_config(app, &config)
}

fn quick_rule_strings(
    app: &tauri::AppHandle,
    profile_id: Option<&str>,
) -> Result<Vec<String>, String> {
    let Some(profile_id) = profile_id else {
        return Ok(Vec::new());
    };
    let profile = read_quick_rules(app, profile_id)?;
    if !profile.enabled {
        return Ok(Vec::new());
    }
    Ok(profile
        .rules
        .iter()
        .filter(|rule| rule.enabled)
        .map(quick_rule_string)
        .collect())
}

fn inject_quick_rules(
    app: &tauri::AppHandle,
    profile_id: Option<&str>,
    profile: &mut Value,
) -> Result<(), String> {
    let rules = quick_rule_strings(app, profile_id)?;
    if rules.is_empty() {
        return Ok(());
    }

    if !profile.is_object() {
        *profile = json!({});
    }

    let Some(object) = profile.as_object_mut() else {
        return Ok(());
    };

    let mut merged = rules.into_iter().map(Value::String).collect::<Vec<_>>();
    let existing = object
        .get("rules")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    merged.extend(existing);
    object.insert("rules".to_string(), Value::Array(merged));
    Ok(())
}

fn read_provider_stats(app: &tauri::AppHandle) -> Result<ProviderStatsData, String> {
    let path = storage_file(app, PROVIDER_STATS_FILE)?;
    Ok(read_json_file(&path)?.unwrap_or_default())
}

fn write_provider_stats(app: &tauri::AppHandle, stats: &ProviderStatsData) -> Result<(), String> {
    let path = storage_file(app, PROVIDER_STATS_FILE)?;
    write_json_file(&path, stats)
}

fn profile_file_path(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
    Ok(storage_dir(app, PROFILE_DIR_NAME)?.join(format!("{id}.yaml")))
}

fn read_profile_text(app: &tauri::AppHandle, id: &str) -> Result<String, String> {
    let path = profile_file_path(app, id)?;
    if path.exists() {
        return fs::read_to_string(path).map_err(|e| e.to_string());
    }

    Ok(DEFAULT_PROFILE_TEXT.to_string())
}

fn write_profile_text(app: &tauri::AppHandle, id: &str, content: &str) -> Result<(), String> {
    let path = profile_file_path(app, id)?;
    ensure_parent(&path)?;
    invalidate_profile_runtime_config_cache_after(
        fs::write(path, content).map_err(|e| e.to_string()),
    )
}

fn override_file_path(app: &tauri::AppHandle, id: &str, ext: &str) -> Result<PathBuf, String> {
    Ok(storage_dir(app, OVERRIDE_DIR_NAME)?.join(format!("{id}.{ext}")))
}

fn override_rollback_path(app: &tauri::AppHandle, id: &str, ext: &str) -> Result<PathBuf, String> {
    Ok(storage_dir(app, OVERRIDE_DIR_NAME)?.join(format!("{id}.{ext}.rollback")))
}

fn read_override_text(app: &tauri::AppHandle, id: &str, ext: &str) -> Result<String, String> {
    let path = override_file_path(app, id, ext)?;
    if path.exists() {
        return fs::read_to_string(path).map_err(|e| e.to_string());
    }

    Ok(String::new())
}

fn write_override_text(
    app: &tauri::AppHandle,
    id: &str,
    ext: &str,
    content: &str,
) -> Result<(), String> {
    let path = override_file_path(app, id, ext)?;
    let rollback_path = override_rollback_path(app, id, ext)?;

    if path.exists() {
        let previous = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        if previous != content {
            ensure_parent(&rollback_path)?;
            fs::write(&rollback_path, previous).map_err(|e| e.to_string())?;
        }
    }

    ensure_parent(&path)?;
    invalidate_profile_runtime_config_cache_after(
        fs::write(path, content).map_err(|e| e.to_string()),
    )
}

fn rollback_override_text(app: &tauri::AppHandle, id: &str, ext: &str) -> Result<(), String> {
    let target_path = override_file_path(app, id, ext)?;
    let rollback_path = override_rollback_path(app, id, ext)?;

    if !rollback_path.exists() {
        return Err("当前覆写没有可回滚的上次内容".to_string());
    }

    let rollback_content = fs::read_to_string(&rollback_path).map_err(|e| e.to_string())?;
    if target_path.exists() {
        let current = fs::read_to_string(&target_path).map_err(|e| e.to_string())?;
        fs::write(&rollback_path, current).map_err(|e| e.to_string())?;
    }
    invalidate_profile_runtime_config_cache_after(
        fs::write(target_path, rollback_content).map_err(|e| e.to_string()),
    )
}

fn theme_file_path(app: &tauri::AppHandle, theme: &str) -> Result<PathBuf, String> {
    Ok(storage_dir(app, THEME_DIR_NAME)?.join(theme))
}

fn is_default_theme(theme: &str) -> bool {
    theme == DEFAULT_THEME_FILE_NAME
}

fn read_theme_text(app: &tauri::AppHandle, theme: &str) -> Result<String, String> {
    if is_default_theme(theme) {
        return Ok(String::new());
    }

    let path = theme_file_path(app, theme)?;
    if path.exists() {
        return fs::read_to_string(path).map_err(|e| e.to_string());
    }

    Ok(String::new())
}

fn write_theme_text(app: &tauri::AppHandle, theme: &str, css: &str) -> Result<(), String> {
    if is_default_theme(theme) {
        return Ok(());
    }

    let path = theme_file_path(app, theme)?;
    ensure_parent(&path)?;
    fs::write(path, css).map_err(|e| e.to_string())
}

fn theme_display_label(file_name: &str, content: &str) -> String {
    let first_line = content
        .strip_prefix('\u{feff}')
        .unwrap_or(content)
        .lines()
        .next()
        .unwrap_or_default()
        .trim();

    if let Some(comment) = first_line.strip_prefix("/*") {
        if let Some(end) = comment.find("*/") {
            let label = comment[..end].trim();
            if !label.is_empty() {
                return label.to_string();
            }
        }
    }

    file_name.to_string()
}

fn import_theme_files(app: &tauri::AppHandle, files: &[String]) -> Result<(), String> {
    let themes_dir = storage_dir(app, THEME_DIR_NAME)?;

    for (index, file) in files.iter().enumerate() {
        let source = PathBuf::from(file);
        if !source.exists() || !source.is_file() {
            continue;
        }

        let Some(file_name) = source.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !file_name.to_ascii_lowercase().ends_with(".css") {
            continue;
        }

        let target = themes_dir.join(format!(
            "{}-{}-{}",
            current_timestamp_ms(),
            index,
            file_name
        ));
        fs::copy(&source, target).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn resolve_theme_entries(app: &tauri::AppHandle) -> Result<Vec<Value>, String> {
    let themes_dir = storage_dir(app, THEME_DIR_NAME)?;
    let mut entries = Vec::new();

    if !themes_dir.exists() {
        fs::create_dir_all(&themes_dir).map_err(|e| e.to_string())?;
    }

    entries.push(json!({
        "key": DEFAULT_THEME_FILE_NAME,
        "label": "默认",
        "content": "",
    }));

    for entry in fs::read_dir(&themes_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };

        if !name.ends_with(".css") || is_default_theme(name) {
            continue;
        }

        let content = fs::read_to_string(&path).unwrap_or_default();
        let label = theme_display_label(name, &content);
        entries.push(json!({
            "key": name,
            "label": label,
            "content": content,
        }));
    }

    entries.sort_by(|left, right| {
        let left_key = left.get("key").and_then(Value::as_str).unwrap_or_default();
        let right_key = right.get("key").and_then(Value::as_str).unwrap_or_default();
        match (is_default_theme(left_key), is_default_theme(right_key)) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => left_key.cmp(right_key),
        }
    });

    Ok(entries)
}

fn fetch_theme_archive(app: &tauri::AppHandle) -> Result<(), String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(THEME_ZIP_URL)
        .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
        .send()
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("主题下载失败: {}", response.status()));
    }

    let bytes = response.bytes().map_err(|e| e.to_string())?;
    let reader = Cursor::new(bytes);
    let mut archive = ZipArchive::new(reader).map_err(|e| e.to_string())?;
    let themes_dir = storage_dir(app, THEME_DIR_NAME)?;

    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|e| e.to_string())?;
        if file.is_dir() {
            continue;
        }

        let name = file.name().replace('\\', "/");
        let file_name = Path::new(&name)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        if !file_name.ends_with(".css") || is_default_theme(file_name) {
            continue;
        }

        let path = themes_dir.join(file_name);
        let mut contents = Vec::new();
        file.read_to_end(&mut contents).map_err(|e| e.to_string())?;
        fs::write(path, contents).map_err(|e| e.to_string())?;
    }

    Ok(())
}

