fn current_controller_url(state: &State<'_, CoreState>) -> Result<Option<String>, String> {
    let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    Ok(runtime.controller_url.clone())
}

fn json_u64(value: Option<&Value>) -> u64 {
    value
        .and_then(Value::as_u64)
        .or_else(|| value.and_then(Value::as_i64).map(|v| v.max(0) as u64))
        .unwrap_or(0)
}

fn close_connections_by_group(state: &State<'_, CoreState>, name: &str) -> Result<(), String> {
    let connections = core_request(state, reqwest::Method::GET, "/connections", None, None)?;
    let items = connections
        .get("connections")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    for item in items {
        let matches_group = item
            .get("chains")
            .and_then(Value::as_array)
            .map(|chains| chains.iter().any(|chain| chain.as_str() == Some(name)))
            .unwrap_or(false);
        if !matches_group {
            continue;
        }

        if let Some(id) = item.get("id").and_then(Value::as_str) {
            let _ = core_request(
                state,
                reqwest::Method::DELETE,
                &format!("/connections/{}", urlencoding::encode(id)),
                None,
                None,
            );
        }
    }

    Ok(())
}

fn get_process_traffic_ranking_value(
    state: &State<'_, CoreState>,
    sort_by: &str,
) -> Result<Value, String> {
    let connections = core_request(state, reqwest::Method::GET, "/connections", None, None)?;
    let items = connections
        .get("connections")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut process_stats = HashMap::<String, Value>::new();
    for item in items {
        let process = item
            .get("metadata")
            .and_then(Value::as_object)
            .and_then(|metadata| metadata.get("process"))
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty() && *value != "-")
            .unwrap_or("未知进程")
            .to_string();
        let host = item
            .get("metadata")
            .and_then(Value::as_object)
            .and_then(|metadata| metadata.get("host"))
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .or_else(|| {
                item.get("metadata")
                    .and_then(Value::as_object)
                    .and_then(|metadata| metadata.get("destinationIP"))
                    .and_then(Value::as_str)
            })
            .unwrap_or("")
            .to_string();
        let upload = item.get("upload").and_then(Value::as_u64).unwrap_or(0);
        let download = item.get("download").and_then(Value::as_u64).unwrap_or(0);

        let entry = process_stats.entry(process.clone()).or_insert_with(|| {
            json!({
                "process": process,
                "host": host,
                "upload": 0_u64,
                "download": 0_u64,
            })
        });

        if let Some(value) = entry.get_mut("upload") {
            *value = json!(value.as_u64().unwrap_or(0) + upload);
        }
        if let Some(value) = entry.get_mut("download") {
            *value = json!(value.as_u64().unwrap_or(0) + download);
        }
        if !host.is_empty() {
            if let Some(value) = entry.get_mut("host") {
                *value = Value::String(host);
            }
        }
    }

    let mut ranking = process_stats.into_values().collect::<Vec<_>>();
    ranking.sort_by(|left, right| {
        let left_value = left.get(sort_by).and_then(Value::as_u64).unwrap_or(0);
        let right_value = right.get(sort_by).and_then(Value::as_u64).unwrap_or(0);
        right_value.cmp(&left_value)
    });
    ranking.truncate(10);
    Ok(Value::Array(ranking))
}

fn get_provider_stats_value(app: &tauri::AppHandle) -> Result<ProviderStatsData, String> {
    let mut stats = read_provider_stats(app)?;
    let today = current_local_date_string();
    let profile_config = read_profile_config(app)?;

    for item in profile_config.items {
        let Some(extra) = item.extra.as_ref() else {
            continue;
        };

        let upload = extra.get("upload").and_then(Value::as_u64).unwrap_or(0);
        let download = extra.get("download").and_then(Value::as_u64).unwrap_or(0);
        let used = upload.saturating_add(download);
        let provider_name = if item.name.trim().is_empty() {
            item.id.clone()
        } else {
            item.name.clone()
        };

        if let Some(snapshot) = stats
            .snapshots
            .iter_mut()
            .find(|snapshot| snapshot.date == today && snapshot.provider == provider_name)
        {
            snapshot.used = used;
        } else {
            stats.snapshots.push(ProviderSnapshotData {
                date: today.clone(),
                provider: provider_name,
                used,
            });
        }
    }

    if stats.snapshots.len() > 4096 {
        stats.snapshots.sort_by(|left, right| {
            left.date
                .cmp(&right.date)
                .then(left.provider.cmp(&right.provider))
        });
        let overflow = stats.snapshots.len() - 4096;
        stats.snapshots.drain(..overflow);
    }

    stats.last_update = current_timestamp_ms();
    write_provider_stats(app, &stats)?;
    Ok(stats)
}

fn clear_provider_stats_value(app: &tauri::AppHandle) -> Result<(), String> {
    write_provider_stats(
        app,
        &ProviderStatsData {
            snapshots: Vec::new(),
            last_update: current_timestamp_ms(),
        },
    )
}

fn test_network_latency() -> i64 {
    let client = match Client::builder().timeout(NETWORK_HEALTH_TIMEOUT).build() {
        Ok(client) => client,
        Err(_) => return 0,
    };
    let started_at = Instant::now();
    match client.head(NETWORK_CONNECTIVITY_CHECK_URL).send() {
        Ok(response) if response.status().is_success() => started_at.elapsed().as_millis() as i64,
        Ok(_) | Err(_) => 0,
    }
}

fn test_dns_latency(domain: &str) -> i64 {
    let started_at = Instant::now();
    match (domain, 80).to_socket_addrs() {
        Ok(mut addrs) => {
            if addrs.next().is_some() {
                let elapsed = started_at.elapsed().as_millis() as i64;
                elapsed.max(1)
            } else {
                0
            }
        }
        Err(_) => 0,
    }
}

fn calculate_network_health_value(state: &NetworkHealthState) -> Value {
    let valid_latencies = state
        .latency_history
        .iter()
        .copied()
        .filter(|latency| *latency > 0)
        .collect::<Vec<_>>();
    let current_latency = state.latency_history.last().copied().unwrap_or(-1);
    let current_dns_latency = state.dns_latency_history.last().copied().unwrap_or(-1);
    let avg_latency = if valid_latencies.is_empty() {
        0
    } else {
        valid_latencies.iter().sum::<i64>() / valid_latencies.len() as i64
    };
    let max_latency = valid_latencies.iter().copied().max().unwrap_or(0);
    let min_latency = valid_latencies.iter().copied().min().unwrap_or(0);
    let jitter = if valid_latencies.len() < 2 {
        0
    } else {
        let sum = valid_latencies
            .windows(2)
            .map(|window| (window[1] - window[0]).abs())
            .sum::<i64>();
        sum / (valid_latencies.len() - 1) as i64
    };
    let packet_loss = if state.test_count == 0 {
        0
    } else {
        ((state.fail_count as f64 / state.test_count as f64) * 100.0).round() as i64
    };
    let uptime = if state.test_count == 0 {
        100.0
    } else {
        (((state.test_count - state.fail_count) as f64 / state.test_count as f64) * 1000.0).round()
            / 10.0
    };

    json!({
        "currentLatency": current_latency,
        "currentDnsLatency": current_dns_latency,
        "avgLatency": avg_latency,
        "maxLatency": max_latency,
        "minLatency": min_latency,
        "jitter": jitter,
        "packetLoss": packet_loss,
        "uptime": uptime,
        "testCount": state.test_count,
        "failCount": state.fail_count,
    })
}

fn run_network_health_test(app: &tauri::AppHandle) {
    let latency = test_network_latency();
    let dns_latency = test_dns_latency("www.bing.com");
    let payload = {
        let state = app.state::<CoreState>();
        let Ok(mut health_state) = state.network_health_state.lock() else {
            return;
        };
        health_state.test_count += 1;
        if latency <= 0 {
            health_state.fail_count += 1;
        }
        health_state.latency_history.push(latency);
        if health_state.latency_history.len() > NETWORK_HEALTH_MAX_HISTORY {
            let overflow = health_state.latency_history.len() - NETWORK_HEALTH_MAX_HISTORY;
            health_state.latency_history.drain(..overflow);
        }
        health_state.dns_latency_history.push(dns_latency);
        if health_state.dns_latency_history.len() > NETWORK_HEALTH_MAX_HISTORY {
            let overflow = health_state.dns_latency_history.len() - NETWORK_HEALTH_MAX_HISTORY;
            health_state.dns_latency_history.drain(..overflow);
        }
        calculate_network_health_value(&health_state)
    };

    emit_ipc_event(app, "networkHealth", payload);
}

fn start_network_health_monitor(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    let mut monitor_handle = state
        .network_health_monitor
        .lock()
        .map_err(|e| e.to_string())?;
    if monitor_handle.is_some() {
        return Ok(());
    }

    let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>();
    let app_handle = app.clone();
    thread::spawn(move || {
        let app_handle = app_handle.clone();
        run_network_health_test(&app_handle);
        loop {
            match shutdown_rx.recv_timeout(NETWORK_HEALTH_TEST_INTERVAL) {
                Ok(_) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    run_network_health_test(&app_handle);
                }
            }
        }
    });

    *monitor_handle = Some(NetworkHealthMonitorHandle {
        shutdown: shutdown_tx,
    });
    Ok(())
}

fn stop_network_health_monitor(state: &State<'_, CoreState>) -> Result<(), String> {
    let mut monitor_handle = state
        .network_health_monitor
        .lock()
        .map_err(|e| e.to_string())?;
    if let Some(handle) = monitor_handle.take() {
        let _ = handle.shutdown.send(());
    }
    Ok(())
}

fn start_core_events_monitor(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    let controller_url = current_controller_url(state)?
        .ok_or_else(|| "Mihomo controller is not available".to_string())?;
    let connection_interval = Duration::from_millis(read_connection_interval_ms(app));

    stop_core_events_monitor(state)?;

    let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>();
    let app_handle = app.clone();
    thread::spawn(move || {
        let client = match Client::builder().timeout(Duration::from_secs(3)).build() {
            Ok(client) => client,
            Err(_) => return,
        };
        let connections_url = format!("{controller_url}/connections");
        let mut last_totals: Option<(u64, u64, Instant)> = None;

        loop {
            if let Ok(response) = client.get(&connections_url).send() {
                if response.status().is_success() {
                    if let Ok(snapshot) = response.json::<Value>() {
                        let now = Instant::now();
                        let upload_total = json_u64(snapshot.get("uploadTotal"));
                        let download_total = json_u64(snapshot.get("downloadTotal"));
                        let (up, down) = if let Some((last_upload, last_download, last_at)) =
                            last_totals
                        {
                            let elapsed_ms = now.duration_since(last_at).as_millis().max(1) as u64;
                            (
                                upload_total
                                    .saturating_sub(last_upload)
                                    .saturating_mul(1000)
                                    / elapsed_ms,
                                download_total
                                    .saturating_sub(last_download)
                                    .saturating_mul(1000)
                                    / elapsed_ms,
                            )
                        } else {
                            (0, 0)
                        };

                        last_totals = Some((upload_total, download_total, now));
                        emit_ipc_event(
                            &app_handle,
                            "mihomoTraffic",
                            json!({ "up": up, "down": down }),
                        );
                    }
                }
            }

            match shutdown_rx.recv_timeout(connection_interval) {
                Ok(_) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
                Err(mpsc::RecvTimeoutError::Timeout) => {}
            }
        }
    });

    let mut monitor_handle = state
        .core_events_monitor
        .lock()
        .map_err(|e| e.to_string())?;
    *monitor_handle = Some(CoreEventsMonitorHandle {
        shutdown: shutdown_tx,
    });
    Ok(())
}

fn stop_core_events_monitor(state: &State<'_, CoreState>) -> Result<(), String> {
    let mut monitor_handle = state
        .core_events_monitor
        .lock()
        .map_err(|e| e.to_string())?;
    if let Some(handle) = monitor_handle.take() {
        let _ = handle.shutdown.send(());
    }
    Ok(())
}

fn get_network_health_stats_value(state: &State<'_, CoreState>) -> Result<Value, String> {
    let health_state = state
        .network_health_state
        .lock()
        .map_err(|e| e.to_string())?;
    Ok(calculate_network_health_value(&health_state))
}

fn get_app_uptime_seconds() -> u64 {
    APP_STARTED_AT.get_or_init(Instant::now).elapsed().as_secs()
}

fn collect_process_memory_snapshot() -> Value {
    let pid = std::process::id();
    let mut snapshot = json!({
        "pid": pid,
        "platform": platform_name(),
        "timestamp": current_timestamp_ms(),
        "uptimeSeconds": get_app_uptime_seconds(),
        "executable": std::env::current_exe()
            .ok()
            .map(|path| path.to_string_lossy().to_string()),
    });

    #[cfg(target_os = "windows")]
    {
        let script = format!(
            r#"
$process = Get-Process -Id {pid} -ErrorAction SilentlyContinue
if ($null -ne $process) {{
  [pscustomobject]@{{
    workingSet = [int64]$process.WorkingSet64
    privateMemory = [int64]$process.PrivateMemorySize64
    virtualMemory = [int64]$process.VirtualMemorySize64
    pagedMemory = [int64]$process.PagedMemorySize64
    handleCount = [int]$process.HandleCount
    threadCount = [int]$process.Threads.Count
  }} | ConvertTo-Json -Compress
}}
"#
        );

        if let Ok(output) = powershell_command()
            .args(["-NoProfile", "-Command", &script])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if let Ok(Value::Object(values)) = serde_json::from_str::<Value>(&stdout) {
                    if let Some(object) = snapshot.as_object_mut() {
                        object.extend(values);
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let pid_string = pid.to_string();
        if let Ok(output) = Command::new("ps")
            .args(["-o", "rss=,vsz=", "-p", &pid_string])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let parts = stdout.split_whitespace().collect::<Vec<_>>();
                if let Some(object) = snapshot.as_object_mut() {
                    if let Some(rss_kb) = parts.first().and_then(|value| value.parse::<u64>().ok())
                    {
                        object.insert("residentSetKb".to_string(), json!(rss_kb));
                    }
                    if let Some(vsz_kb) = parts.get(1).and_then(|value| value.parse::<u64>().ok()) {
                        object.insert("virtualMemoryKb".to_string(), json!(vsz_kb));
                    }
                }
            }
        }
    }

    snapshot
}

fn create_heap_snapshot(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<String, String> {
    let (base_dir, _, _, _) = ensure_runtime_dirs(app, None, false)?;
    let diagnostics_dir = base_dir.join("diagnostics");
    fs::create_dir_all(&diagnostics_dir).map_err(|e| e.to_string())?;

    let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    let output_path = diagnostics_dir.join(format!(
        "{}-diagnostic.heapsnapshot.json",
        current_timestamp_ms()
    ));
    let payload = json!({
        "kind": "tauri-diagnostic-snapshot",
        "process": collect_process_memory_snapshot(),
        "runtime": {
            "binaryPath": runtime.binary_path.as_ref().map(|path| path.to_string_lossy().to_string()),
            "workDir": runtime.work_dir.as_ref().map(|path| path.to_string_lossy().to_string()),
            "logPath": runtime.log_path.as_ref().map(|path| path.to_string_lossy().to_string()),
            "controllerUrl": runtime.controller_url.clone(),
            "configPath": runtime.config_path.as_ref().map(|path| path.to_string_lossy().to_string()),
        }
    });
    drop(runtime);

    write_json_file(&output_path, &payload)?;
    Ok(output_path.to_string_lossy().to_string())
}

fn convert_mrs_ruleset(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
    behavior: &str,
) -> Result<String, String> {
    let source = resolve_runtime_file_path(app, state, raw_path)?;
    if !source.exists() {
        return Err(format!("规则文件不存在: {}", source.display()));
    }

    let binary = resolve_core_binary(app, "mihomo")?;
    let output = std::env::temp_dir().join(format!("routex-mrs-{}.txt", create_id()));

    let status = Command::new(binary)
        .arg("convert-ruleset")
        .arg(behavior)
        .arg("mrs")
        .arg(&source)
        .arg(&output)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err(format!("convert-ruleset 执行失败: {}", status));
    }

    let text = fs::read_to_string(&output).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(output);
    Ok(text)
}

fn open_path_in_shell(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg(path);
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(path);
        command
    };

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        command
    };

    command.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

fn open_external_url(url: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| format!("无效的外部链接: {e}"))?;
    match parsed.scheme() {
        "http" | "https" | "mailto" => {}
        scheme => {
            return Err(format!("不支持的外部链接协议: {scheme}"));
        }
    }

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("rundll32");
        command
            .arg("url.dll,FileProtocolHandler")
            .arg(parsed.as_str());
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(parsed.as_str());
        command
    };

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(parsed.as_str());
        command
    };

    command.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

