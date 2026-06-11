use super::prelude::*;
use super::*;

const RUNTIME_CHECK_DIR_NAME: &str = "check";
const LEGACY_RUNTIME_TEST_DIR_NAME: &str = "test";

fn migrate_legacy_runtime_check_dir(profile_base: &Path) -> Result<(), String> {
    let legacy_test_dir = profile_base.join(LEGACY_RUNTIME_TEST_DIR_NAME);
    let check_dir = profile_base.join(RUNTIME_CHECK_DIR_NAME);
    if !legacy_test_dir.exists() || check_dir.exists() {
        return Ok(());
    }

    fs::rename(&legacy_test_dir, &check_dir).map_err(|e| e.to_string())
}

pub(crate) fn prepare_runtime_data_dir(
    app: &tauri::AppHandle,
    data_dir: &Path,
) -> Result<(), String> {
    for file_name in [
        "country.mmdb",
        "geoip.metadb",
        "geoip.dat",
        "geosite.dat",
    ] {
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

    let work_dir = profile_base.join("work");
    let logs_dir = profile_logs_base;
    let check_dir = profile_base.join(RUNTIME_CHECK_DIR_NAME);
    let log_path = logs_dir.join("mihomo.log");

    fs::create_dir_all(&work_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&check_dir).map_err(|e| e.to_string())?;

    Ok((base, work_dir, log_path, check_dir))
}

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

pub(crate) fn check_runtime_profile(
    binary_path: &Path,
    config_path: &Path,
    test_dir: &Path,
    safe_paths: &[String],
) -> Result<(), String> {
    let mut command = Command::new(binary_path);
    apply_background_command(&mut command);
    command
        .arg("-t")
        .arg("-f")
        .arg(config_path)
        .arg("-d")
        .arg(test_dir);

    if !safe_paths.is_empty() {
        command.env("SAFE_PATHS", safe_paths.join(path_delimiter()));
    }

    let output = command.output().map_err(|e| e.to_string())?;
    if output.status.success() {
        return Ok(());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let error_lines = stdout
        .lines()
        .filter(|line| line.contains("level=error"))
        .map(|line| {
            line.split("level=error")
                .nth(1)
                .unwrap_or(line)
                .trim()
                .to_string()
        })
        .collect::<Vec<_>>();

    if !error_lines.is_empty() {
        let err_msg = error_lines.join("\n");
        let runtime_config = serde_yaml::from_str::<Value>(
            &fs::read_to_string(config_path).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        if is_missing_geo_data_error(&err_msg, &runtime_config) {
            return Err(format!(
                "启动失败：当前配置依赖地理位置数据库 (GeoData)，但未找到相关文件。\n\n👉 请前往「规则 - GeoData」页面手动下载这些文件，或从配置中移除相关规则。\n\n内核原始报错：\n{}",
                err_msg
            ));
        }
        return Err(format!("Profile Check Failed:\n{}", err_msg));
    }

    let fallback = if !stderr.trim().is_empty() {
        stderr.trim().to_string()
    } else if !stdout.trim().is_empty() {
        stdout.trim().to_string()
    } else {
        format!("Mihomo exited with status {}", output.status)
    };

    Err(fallback)
}

pub(crate) fn error_mentions_geo_data(message: &str) -> bool {
    let lower_msg = message.to_lowercase();
    lower_msg.contains("geoip")
        || lower_msg.contains("geosite")
        || lower_msg.contains("geoip.dat")
        || lower_msg.contains("geosite.dat")
        || lower_msg.contains("mmdb")
        || lower_msg.contains("metadb")
}

pub(crate) fn rule_uses_geo_data(rule: &str) -> bool {
    let rule_type = rule
        .split(',')
        .next()
        .map(str::trim)
        .unwrap_or_default()
        .to_ascii_uppercase();
    matches!(rule_type.as_str(), "GEOIP" | "SRC-GEOIP" | "GEOSITE")
}

pub(crate) fn error_has_missing_file_signal(message: &str) -> bool {
    let lower_msg = message.to_lowercase();
    [
        "no such file",
        "cannot find",
        "file not found",
        "missing",
        "does not exist",
        "file doesn't exist",
        "the system cannot find",
    ]
    .iter()
    .any(|marker| lower_msg.contains(marker))
}

pub(crate) fn dns_array_uses_geo_data(value: Option<&Value>) -> bool {
    value
        .and_then(Value::as_array)
        .map(|items| {
            items.iter().filter_map(Value::as_str).any(|item| {
                let normalized = item.trim().to_ascii_lowercase();
                normalized.starts_with("geosite:") || normalized.starts_with("geoip:")
            })
        })
        .unwrap_or(false)
}

pub(crate) fn dns_map_uses_geo_data(value: Option<&Value>) -> bool {
    value
        .and_then(Value::as_object)
        .map(|map| {
            map.keys().any(|key| {
                let normalized = key.trim().to_ascii_lowercase();
                normalized.starts_with("geosite:") || normalized.starts_with("geoip:")
            })
        })
        .unwrap_or(false)
}

pub(crate) fn dns_config_uses_geo_data(runtime_config: &Value) -> bool {
    let Some(dns) = runtime_config.get("dns").and_then(Value::as_object) else {
        return false;
    };

    if let Some(fallback_filter) = dns.get("fallback-filter").and_then(Value::as_object) {
        if fallback_filter.get("geoip").and_then(Value::as_bool) == Some(true) {
            return true;
        }
        if fallback_filter
            .get("geosite")
            .and_then(Value::as_array)
            .map(|items| !items.is_empty())
            .unwrap_or(false)
        {
            return true;
        }
    }

    dns_map_uses_geo_data(dns.get("nameserver-policy"))
        || dns_array_uses_geo_data(dns.get("fake-ip-filter"))
}

pub(crate) fn runtime_config_uses_geo_data(runtime_config: &Value) -> bool {
    runtime_config
        .get("rules")
        .and_then(Value::as_array)
        .map(|rules| {
            rules
                .iter()
                .filter_map(Value::as_str)
                .any(rule_uses_geo_data)
        })
        .unwrap_or(false)
        || dns_config_uses_geo_data(runtime_config)
}

pub(crate) fn is_missing_geo_data_error(message: &str, runtime_config: &Value) -> bool {
    runtime_config_uses_geo_data(runtime_config)
        && error_mentions_geo_data(message)
        && error_has_missing_file_signal(message)
}

pub(crate) fn normalize_runtime_config(input: Option<&Value>, controller_address: &str) -> Value {
    let mut config = input
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();

    config.insert(
        "external-controller".to_string(),
        Value::String(controller_address.to_string()),
    );
    config.remove("external-controller-pipe");
    config.remove("external-controller-unix");
    config
        .entry("allow-lan".to_string())
        .or_insert_with(|| Value::Bool(false));
    config
        .entry("mode".to_string())
        .or_insert_with(|| Value::String("rule".to_string()));
    config
        .entry("log-level".to_string())
        .or_insert_with(|| Value::String("info".to_string()));
    config
        .entry("mixed-port".to_string())
        .or_insert_with(|| Value::Number(7890.into()));
    config
        .entry("ipv6".to_string())
        .or_insert_with(|| Value::Bool(true));
    config
        .entry("proxies".to_string())
        .or_insert_with(|| Value::Array(vec![]));
    config
        .entry("proxy-groups".to_string())
        .or_insert_with(|| Value::Array(vec![]));
    config
        .entry("rules".to_string())
        .or_insert_with(|| Value::Array(vec![Value::String("MATCH,DIRECT".to_string())]));

    Value::Object(config)
}

pub(crate) fn stop_core_process(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    let _ = stop_core_events_monitor(state);
    let service_managed = {
        let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
        runtime.service_managed
    };

    if service_managed {
        match service_core_control(app, "/core/stop") {
            Ok(()) => {}
            Err(error)
                if error.contains("进程未运行")
                    || error.to_ascii_lowercase().contains("not running") => {}
            Err(error) => return Err(error),
        }
    }

    let mut runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    if let Some(child) = runtime.child.as_mut() {
        if child.try_wait().map_err(|e| e.to_string())?.is_none() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    runtime.child = None;
    runtime.service_managed = false;
    runtime.controller_url = None;
    runtime.config_path = None;
    runtime.cached_runtime_config = None;
    Ok(())
}

pub(crate) fn core_request(
    state: &State<'_, CoreState>,
    method: reqwest::Method,
    path: &str,
    query: Option<&[(&str, String)]>,
    body: Option<Value>,
) -> Result<Value, String> {
    let started_at = Instant::now();
    let method_for_log = method.clone();
    let controller_url = {
        let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
        runtime
            .controller_url
            .clone()
            .ok_or_else(|| "Mihomo controller is not available".to_string())?
    };

    let url = format!("{controller_url}{path}");
    let client = mihomo_http_client()?;

    let mut request = client.request(method, &url);

    if let Some(query) = query {
        request = request.query(query);
    }

    if let Some(body) = body {
        request = request.json(&body);
    }

    let response = request.send().map_err(|e| e.to_string())?;
    let status = response.status();
    if status == reqwest::StatusCode::NO_CONTENT {
        return Ok(Value::Null);
    }
    let body = response.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        let detail = serde_json::from_str::<Value>(&body)
            .ok()
            .and_then(|value| {
                value
                    .get("message")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
            .or_else(|| {
                let trimmed = body.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                }
            });
        return Err(match detail {
            Some(detail) => format!("Mihomo API request failed: {status}: {detail}"),
            None => format!("Mihomo API request failed: {status}"),
        });
    }
    if body.trim().is_empty() {
        return Ok(Value::Null);
    }
    let result = serde_json::from_str::<Value>(&body).map_err(|e| e.to_string());
    let elapsed_ms = started_at.elapsed().as_millis();
    if elapsed_ms >= 80 || path == "/rules" || path == "/providers/rules" || path == "/proxies" {
        eprintln!(
            "[desktop.core_request] {} {} {}ms",
            method_for_log, path, elapsed_ms
        );
    }
    result
}

pub(crate) fn expected_runtime_group_count(runtime_config: &Value) -> usize {
    let mode = runtime_config
        .get("mode")
        .and_then(Value::as_str)
        .unwrap_or("rule");
    if mode == "direct" {
        return 0;
    }

    runtime_config
        .get("proxy-groups")
        .and_then(Value::as_array)
        .map(|groups| {
            groups
                .iter()
                .filter(|group| {
                    !group
                        .get("hidden")
                        .and_then(Value::as_bool)
                        .unwrap_or(false)
                })
                .count()
        })
        .unwrap_or(0)
}

pub(crate) fn controller_provider_count(value: &Value) -> Option<usize> {
    value
        .get("providers")
        .and_then(Value::as_object)
        .map(|providers| providers.len())
}

pub(crate) fn controller_providers_ready(value: Value, expected_count: usize) -> (bool, usize) {
    let actual_count = controller_provider_count(&value).unwrap_or(0);
    (
        expected_count == 0 || actual_count >= expected_count,
        actual_count,
    )
}

pub(crate) fn wait_for_renderer_data_ready(
    state: &State<'_, CoreState>,
    runtime_config: &Value,
) -> Result<(), String> {
    let expected_group_count = expected_runtime_group_count(runtime_config);
    let mut last_error = String::from("Mihomo renderer data is not available");

    for _ in 0..50 {
        let rules_ready = match core_request(state, reqwest::Method::GET, "/rules", None, None) {
            Ok(_) => true,
            Err(error) => {
                last_error = error;
                std::thread::sleep(Duration::from_millis(200));
                continue;
            }
        };

        let proxies = match core_request(state, reqwest::Method::GET, "/proxies", None, None) {
            Ok(value) => value,
            Err(error) => {
                last_error = error;
                std::thread::sleep(Duration::from_millis(200));
                continue;
            }
        };

        let groups = build_mihomo_groups_value(&proxies, runtime_config);
        let actual_group_count = groups.as_array().map(|items| items.len()).unwrap_or(0);
        // Mihomo may drop or rewrite configured groups after overrides are applied, so the
        // renderer-ready check must not wait for the configured group count to reappear exactly.
        let groups_ready = expected_group_count == 0 || actual_group_count > 0;

        if rules_ready && groups_ready {
            return Ok(());
        }

        last_error = format!(
            "waiting for renderer groups to become available: configured {expected_group_count}, got {actual_group_count}"
        );
        std::thread::sleep(Duration::from_millis(200));
    }

    Err(format!(
        "Timed out waiting for Mihomo renderer data to become ready: {last_error}"
    ))
}

pub(crate) fn wait_for_core_ready(
    state: &State<'_, CoreState>,
    runtime_config: &Value,
) -> Result<(), String> {
    let mut last_error = String::from("Mihomo controller is not available");
    let tun_enabled = runtime_tun_enabled(runtime_config);
    // TUN 模式下核心需要先初始化 Wintun/虚拟网卡才会开放 HTTP controller，
    // 给更多次数（150 次 × 100ms = 15 秒上限）；非 TUN 给 60 次（6 秒）。
    // 相比之前 100/50 × 200ms = 20s/10s，响应延迟减半，总超时也减半。
    let controller_ready_retries = if tun_enabled { 150 } else { 60 };
    let poll_interval_ms = 100u64;
    let expected_rule_providers = runtime_config
        .get("rule-providers")
        .and_then(Value::as_object)
        .map(|providers| providers.len())
        .unwrap_or(0);
    let expected_proxy_providers = runtime_config
        .get("proxy-providers")
        .and_then(Value::as_object)
        .map(|providers| providers.len())
        .unwrap_or(0);

    let started_at = Instant::now();
    for attempt in 0..controller_ready_retries {
        match core_request(state, reqwest::Method::GET, "/rules", None, None) {
            Ok(_) => {
                eprintln!(
                    "[desktop.core_ready] controller ready after {}ms (attempt {}{})",
                    started_at.elapsed().as_millis(),
                    attempt,
                    if tun_enabled { ", TUN mode" } else { "" }
                );
                // providers 就绪检查：只要求 controller 暴露 provider 数据结构。
                // 必须等到配置声明的 provider 数量出现在 controller 里，否则渲染端会缓存空
                // provider 列表，只剩 rules 引用数量，导致规则集和规则总数显示错误。
                let provider_wait_start = Instant::now();
                let mut providers_ready = false;
                let mut actual_proxy_providers = 0usize;
                let mut actual_rule_providers = 0usize;
                for _ in 0..100 {
                    let proxy_ready = if expected_proxy_providers == 0 {
                        true
                    } else {
                        let (ready, count) = core_request(
                            state,
                            reqwest::Method::GET,
                            "/providers/proxies",
                            None,
                            None,
                        )
                        .ok()
                        .map(|value| controller_providers_ready(value, expected_proxy_providers))
                        .unwrap_or((false, 0));
                        actual_proxy_providers = count;
                        ready
                    };

                    let rule_ready = if expected_rule_providers == 0 {
                        true
                    } else {
                        let (ready, count) = core_request(
                            state,
                            reqwest::Method::GET,
                            "/providers/rules",
                            None,
                            None,
                        )
                        .ok()
                        .map(|value| controller_providers_ready(value, expected_rule_providers))
                        .unwrap_or((false, 0));
                        actual_rule_providers = count;
                        ready
                    };

                    if proxy_ready && rule_ready {
                        providers_ready = true;
                        break;
                    }

                    std::thread::sleep(Duration::from_millis(poll_interval_ms));
                }

                if providers_ready {
                    if let Err(error) = wait_for_renderer_data_ready(state, runtime_config) {
                        eprintln!(
                            "[desktop.core_ready] renderer data not fully ready yet: {}",
                            error
                        );
                    }
                } else {
                    eprintln!(
                        "[desktop.core_ready] providers not fully ready after {}ms, continuing anyway \
                         (proxy_providers={actual_proxy_providers}/{expected_proxy_providers}, \
                         rule_providers={actual_rule_providers}/{expected_rule_providers})",
                        provider_wait_start.elapsed().as_millis()
                    );
                }
                return Ok(());
            }
            Err(error) => {
                last_error = error;
                std::thread::sleep(Duration::from_millis(poll_interval_ms));
            }
        }
    }

    Err(format!(
        "Timed out waiting for Mihomo controller to become ready after {}ms: {last_error}",
        started_at.elapsed().as_millis()
    ))
}

pub(crate) fn validate_runtime_start_log(
    log_path: &Path,
    log_start_offset: u64,
    runtime_config: &Value,
) -> Result<(), String> {
    let expected_tun_enabled = runtime_tun_enabled(runtime_config);

    let mut file = fs::File::open(log_path).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(log_start_offset))
        .map_err(|e| e.to_string())?;
    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|e| e.to_string())?;

    for line in content.lines() {
        if line.contains("Start Mixed(http+socks) server error")
            || line.contains("Start HTTP server error")
            || line.contains("Start SOCKS server error")
            || line.contains("Start Redir server error")
        {
            return Err("核心启动失败：入站端口仍被其他实例占用".to_string());
        }

        if line.contains("External controller listen error") {
            return Err("核心启动失败：控制器端口仍被其他实例占用".to_string());
        }

        if expected_tun_enabled && line.contains("Start TUN listening error") {
            if line.contains("Access is denied") {
                return Err("TUN 启动失败：当前实例没有获得虚拟网卡所需权限".to_string());
            }
            if line.contains("Cannot create a file when that file already exists") {
                return Err("TUN 启动失败：现有虚拟网卡状态残留，请先关闭旧实例后重试".to_string());
            }
            return Err("TUN 启动失败：核心未成功接管虚拟网卡".to_string());
        }
    }

    Ok(())
}

pub(crate) fn refine_core_start_error(
    startup_error: String,
    log_path: &Path,
    log_start_offset: u64,
    runtime_config: &Value,
) -> String {
    match validate_runtime_start_log(log_path, log_start_offset, runtime_config) {
        Err(error) => error,
        Ok(()) => startup_error,
    }
}

pub(crate) fn reload_core_config_process(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    close_connections: bool,
) -> Result<Value, String> {
    let (binary_path, work_dir, config_path, controller_address) = {
        let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
        let binary_path = runtime
            .binary_path
            .clone()
            .ok_or_else(|| "Mihomo core is not running".to_string())?;
        let work_dir = runtime
            .work_dir
            .clone()
            .ok_or_else(|| "Mihomo work dir is not available".to_string())?;
        let config_path = runtime
            .config_path
            .clone()
            .ok_or_else(|| "Mihomo config path is not available".to_string())?;
        let controller_address = runtime
            .cached_runtime_config
            .as_ref()
            .and_then(|config| configured_external_controller_address(Some(&config.value)))
            .or_else(|| {
                runtime
                    .controller_url
                    .as_deref()
                    .map(controller_connect_address)
            })
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| "Mihomo controller is not available".to_string())?;

        (binary_path, work_dir, config_path, controller_address)
    };

    if let Some(configured_controller) =
        configured_external_controller_address(Some(&read_controlled_config_store(app)?))
    {
        if configured_controller != controller_address {
            return Err("外部控制器地址变更需要重启内核".to_string());
        }
    }

    let runtime_config = normalize_runtime_config(
        Some(&current_profile_runtime_config(app)?),
        &controller_address,
    );
    let config_yaml = serde_yaml::to_string(&runtime_config).map_err(|e| e.to_string())?;
    let check_dir = work_dir
        .parent()
        .ok_or_else(|| "Mihomo check dir is not available".to_string())?
        .join(RUNTIME_CHECK_DIR_NAME);

    prepare_runtime_data_dir(app, &work_dir)?;
    prepare_runtime_data_dir(app, &check_dir)?;

    let safe_paths = read_safe_paths(app)?;
    let check_path = work_dir.join(format!("config-hot-reload-{}.yaml", current_timestamp_ms()));
    fs::write(&check_path, &config_yaml).map_err(|e| e.to_string())?;
    let check_result = check_runtime_profile(&binary_path, &check_path, &check_dir, &safe_paths);
    let _ = fs::remove_file(&check_path);
    check_result?;

    let previous_config = fs::read(&config_path).ok();
    fs::write(&config_path, &config_yaml).map_err(|e| e.to_string())?;

    let query = [("force", "true".to_string())];
    let reload_result = core_request(
        state,
        reqwest::Method::PUT,
        "/configs",
        Some(&query),
        Some(json!({ "path": config_path.to_string_lossy() })),
    );

    if let Err(error) = reload_result {
        if let Some(previous_config) = previous_config {
            let _ = fs::write(&config_path, previous_config);
        }
        return Err(format!("Mihomo 热重载失败: {error}"));
    }

    {
        let mut runtime = state.runtime.lock().map_err(|e| e.to_string())?;
        if runtime.config_path.as_ref() == Some(&config_path) {
            runtime.cached_runtime_config = Some(CachedRuntimeConfig {
                path: config_path.clone(),
                modified_at_ms: runtime_config_modified_at_ms(&config_path),
                value: runtime_config.clone(),
            });
        }
    }

    if let Err(error) = wait_for_renderer_data_ready(state, &runtime_config) {
        eprintln!("[desktop.core_reload] renderer data not fully ready yet: {error}");
    }

    if close_connections {
        if let Err(error) = core_request(state, reqwest::Method::DELETE, "/connections", None, None)
        {
            eprintln!("[desktop.core_reload] failed to close connections: {error}");
        }
    }

    Ok(json!({
        "binaryPath": binary_path.to_string_lossy(),
        "workDir": work_dir.to_string_lossy(),
        "configPath": config_path.to_string_lossy(),
        "controller": controller_address,
    }))
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn update_runtime_state(
    state: &State<'_, CoreState>,
    binary_path: PathBuf,
    work_dir: PathBuf,
    log_path: PathBuf,
    controller_client_address: String,
    config_path: PathBuf,
    runtime_config: Value,
    child: Option<Child>,
    service_managed: bool,
) -> Result<(), String> {
    let mut runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    runtime.binary_path = Some(binary_path);
    runtime.work_dir = Some(work_dir);
    runtime.log_path = Some(log_path);
    runtime.controller_url = Some(format!("http://{controller_client_address}"));
    runtime.cached_runtime_config = Some(CachedRuntimeConfig {
        path: config_path.clone(),
        modified_at_ms: runtime_config_modified_at_ms(&config_path),
        value: runtime_config,
    });
    runtime.config_path = Some(config_path);
    runtime.child = child;
    runtime.service_managed = service_managed;
    Ok(())
}

pub(crate) fn restart_core_process(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    config: Option<&Value>,
) -> Result<Value, String> {
    let _restart_guard = state.restart_lock.lock().map_err(|e| e.to_string())?;
    let _ = recover_dns(app);
    stop_core_process(app, state)?;

    let core = read_core_name(app)?;
    let binary_path = ensure_mihomo_core_available(app, &core)?;
    let use_service_mode = read_core_permission_mode(app)? == "service";
    let current_profile_id = current_runtime_profile_id(app)?;
    let diff_work_dir = read_diff_work_dir(app)?;
    let safe_paths = read_safe_paths(app)?;
    let (control_dns, control_sniff) = read_control_flags(app)?;
    let (_, work_dir, log_path, test_dir) =
        ensure_runtime_dirs(app, current_profile_id.as_deref(), diff_work_dir)?;
    let mut merged_runtime_config = current_profile_runtime_config(app)?;
    if let Some(config_patch) = config {
        merge_json(&mut merged_runtime_config, config_patch);
    }
    let external_controller_address =
        configured_external_controller_address(Some(&merged_runtime_config));
    sanitize_runtime_profile_value(&mut merged_runtime_config, control_dns, control_sniff);
    let runtime_controller_address = if let Some(address) = external_controller_address.clone() {
        address
    } else {
        allocate_controller_address()?
    };
    let controller_client_address = controller_connect_address(&runtime_controller_address);
    let runtime_config =
        normalize_runtime_config(Some(&merged_runtime_config), &runtime_controller_address);
    let config_path = work_dir.join("config.yaml");
    let config_yaml = serde_yaml::to_string(&runtime_config).map_err(|e| e.to_string())?;
    let config_digest_bytes = ring::digest::digest(&ring::digest::SHA256, config_yaml.as_bytes());
    let config_digest = config_digest_bytes
        .as_ref()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();
    prepare_runtime_data_dir(app, &work_dir)?;
    prepare_runtime_data_dir(app, &test_dir)?;
    fs::write(&config_path, &config_yaml).map_err(|e| e.to_string())?;
    let should_check_profile = PROFILE_CHECK_CACHE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map(|cache| cache.as_ref() != Some(&config_digest))
        .unwrap_or(true);
    if should_check_profile {
        check_runtime_profile(&binary_path, &config_path, &test_dir, &safe_paths)?;
        if let Ok(mut cache) = PROFILE_CHECK_CACHE.get_or_init(|| Mutex::new(None)).lock() {
            *cache = Some(config_digest.clone());
        }
    } else {
        eprintln!("[desktop.core_ready] skip profile check: config unchanged");
    }
    let tun_enabled = runtime_tun_enabled(&runtime_config);
    prepare_runtime_log_file(app, &log_path);
    let log_start_offset = fs::metadata(&log_path).map(|m| m.len()).unwrap_or(0);
    let auto_set_dns_mode = read_auto_set_dns_mode(app)?;
    if tun_enabled && auto_set_dns_mode != "none" {
        set_public_dns(app)?;
    }

    if use_service_mode {
        let app_config = read_app_config_store(app)?;
        let payload = build_service_core_restart_payload(
            &binary_path,
            &work_dir,
            &log_path,
            &safe_paths,
            &app_config,
        );
        service_http_request_json(app, "POST", "/core/restart", Some(&payload))?;

        let pid = service_core_status_info(app)?
            .and_then(|value| value.get("pid").cloned())
            .unwrap_or(Value::Null);

        update_runtime_state(
            state,
            binary_path.clone(),
            work_dir.clone(),
            log_path.clone(),
            controller_client_address.clone(),
            config_path.clone(),
            runtime_config.clone(),
            None,
            true,
        )?;

        if let Err(error) = wait_for_core_ready(state, &runtime_config) {
            let error =
                refine_core_start_error(error, &log_path, log_start_offset, &runtime_config);
            let _ = recover_dns(app);
            let _ = stop_core_process(app, state);
            return Err(error);
        }

        let _ = start_core_events_monitor(app, state);

        return Ok(json!({
            "pid": pid,
            "binaryPath": binary_path.to_string_lossy(),
            "workDir": work_dir.to_string_lossy(),
            "logPath": log_path.to_string_lossy(),
            "controller": controller_client_address,
        }));
    }

    let stdout = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| e.to_string())?;
    let stderr = stdout.try_clone().map_err(|e| e.to_string())?;

    let mut command = Command::new(&binary_path);
    apply_background_command(&mut command);
    command
        .arg("-d")
        .arg(&work_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));

    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let mut exited_early = None;
    for _ in 0..5 {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            exited_early = Some(status);
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    if let Some(status) = exited_early {
        return Err(format!("Mihomo exited early with status: {status}"));
    }

    let pid = child.id();
    update_runtime_state(
        state,
        binary_path.clone(),
        work_dir.clone(),
        log_path.clone(),
        controller_client_address.clone(),
        config_path.clone(),
        runtime_config.clone(),
        Some(child),
        false,
    )?;

    if let Err(error) = wait_for_core_ready(state, &runtime_config) {
        let error = refine_core_start_error(error, &log_path, log_start_offset, &runtime_config);
        let _ = recover_dns(app);
        let _ = stop_core_process(app, state);
        return Err(error);
    }

    if let Err(error) = validate_runtime_start_log(&log_path, log_start_offset, &runtime_config) {
        let _ = recover_dns(app);
        let _ = stop_core_process(app, state);
        return Err(error);
    }

    let _ = start_core_events_monitor(app, state);

    Ok(json!({
        "pid": pid,
        "binaryPath": binary_path.to_string_lossy(),
        "workDir": work_dir.to_string_lossy(),
        "logPath": log_path.to_string_lossy(),
        "controller": controller_client_address,
    }))
}
