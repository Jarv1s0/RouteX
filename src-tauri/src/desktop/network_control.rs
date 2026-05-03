fn stop_pac_server(state: &State<'_, CoreState>) -> Result<(), String> {
    let handle = state.pac_server.lock().map_err(|e| e.to_string())?.take();
    if let Some(handle) = handle {
        let _ = handle.shutdown.send(());
    }
    Ok(())
}

fn serve_pac_connection(
    stream: &mut std::net::TcpStream,
    script: &str,
) -> Result<(), std::io::Error> {
    let _ = stream.set_read_timeout(Some(Duration::from_millis(300)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(1)));
    let mut buffer = [0_u8; 1024];
    let _ = stream.read(&mut buffer);

    let body = script.as_bytes();
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/x-ns-proxy-autoconfig\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(response.as_bytes())?;
    stream.write_all(body)?;
    stream.flush()?;
    Ok(())
}

fn start_pac_server(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<Option<(String, u16)>, String> {
    stop_pac_server(state)?;

    let sysproxy = read_sysproxy_value(app)?;
    let mode = sysproxy
        .get("mode")
        .and_then(Value::as_str)
        .unwrap_or("manual");
    if mode != "auto" {
        return Ok(None);
    }

    let host = sysproxy
        .get("host")
        .and_then(Value::as_str)
        .unwrap_or("127.0.0.1")
        .to_string();
    let mixed_port = read_mixed_port(app)?;
    let default_script = r#"
function FindProxyForURL(url, host) {
  return "PROXY 127.0.0.1:%mixed-port%; SOCKS5 127.0.0.1:%mixed-port%; DIRECT;";
}
"#;
    let script = sysproxy
        .get("pacScript")
        .and_then(Value::as_str)
        .unwrap_or(default_script)
        .replace("%mixed-port%", &mixed_port.to_string());

    let listener = TcpListener::bind(format!("{host}:0"))
        .map_err(|e| format!("PAC server bind failed: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("PAC server configure failed: {e}"))?;

    let (shutdown_tx, shutdown_rx) = mpsc::channel();
    thread::spawn(move || loop {
        if shutdown_rx.try_recv().is_ok() {
            break;
        }

        match listener.accept() {
            Ok((mut stream, _)) => {
                let _ = serve_pac_connection(&mut stream, &script);
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(100));
            }
            Err(_) => break,
        }
    });

    let mut pac_server = state.pac_server.lock().map_err(|e| e.to_string())?;
    *pac_server = Some(PacServerHandle {
        shutdown: shutdown_tx,
    });
    Ok(Some((host, port)))
}

fn set_sys_proxy(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    only_active_device: bool,
) -> Result<(), String> {
    let sysproxy = read_sysproxy_value(app)?;
    let mode = sysproxy
        .get("mode")
        .and_then(Value::as_str)
        .unwrap_or("manual");
    let host = sysproxy
        .get("host")
        .and_then(Value::as_str)
        .unwrap_or("127.0.0.1");
    match mode {
        "auto" => {
            let (pac_host, pac_port) = start_pac_server(app, state)?
                .ok_or_else(|| "PAC server did not start".to_string())?;
            run_service_command(
                app,
                &service_command_args(
                    only_active_device,
                    "pac",
                    vec![
                        String::from("--url"),
                        format!("http://{pac_host}:{pac_port}/pac"),
                    ],
                ),
            )
        }
        _ => {
            let mixed_port = read_mixed_port(app)?;
            if mixed_port == 0 {
                return Ok(());
            }

            let bypass = {
                let values = json_array_strings(sysproxy.get("bypass"));
                if values.is_empty() {
                    default_sysproxy_bypass()
                } else {
                    values
                }
            };
            let bypass_separator = if cfg!(target_os = "windows") {
                ";"
            } else {
                ","
            };
            run_service_command(
                app,
                &service_command_args(
                    only_active_device,
                    "proxy",
                    vec![
                        String::from("--server"),
                        format!("{host}:{mixed_port}"),
                        String::from("--bypass"),
                        bypass.join(bypass_separator),
                    ],
                ),
            )
        }
    }
}

fn disable_sys_proxy(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    only_active_device: bool,
) -> Result<(), String> {
    stop_pac_server(state)?;
    run_service_command(
        app,
        &service_command_args(only_active_device, "disable", Vec::new()),
    )
}

fn trigger_sys_proxy(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    enable: bool,
    only_active_device: bool,
) -> Result<(), String> {
    let signature = build_sysproxy_signature(app, enable, only_active_device)?;
    {
        let last_signature = state
            .last_sysproxy_signature
            .lock()
            .map_err(|e| e.to_string())?;
        if last_signature.as_deref() == Some(signature.as_str()) {
            return Ok(());
        }
    }

    if enable {
        set_sys_proxy(app, state, only_active_device)?;
    } else {
        disable_sys_proxy(app, state, only_active_device)?;
    }

    let mut last_signature = state
        .last_sysproxy_signature
        .lock()
        .map_err(|e| e.to_string())?;
    *last_signature = Some(signature);
    Ok(())
}

fn is_core_running(state: &State<'_, CoreState>) -> Result<bool, String> {
    let mut runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    let is_running = if let Some(child) = runtime.child.as_mut() {
        child.try_wait().map_err(|e| e.to_string())?.is_none()
    } else {
        false
    };
    if !is_running {
        runtime.child = None;
    }
    Ok(is_running)
}

fn has_network_connectivity() -> bool {
    Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .and_then(|client| client.get(NETWORK_CONNECTIVITY_CHECK_URL).send())
        .map(|response| response.status().is_success() || response.status().as_u16() == 204)
        .unwrap_or(false)
}

fn has_up_network_interface(excluded_keywords: &[String]) -> bool {
    #[cfg(target_os = "windows")]
    {
        let script =
            "Get-NetAdapter | Select-Object -Property Name, Status | ConvertTo-Json -Compress";
        let output = match powershell_command()
            .args(["-NoProfile", "-Command", script])
            .output()
        {
            Ok(output) => output,
            Err(_) => return true,
        };

        if !output.status.success() {
            return true;
        }

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            return false;
        }

        let entries = match serde_json::from_str::<Value>(&stdout) {
            Ok(Value::Array(items)) => items,
            Ok(Value::Object(item)) => vec![Value::Object(item)],
            _ => return true,
        };

        let excluded = excluded_keywords
            .iter()
            .map(|value| value.to_ascii_lowercase())
            .collect::<Vec<_>>();

        return entries.iter().any(|entry| {
            let name = entry
                .get("Name")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let status = entry
                .get("Status")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let name_lower = name.to_ascii_lowercase();
            status.eq_ignore_ascii_case("Up")
                && !excluded
                    .iter()
                    .any(|keyword| !keyword.is_empty() && name_lower.contains(keyword))
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = excluded_keywords;
        true
    }
}

fn read_pause_ssids(app: &tauri::AppHandle) -> Result<Vec<String>, String> {
    Ok(json_array_strings(
        read_app_config_store(app)?.get("pauseSSID"),
    ))
}

fn current_ssid() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("netsh")
            .args(["wlan", "show", "interfaces"])
            .output()
            .ok()?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines().map(str::trim) {
            if line.starts_with("SSID") && !line.starts_with("BSSID") {
                return line
                    .split_once(':')
                    .map(|(_, value)| value.trim().to_string())
                    .filter(|value| !value.is_empty());
            }
        }
        return None;
    }

    #[cfg(target_os = "linux")]
    {
        let output = Command::new("sh")
            .args(["-c", "iwgetid -r 2>/dev/null"])
            .output()
            .ok()?;
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return if stdout.is_empty() {
            None
        } else {
            Some(stdout)
        };
    }

    #[cfg(target_os = "macos")]
    {
        let output = Command::new(
            "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport",
        )
        .arg("-I")
        .output()
        .ok()?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines().map(str::trim) {
            if line.starts_with("SSID") {
                return line
                    .split_once(':')
                    .map(|(_, value)| value.trim().to_string())
                    .filter(|value| !value.is_empty());
            }
        }
        return None;
    }

    #[allow(unreachable_code)]
    None
}

fn apply_ssid_mode(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    ssid: Option<&str>,
) -> Result<(), String> {
    let pause_ssids = read_pause_ssids(app)?;
    if pause_ssids.is_empty() {
        return Ok(());
    }

    let next_mode = if ssid
        .map(|value| pause_ssids.iter().any(|item| item == value))
        .unwrap_or(false)
    {
        "direct"
    } else {
        "rule"
    };

    let current_mode = read_controlled_config_store(app)?
        .get("mode")
        .and_then(Value::as_str)
        .unwrap_or("rule")
        .to_string();
    if current_mode == next_mode {
        return Ok(());
    }

    patch_controlled_config_store(app, &json!({ "mode": next_mode }))?;
    if let Err(error) = core_request(
        state,
        reqwest::Method::PATCH,
        "/configs",
        None,
        Some(json!({ "mode": next_mode })),
    ) {
        if error != "Mihomo controller is not available" {
            return Err(error);
        }
    }

    emit_ipc_event(app, "controledMihomoConfigUpdated", Value::Null);
    emit_ipc_event(app, "groupsUpdated", Value::Null);
    emit_ipc_event(app, "rulesUpdated", Value::Null);
    let _ = refresh_native_tray_menu(app);
    Ok(())
}

fn stop_ssid_check(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(handle) = app
        .state::<CoreState>()
        .ssid_check
        .lock()
        .map_err(|e| e.to_string())?
        .take()
    {
        let _ = handle.shutdown.send(());
    }
    Ok(())
}

fn refresh_ssid_check(app: &tauri::AppHandle) -> Result<(), String> {
    stop_ssid_check(app)?;

    if read_pause_ssids(app)?.is_empty() {
        return Ok(());
    }

    let (shutdown_tx, shutdown_rx) = mpsc::channel();
    {
        let state = app.state::<CoreState>();
        let mut handle = state.ssid_check.lock().map_err(|e| e.to_string())?;
        *handle = Some(SsidCheckHandle {
            shutdown: shutdown_tx,
        });
    }

    let app_handle = app.clone();
    thread::spawn(move || {
        let state = app_handle.state::<CoreState>();
        let mut last_ssid: Option<String> = None;

        loop {
            let current = current_ssid();
            if current != last_ssid {
                let _ = apply_ssid_mode(&app_handle, &state, current.as_deref());
                last_ssid = current;
            }

            if shutdown_rx.recv_timeout(Duration::from_secs(30)).is_ok() {
                break;
            }
        }
    });

    Ok(())
}

fn stop_network_detection(state: &State<'_, CoreState>) -> Result<(), String> {
    let handle = state
        .network_detection
        .lock()
        .map_err(|e| e.to_string())?
        .take();
    if let Some(handle) = handle {
        let _ = handle.shutdown.send(());
    }
    let mut network_down_handled = state
        .network_down_handled
        .lock()
        .map_err(|e| e.to_string())?;
    *network_down_handled = false;
    Ok(())
}

fn start_network_detection(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    stop_network_detection(state)?;

    let app_config = read_app_config_store(app)?;
    let only_active_device = app_config
        .get("onlyActiveDevice")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let mut excluded = json_array_strings(app_config.get("networkDetectionBypass"));
    let interval_secs = app_config
        .get("networkDetectionInterval")
        .and_then(Value::as_u64)
        .unwrap_or(10)
        .max(1);
    let sysproxy_enabled = app_config
        .get("sysProxy")
        .and_then(Value::as_object)
        .and_then(|value| value.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let tun_device = read_controlled_config_store(app)?
        .get("tun")
        .and_then(Value::as_object)
        .and_then(|value| value.get("device"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            if cfg!(target_os = "macos") {
                None
            } else {
                Some("mihomo".to_string())
            }
        });
    for item in [
        tun_device,
        Some("lo".to_string()),
        Some("docker0".to_string()),
        Some("utun".to_string()),
    ] {
        if let Some(item) = item {
            excluded.push(item);
        }
    }

    let (shutdown_tx, shutdown_rx) = mpsc::channel();
    let app_handle = app.clone();
    thread::spawn(move || loop {
        if shutdown_rx
            .recv_timeout(Duration::from_secs(interval_secs))
            .is_ok()
        {
            break;
        }

        let is_online = has_up_network_interface(&excluded) && has_network_connectivity();
        let state = app_handle.state::<CoreState>();
        let mut network_down_handled = match state.network_down_handled.lock() {
            Ok(value) => value,
            Err(_) => break,
        };

        let core_running = match is_core_running(&state) {
            Ok(value) => value,
            Err(_) => false,
        };

        if is_online {
            if *network_down_handled && !core_running {
                let runtime_config = current_runtime_value(&app_handle, &state).ok();
                match restart_core_process(&app_handle, &state, runtime_config.as_ref()) {
                    Ok(value) => {
                        emit_ipc_event(&app_handle, "core-started", value);
                        emit_ipc_event(&app_handle, "groupsUpdated", Value::Null);
                        emit_ipc_event(&app_handle, "rulesUpdated", Value::Null);
                        if sysproxy_enabled {
                            let _ =
                                trigger_sys_proxy(&app_handle, &state, true, only_active_device);
                        }
                        *network_down_handled = false;
                    }
                    Err(_) => {}
                }
            }
            continue;
        }

        if !*network_down_handled {
            if sysproxy_enabled {
                let _ = trigger_sys_proxy(&app_handle, &state, false, only_active_device);
            }
            let _ = recover_dns(&app_handle);
            let _ = stop_core_process(&app_handle, &state);
            *network_down_handled = true;
        }
    });

    let mut handle = state.network_detection.lock().map_err(|e| e.to_string())?;
    *handle = Some(NetworkDetectionHandle {
        shutdown: shutdown_tx,
    });
    Ok(())
}

fn shutdown_runtime(app: &tauri::AppHandle, state: &State<'_, CoreState>) {
    let only_active_device = read_only_active_device(app).unwrap_or(false);
    let _ = stop_network_detection(state);
    let _ = trigger_sys_proxy(app, state, false, only_active_device);
    let _ = recover_dns(app);
    let _ = stop_traffic_monitor(app);
    let _ = stop_core_process(app, state);
}

fn shutdown_runtime_once(app: &tauri::AppHandle) {
    let state = app.state::<CoreState>();
    if state
        .shutdown_started
        .compare_exchange(false, true, AtomicOrdering::SeqCst, AtomicOrdering::SeqCst)
        .is_err()
    {
        return;
    }

    if state.preserve_core_on_exit.load(AtomicOrdering::SeqCst) {
        let _ = stop_lightweight_mode(app);
        return;
    }

    shutdown_runtime(app, &state);
}

fn install_process_signal_handlers(app: &tauri::AppHandle) -> Result<(), String> {
    let app_handle = app.clone();
    ctrlc::set_handler(move || {
        shutdown_runtime_once(&app_handle);
        std::process::exit(0);
    })
    .map_err(|e| e.to_string())
}
