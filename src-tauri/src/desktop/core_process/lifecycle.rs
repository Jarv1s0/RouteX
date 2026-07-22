use crate::desktop::prelude::*;
use crate::desktop::*;

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
    prepare_runtime_check_dir(&work_dir, &check_dir)?;

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

    apply_quick_rules_disabled_state(app, state, &runtime_config)?;

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
    prepare_runtime_check_dir(&work_dir, &test_dir)?;
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

    if let Err(error) = cleanup_stale_tun_artifacts(app, &merged_runtime_config) {
        eprintln!("[desktop.tun_cleanup] {error}");
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

        apply_quick_rules_disabled_state(app, state, &runtime_config)?;

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

    apply_quick_rules_disabled_state(app, state, &runtime_config)?;

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
