fn prepare_runtime_data_dir(app: &tauri::AppHandle, data_dir: &Path) -> Result<(), String> {
    for file_name in [
        "country.mmdb",
        "geoip.metadb",
        "geoip.dat",
        "geosite.dat",
        "ASN.mmdb",
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

        let source_path = resolve_resource_binary(app, "files", file_name)?;
        if target_path.exists() {
            let _ = fs::remove_file(&target_path);
        }
        fs::copy(source_path, target_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn ensure_runtime_dirs(
    app: &tauri::AppHandle,
    current_profile_id: Option<&str>,
    diff_work_dir: bool,
) -> Result<(PathBuf, PathBuf, PathBuf, PathBuf), String> {
    let base = app_data_root(app)?.join(MIHOMO_RUNTIME_DIR_NAME);
    let profile_base = if diff_work_dir {
        current_profile_id
            .filter(|value| !value.trim().is_empty())
            .map(|id| base.join("profiles").join(id))
            .unwrap_or_else(|| base.clone())
    } else {
        base.clone()
    };

    let work_dir = profile_base.join("work");
    let logs_dir = profile_base.join("logs");
    let test_dir = profile_base.join("test");
    let log_path = logs_dir.join("mihomo.log");

    fs::create_dir_all(&work_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&test_dir).map_err(|e| e.to_string())?;

    Ok((base, work_dir, log_path, test_dir))
}

fn read_max_log_days(app: &tauri::AppHandle) -> u64 {
    read_app_config_store(app)
        .ok()
        .map(|config| json_u64(config.get("maxLogDays")))
        .filter(|days| *days > 0)
        .map(|days| days.min(3650))
        .unwrap_or(7)
}

fn runtime_log_archive_path(log_path: &Path) -> Option<PathBuf> {
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

fn archive_current_runtime_log(log_path: &Path) {
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

fn cleanup_old_runtime_logs(logs_dir: &Path, max_log_days: u64) {
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

fn prepare_runtime_log_file(app: &tauri::AppHandle, log_path: &Path) {
    let max_log_days = read_max_log_days(app);
    archive_current_runtime_log(log_path);
    if let Some(logs_dir) = log_path.parent() {
        cleanup_old_runtime_logs(logs_dir, max_log_days);
    }
}

fn check_runtime_profile(
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
        return Err(format!("Profile Check Failed:\n{}", error_lines.join("\n")));
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

fn normalize_runtime_config(input: Option<&Value>, controller_address: &str) -> Value {
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

fn stop_core_process(app: &tauri::AppHandle, state: &State<'_, CoreState>) -> Result<(), String> {
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

fn core_request(
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
    if !status.is_success() {
        return Err(format!("Mihomo API request failed: {status}"));
    }
    let body = response.text().map_err(|e| e.to_string())?;
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

fn expected_runtime_group_count(runtime_config: &Value) -> usize {
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

fn controller_provider_count(value: &Value) -> Option<usize> {
    value
        .get("providers")
        .and_then(Value::as_object)
        .map(|providers| providers.len())
}

fn controller_providers_ready(value: Value, expected_count: usize) -> (bool, usize) {
    let actual_count = controller_provider_count(&value).unwrap_or(0);
    (
        expected_count == 0 || actual_count >= expected_count,
        actual_count,
    )
}

fn wait_for_renderer_data_ready(
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

fn wait_for_core_ready(state: &State<'_, CoreState>, runtime_config: &Value) -> Result<(), String> {
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

fn validate_runtime_start_log(
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

fn refine_core_start_error(
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

fn restart_core_process(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    config: Option<&Value>,
) -> Result<Value, String> {
    let _restart_guard = state.restart_lock.lock().map_err(|e| e.to_string())?;
    let _ = recover_dns(app);
    stop_core_process(app, state)?;

    let core = read_core_name(app)?;
    let binary_path = resolve_core_binary(app, &core)?;
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
    let config_digest = format!("{:x}", Sha256::digest(config_yaml.as_bytes()));
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

        let mut runtime = state.runtime.lock().map_err(|e| e.to_string())?;
        runtime.binary_path = Some(binary_path.clone());
        runtime.work_dir = Some(work_dir.clone());
        runtime.log_path = Some(log_path.clone());
        runtime.controller_url = Some(format!("http://{controller_client_address}"));
        runtime.config_path = Some(config_path.clone());
        runtime.cached_runtime_config = Some(CachedRuntimeConfig {
            path: config_path.clone(),
            modified_at_ms: runtime_config_modified_at_ms(&config_path),
            value: runtime_config.clone(),
        });
        runtime.child = None;
        runtime.service_managed = true;
        drop(runtime);

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
    let mut runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    runtime.binary_path = Some(binary_path.clone());
    runtime.work_dir = Some(work_dir.clone());
    runtime.log_path = Some(log_path.clone());
    runtime.controller_url = Some(format!("http://{controller_client_address}"));
    runtime.config_path = Some(config_path.clone());
    runtime.cached_runtime_config = Some(CachedRuntimeConfig {
        path: config_path.clone(),
        modified_at_ms: runtime_config_modified_at_ms(&config_path),
        value: runtime_config.clone(),
    });
    runtime.child = Some(child);
    runtime.service_managed = false;
    drop(runtime);

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

