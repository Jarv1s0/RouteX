fn get_interfaces_value() -> Value {
    #[cfg(target_os = "windows")]
    {
        let script = r#"
$items = Get-NetIPAddress |
  Where-Object {
    $_.InterfaceAlias -and
    $_.IPAddress -ne '127.0.0.1' -and
    $_.IPAddress -ne '::1' -and
    $_.IPAddress -notlike '169.254*' -and
    $_.IPAddress -notlike 'fe80*'
  } |
  Select-Object InterfaceAlias, AddressFamily, IPAddress
$items | ConvertTo-Json -Compress
"#;
        let output = match powershell_command()
            .args(["-NoProfile", "-Command", script])
            .output()
        {
            Ok(output) if output.status.success() => output,
            _ => return json!({}),
        };

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            return json!({});
        }

        let records = match serde_json::from_str::<Value>(&stdout) {
            Ok(Value::Array(items)) => items,
            Ok(Value::Object(item)) => vec![Value::Object(item)],
            _ => return json!({}),
        };

        let mut interfaces = serde_json::Map::new();
        for record in records {
            let name = record
                .get("InterfaceAlias")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim()
                .to_string();
            let address = record
                .get("IPAddress")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim()
                .to_string();
            if name.is_empty() || address.is_empty() {
                continue;
            }

            let family = match record
                .get("AddressFamily")
                .and_then(Value::as_str)
                .unwrap_or_default()
            {
                "IPv6" => "IPv6",
                _ => "IPv4",
            };

            let entry = interfaces
                .entry(name.clone())
                .or_insert_with(|| Value::Array(Vec::new()));
            if let Some(items) = entry.as_array_mut() {
                items.push(json!({
                    "address": address,
                    "family": family,
                    "internal": false,
                    "cidr": Value::Null,
                    "mac": Value::Null,
                    "netmask": Value::Null,
                }));
            }
        }

        return Value::Object(interfaces);
    }

    #[cfg(not(target_os = "windows"))]
    {
        json!({})
    }
}

fn runtime_files_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    ensure_dir(
        app_data_root(app)?
            .join(RUNTIME_ASSETS_DIR_NAME)
            .join("files"),
    )
}

fn traffic_monitor_pid_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root(app)?.join(TRAFFIC_MONITOR_PID_FILE))
}

fn fetch_latest_github_release_assets(
    app: &tauri::AppHandle,
    repo: &str,
) -> Result<Vec<GitHubReleaseAsset>, String> {
    let client = update_client(app, 30)?;
    let response = client
        .get(format!(
            "https://api.github.com/repos/{repo}/releases/latest"
        ))
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
        .send()
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("请求失败: {}", response.status()));
    }

    Ok(response
        .json::<GitHubReleaseResponse>()
        .map_err(|e| e.to_string())?
        .assets
        .unwrap_or_default())
}

fn score_traffic_monitor_asset_name(name: &str) -> i32 {
    let mut score = 0;
    if name.contains("lite") {
        score += 10;
    }
    if name.contains("portable") {
        score += 1;
    }
    score
}

fn pick_traffic_monitor_asset(
    assets: &[GitHubReleaseAsset],
    arch: &str,
) -> Result<GitHubReleaseAsset, String> {
    let candidates = assets
        .iter()
        .filter_map(|asset| {
            let normalized_name = asset.name.to_ascii_lowercase();
            if !normalized_name.ends_with(".zip") || !normalized_name.contains("trafficmonitor") {
                return None;
            }

            let matches_arch = match arch {
                "x86_64" => normalized_name.contains("x64") || normalized_name.contains("amd64"),
                "x86" => normalized_name.contains("x86") || normalized_name.contains("386"),
                "aarch64" => {
                    normalized_name.contains("arm64") || normalized_name.contains("arm64ec")
                }
                _ => false,
            };

            if !matches_arch {
                return None;
            }

            Some((
                score_traffic_monitor_asset_name(&normalized_name),
                asset.clone(),
            ))
        })
        .collect::<Vec<_>>();

    candidates
        .into_iter()
        .min_by_key(|(score, _)| *score)
        .map(|(_, asset)| asset)
        .ok_or_else(|| {
            format!(
                "No matched TrafficMonitor asset found for {}",
                std::env::consts::ARCH
            )
        })
}

fn extract_zip_bytes(bytes: &[u8], output_dir: &Path) -> Result<(), String> {
    let reader = Cursor::new(bytes);
    let mut archive = ZipArchive::new(reader).map_err(|e| e.to_string())?;

    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|e| e.to_string())?;
        let Some(enclosed_name) = file.enclosed_name().map(Path::to_path_buf) else {
            continue;
        };

        let output_path = output_dir.join(enclosed_name);
        if file.is_dir() {
            fs::create_dir_all(&output_path).map_err(|e| e.to_string())?;
            continue;
        }

        ensure_parent(&output_path)?;
        let mut output_file = fs::File::create(&output_path).map_err(|e| e.to_string())?;
        std::io::copy(&mut file, &mut output_file).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn ensure_traffic_monitor_binary(app: &tauri::AppHandle) -> Result<(PathBuf, PathBuf), String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(executable_path) = resolve_resource_binary(
            app,
            "files/TrafficMonitor/TrafficMonitor",
            "TrafficMonitor.exe",
        ) {
            let cwd = executable_path
                .parent()
                .map(Path::to_path_buf)
                .ok_or_else(|| "invalid TrafficMonitor cwd".to_string())?;
            return Ok((executable_path, cwd));
        }

        let runtime_root = runtime_files_dir(app)?.join("TrafficMonitor");
        let runtime_executable_path = runtime_root
            .join("TrafficMonitor")
            .join("TrafficMonitor.exe");

        if runtime_executable_path.exists() {
            let cwd = runtime_executable_path
                .parent()
                .map(Path::to_path_buf)
                .ok_or_else(|| "invalid TrafficMonitor cwd".to_string())?;
            return Ok((runtime_executable_path, cwd));
        }

        let asset = pick_traffic_monitor_asset(
            &fetch_latest_github_release_assets(app, TRAFFIC_MONITOR_REPO)?,
            std::env::consts::ARCH,
        )?;
        let client = update_client(app, 60)?;
        let response = client
            .get(&asset.browser_download_url)
            .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
            .send()
            .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            return Err(format!("下载 TrafficMonitor 失败: {}", response.status()));
        }

        let bytes = response.bytes().map_err(|e| e.to_string())?;
        extract_zip_bytes(&bytes, &runtime_root)?;

        if !runtime_executable_path.exists() {
            return Err("TrafficMonitor 下载完成但未找到可执行文件".to_string());
        }

        let cwd = runtime_executable_path
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "invalid TrafficMonitor cwd".to_string())?;
        return Ok((runtime_executable_path, cwd));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("当前平台不支持 TrafficMonitor".to_string())
    }
}

fn stop_traffic_monitor(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let pid_path = traffic_monitor_pid_path(app)?;
        if !pid_path.exists() {
            return Ok(());
        }

        let pid = fs::read_to_string(&pid_path)
            .map_err(|e| e.to_string())?
            .trim()
            .parse::<u32>()
            .ok();
        let _ = fs::remove_file(&pid_path);

        if let Some(pid) = pid {
            let mut command = Command::new("taskkill");
            apply_background_command(&mut command);
            let output = command
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .output()
                .map_err(|e| e.to_string())?;
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let combined = if stderr.is_empty() { stdout } else { stderr };
                let normalized = combined.to_ascii_lowercase();
                if !normalized.contains("not found")
                    && !combined.contains("没有找到")
                    && !combined.contains("找不到")
                {
                    return Err(if combined.is_empty() {
                        format!("停止 TrafficMonitor 失败: {}", output.status)
                    } else {
                        combined
                    });
                }
            }
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Ok(())
    }
}

fn start_traffic_monitor(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        stop_traffic_monitor(app)?;

        let show_traffic = read_app_config_store(app)?
            .get("showTraffic")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if !show_traffic {
            return Ok(());
        }

        let (executable_path, cwd) = ensure_traffic_monitor_binary(app)?;
        let child = Command::new(&executable_path)
            .current_dir(cwd)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| e.to_string())?;

        fs::write(traffic_monitor_pid_path(app)?, child.id().to_string())
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Ok(())
    }
}

fn download_binary_file(url: &str, target_path: &Path) -> Result<(), String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
        .send()
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("下载失败: {}", response.status()));
    }

    let bytes = response.bytes().map_err(|e| e.to_string())?;
    ensure_parent(target_path)?;
    fs::write(target_path, bytes).map_err(|e| e.to_string())
}

fn ensure_enable_loopback_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = resolve_resource_binary(app, "files", "enableLoopback.exe") {
        return Ok(path);
    }

    let runtime_path = runtime_files_dir(app)?.join("enableLoopback.exe");
    if runtime_path.exists() {
        return Ok(runtime_path);
    }

    download_binary_file(ENABLE_LOOPBACK_URL, &runtime_path)?;
    Ok(runtime_path)
}

fn open_uwp_tool(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let tool_path = ensure_enable_loopback_path(app)?;
        Command::new(tool_path).spawn().map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("当前平台不支持 UWP 工具".to_string())
    }
}
