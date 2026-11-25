use super::prelude::*;
use super::*;

pub(crate) fn current_controller_url(
    state: &State<'_, CoreState>,
) -> Result<Option<String>, String> {
    let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    Ok(runtime.controller_url.clone())
}

pub(crate) fn json_u64(value: Option<&Value>) -> u64 {
    value
        .and_then(Value::as_u64)
        .or_else(|| value.and_then(Value::as_i64).map(|v| v.max(0) as u64))
        .unwrap_or(0)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrafficTotalsSnapshot {
    #[serde(default)]
    upload_total: Option<Value>,
    #[serde(default)]
    download_total: Option<Value>,
}

#[cfg(test)]
mod traffic_totals_tests {
    use super::{json_u64, TrafficTotalsSnapshot};

    #[test]
    fn compact_snapshot_preserves_traffic_total_defaults() {
        for (json, expected_upload, expected_download) in [
            (r#"{}"#, 0, 0),
            (r#"{"uploadTotal":null,"downloadTotal":null}"#, 0, 0),
            (r#"{"uploadTotal":-1,"downloadTotal":-9}"#, 0, 0),
            (r#"{"uploadTotal":1.5,"downloadTotal":"4"}"#, 0, 0),
            (r#"{"uploadTotal":12,"downloadTotal":34}"#, 12, 34),
        ] {
            let snapshot: TrafficTotalsSnapshot = serde_json::from_str(json).unwrap();
            assert_eq!(json_u64(snapshot.upload_total.as_ref()), expected_upload);
            assert_eq!(
                json_u64(snapshot.download_total.as_ref()),
                expected_download
            );
        }
    }
}

pub(crate) fn close_connections_by_group(
    state: &State<'_, CoreState>,
    name: &str,
) -> Result<(), String> {
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
            .is_some_and(|chains| chains.iter().any(|chain| chain.as_str() == Some(name)));
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

pub(crate) fn test_network_latency() -> i64 {
    let client = match external_http_client() {
        Ok(client) => client,
        Err(_) => return 0,
    };
    let started_at = Instant::now();
    match client
        .head(NETWORK_CONNECTIVITY_CHECK_URL)
        .timeout(NETWORK_HEALTH_TIMEOUT)
        .send()
    {
        Ok(response) if response.status().is_success() => started_at.elapsed().as_millis() as i64,
        Ok(_) | Err(_) => 0,
    }
}

pub(crate) fn test_dns_latency(domain: &str) -> i64 {
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

pub(crate) fn calculate_network_health_value(state: &NetworkHealthState) -> Value {
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

pub(crate) fn run_network_health_test(app: &tauri::AppHandle) {
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

pub(crate) fn start_network_health_monitor(
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

pub(crate) fn stop_network_health_monitor(state: &State<'_, CoreState>) -> Result<(), String> {
    let mut monitor_handle = state
        .network_health_monitor
        .lock()
        .map_err(|e| e.to_string())?;
    if let Some(handle) = monitor_handle.take() {
        let _ = handle.shutdown.send(());
    }
    Ok(())
}

pub(crate) fn traffic_delta(current: u64, previous: u64) -> u64 {
    current.checked_sub(previous).unwrap_or(current)
}

pub(crate) fn traffic_rate(delta: u64, elapsed: Duration) -> u64 {
    (u128::from(delta) * 1000 / elapsed.as_millis().max(1)).min(u128::from(u64::MAX)) as u64
}

#[derive(Default)]
pub(crate) struct TrafficSampler {
    last_sample: Option<(u64, u64, Instant)>,
    pending: (u64, u64),
}

impl TrafficSampler {
    pub(crate) fn sample(&mut self, upload: u64, download: u64, now: Instant) -> (u64, u64) {
        let (previous_upload, previous_download, previous_at) =
            *self.last_sample.get_or_insert((upload, download, now));
        let upload_delta = traffic_delta(upload, previous_upload);
        let download_delta = traffic_delta(download, previous_download);
        // Realtime rates always use the last observed sample, independently of history I/O.
        self.last_sample = Some((upload, download, now));
        self.pending.0 = self.pending.0.saturating_add(upload_delta);
        self.pending.1 = self.pending.1.saturating_add(download_delta);
        let elapsed = now.duration_since(previous_at);
        (
            traffic_rate(upload_delta, elapsed),
            traffic_rate(download_delta, elapsed),
        )
    }

    pub(crate) fn pending_delta(&self) -> (u64, u64) {
        self.pending
    }

    pub(crate) fn commit_recording(&mut self) {
        self.pending = (0, 0);
    }
}

fn stop_core_events_handle(handle: CoreEventsMonitorHandle) -> Result<(), String> {
    let _ = handle.shutdown.send(());
    handle
        .thread
        .join()
        .map_err(|_| "流量监控线程退出失败".to_string())
}

pub(crate) fn start_core_events_monitor(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    let (controller_url, secret) = {
        let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
        let url = runtime
            .controller_url
            .clone()
            .ok_or_else(|| "Mihomo controller is not available".to_string())?;
        (url, runtime.controller_secret.clone())
    };
    let connection_interval = Duration::from_millis(read_connection_interval_ms(app));

    let mut monitor_handle = state
        .core_events_monitor
        .lock()
        .map_err(|e| e.to_string())?;
    if let Some(handle) = monitor_handle.take() {
        stop_core_events_handle(handle)?;
    }

    let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>();
    let app_handle = app.clone();
    let monitor_thread = thread::spawn(move || {
        let client = match Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(3))
            .build()
        {
            Ok(client) => client,
            Err(_) => return,
        };
        let connections_url = format!("{controller_url}/connections");
        let mut sampler = TrafficSampler::default();

        loop {
            let traffic_path = storage_file(&app_handle, TRAFFIC_STATS_FILE);
            let mut request = client.get(&connections_url);
            if !secret.is_empty() {
                request = request.bearer_auth(&secret);
            }
            if let Ok(response) = request.send() {
                if response.status().is_success() {
                    if let Ok(snapshot) = response.json::<TrafficTotalsSnapshot>() {
                        let now = Instant::now();
                        let upload_total = json_u64(snapshot.upload_total.as_ref());
                        let download_total = json_u64(snapshot.download_total.as_ref());
                        let (up, down) = sampler.sample(upload_total, download_total, now);
                        let (upload, download) = sampler.pending_delta();

                        let totals = (|| -> Result<(u64, u64), String> {
                            let path = traffic_path.as_ref().map_err(Clone::clone)?;
                            let state = app_handle.state::<CoreState>();
                            let mut buffer =
                                state.traffic_stats.lock().map_err(|e| e.to_string())?;
                            let local_now = OffsetDateTime::now_local()
                                .unwrap_or_else(|_| OffsetDateTime::now_utc());
                            let totals = buffer.record(path, upload, download, local_now)?;
                            Ok(totals)
                        })();
                        let mut payload = json!({
                            "up": up,
                            "down": down,
                            "timestamp": current_timestamp_ms(),
                        });
                        match totals {
                            Ok((session_upload, session_download)) => {
                                sampler.commit_recording();
                                payload["sessionUpload"] = json!(session_upload);
                                payload["sessionDownload"] = json!(session_download);
                            }
                            Err(error) => eprintln!("[desktop.traffic] 统计失败: {error}"),
                        }
                        emit_ipc_event(&app_handle, "mihomoTraffic", payload);
                    }
                }
            }

            // Persistence retries continue even when the controller is unavailable.
            let persist = (|| -> Result<(), String> {
                let path = traffic_path.as_ref().map_err(Clone::clone)?;
                app_handle
                    .state::<CoreState>()
                    .traffic_stats
                    .lock()
                    .map_err(|e| e.to_string())?
                    .flush(path, false)
            })();
            if let Err(error) = persist {
                eprintln!("[desktop.traffic] 保存统计失败，将重试: {error}");
            }

            match shutdown_rx.recv_timeout(connection_interval) {
                Ok(_) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
                Err(mpsc::RecvTimeoutError::Timeout) => {}
            }
        }
        if let Err(error) = flush_traffic_stats(&app_handle) {
            eprintln!("[desktop.traffic] 停止时保存统计失败: {error}");
        }
    });

    *monitor_handle = Some(CoreEventsMonitorHandle {
        shutdown: shutdown_tx,
        thread: monitor_thread,
    });
    Ok(())
}

pub(crate) fn stop_core_events_monitor(state: &State<'_, CoreState>) -> Result<(), String> {
    let mut monitor_handle = state
        .core_events_monitor
        .lock()
        .map_err(|e| e.to_string())?;
    if let Some(handle) = monitor_handle.take() {
        stop_core_events_handle(handle)?;
    }
    Ok(())
}

pub(crate) fn get_network_health_stats_value(
    state: &State<'_, CoreState>,
) -> Result<Value, String> {
    let health_state = state
        .network_health_state
        .lock()
        .map_err(|e| e.to_string())?;
    Ok(calculate_network_health_value(&health_state))
}

pub(crate) fn get_app_uptime_seconds() -> u64 {
    APP_STARTED_AT.get_or_init(Instant::now).elapsed().as_secs()
}

pub(crate) fn collect_process_memory_snapshot() -> Value {
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

    let mut sys = sysinfo::System::new();
    let sys_pid = sysinfo::Pid::from_u32(pid);
    sys.refresh_processes_specifics(
        sysinfo::ProcessesToUpdate::Some(&[sys_pid]),
        true,
        sysinfo::ProcessRefreshKind::nothing().with_memory(),
    );
    if let Some(process) = sys.process(sys_pid) {
        if let Some(object) = snapshot.as_object_mut() {
            object.insert("residentSetKb".to_string(), json!(process.memory() / 1024));
            object.insert(
                "virtualMemoryKb".to_string(),
                json!(process.virtual_memory() / 1024),
            );

            #[cfg(target_os = "windows")]
            {
                object.insert("workingSet".to_string(), json!(process.memory()));
                object.insert("virtualMemory".to_string(), json!(process.virtual_memory()));
            }
        }
    }

    snapshot
}

pub(crate) fn create_heap_snapshot(
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

pub(crate) fn convert_mrs_ruleset(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
    behavior: &str,
) -> Result<String, String> {
    let behavior = match behavior
        .trim()
        .to_ascii_lowercase()
        .replace(['-', '_'], "")
        .as_str()
    {
        "domain" => "domain",
        "ipcidr" => "ipcidr",
        "classical" => "classical",
        other => return Err(format!("不支持的 MRS 规则类型: {other}")),
    };
    let source = resolve_runtime_file_path(app, state, raw_path)?;
    if !source.exists() {
        return Err(format!("规则文件不存在: {}", source.display()));
    }

    let binary = resolve_core_binary(app, "mihomo")?;
    let output = std::env::temp_dir().join(format!("routex-mrs-{}.txt", create_id()));

    let mut command = Command::new(binary);
    apply_background_command(&mut command);
    let output_result = command
        .arg("convert-ruleset")
        .arg(behavior)
        .arg("mrs")
        .arg(&source)
        .arg(&output)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| e.to_string())?;

    if !output_result.status.success() {
        let stderr = String::from_utf8_lossy(&output_result.stderr)
            .trim()
            .to_string();
        let stdout = String::from_utf8_lossy(&output_result.stdout)
            .trim()
            .to_string();
        let detail = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            output_result.status.to_string()
        };
        let _ = fs::remove_file(output);
        return Err(format!("convert-ruleset 执行失败: {detail}"));
    }

    let text = fs::read_to_string(&output).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(output);
    Ok(text)
}

pub(crate) fn open_path_in_shell(path: &Path) -> Result<(), String> {
    open::that_detached(path).map_err(|e| e.to_string())
}

pub(crate) fn open_external_url(url: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| format!("无效的外部链接: {e}"))?;
    match parsed.scheme() {
        "http" | "https" | "mailto" => {}
        scheme => {
            return Err(format!("不支持的外部链接协议: {scheme}"));
        }
    }

    open::that_detached(parsed.as_str()).map_err(|e| e.to_string())
}
