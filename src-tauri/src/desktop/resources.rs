fn command_exists(command: &str) -> bool {
    let locator = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };
    Command::new(locator)
        .arg(command)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn find_system_mihomo_paths() -> Vec<String> {
    let mut found_paths = Vec::new();
    let mut seen = HashSet::new();
    let search_names = ["mihomo", "clash"];

    let mut push_candidate = |path: PathBuf| {
        if path.exists() {
            let value = path.to_string_lossy().to_string();
            if seen.insert(value.clone()) {
                found_paths.push(value);
            }
        }
    };

    for name in search_names {
        let locator = if cfg!(target_os = "windows") {
            "where"
        } else {
            "which"
        };
        if let Ok(output) = Command::new(locator).arg(name).output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout
                    .lines()
                    .map(str::trim)
                    .filter(|line| !line.is_empty())
                {
                    push_candidate(PathBuf::from(line));
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut common_dirs = vec![
            PathBuf::from("/bin"),
            PathBuf::from("/usr/bin"),
            PathBuf::from("/usr/local/bin"),
        ];
        if let Ok(home_dir) = user_home_dir() {
            common_dirs.push(home_dir.join(".local").join("bin"));
            common_dirs.push(home_dir.join("bin"));
        }

        for dir in common_dirs {
            if !dir.exists() {
                continue;
            }

            for name in search_names {
                push_candidate(dir.join(name));
            }
        }
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    if command_exists("brew") {
        for name in search_names {
            if let Ok(output) = Command::new("brew").args(["--prefix", name]).output() {
                if output.status.success() {
                    let prefix = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !prefix.is_empty() {
                        push_candidate(PathBuf::from(prefix).join("bin").join(name));
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    if command_exists("scoop") {
        for name in search_names {
            if let Ok(output) = Command::new("scoop").args(["which", name]).output() {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    for line in stdout
                        .lines()
                        .map(str::trim)
                        .filter(|line| !line.is_empty())
                    {
                        push_candidate(PathBuf::from(line));
                    }
                }
            }
        }
    }

    found_paths.sort();
    found_paths
}

fn build_proxy_env_command(app: &tauri::AppHandle, shell_type: &str) -> Result<String, String> {
    let app_config = read_app_config_store(app)?;
    let controlled_config = read_controlled_config_store(app)?;
    let sys_proxy = app_config.get("sysProxy").and_then(Value::as_object);
    let host = sys_proxy
        .and_then(|value| value.get("host"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("127.0.0.1");
    let bypass = json_array_strings(sys_proxy.and_then(|value| value.get("bypass"))).join(",");
    let mixed_port = controlled_config
        .get("mixed-port")
        .and_then(Value::as_u64)
        .unwrap_or(7890);
    let proxy_url = format!("http://{host}:{mixed_port}");

    match shell_type {
        "bash" => Ok(format!(
            "export https_proxy={proxy_url} http_proxy={proxy_url} all_proxy={proxy_url} no_proxy={bypass}"
        )),
        "cmd" => Ok(format!(
            "set http_proxy={proxy_url}\r\nset https_proxy={proxy_url}\r\nset no_proxy={bypass}"
        )),
        "powershell" => Ok(format!(
            "$env:HTTP_PROXY=\"{proxy_url}\"; $env:HTTPS_PROXY=\"{proxy_url}\"; $env:no_proxy=\"{bypass}\""
        )),
        "nushell" => Ok(format!(
            "load-env {{http_proxy:\"{proxy_url}\", https_proxy:\"{proxy_url}\", no_proxy:\"{bypass}\"}}"
        )),
        other => Err(format!("不支持的终端类型: {other}")),
    }
}

#[cfg(target_os = "windows")]
fn copy_text_to_clipboard(text: &str) -> Result<(), String> {
    let script = format!(
        r#"
$clipboardText = @'
{text}
'@
Set-Clipboard -Value $clipboardText
"#
    );
    run_powershell_script(&script).map(|_| ())
}

#[cfg(target_os = "macos")]
fn copy_text_to_clipboard(text: &str) -> Result<(), String> {
    let mut child = Command::new("pbcopy")
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    let Some(stdin) = child.stdin.as_mut() else {
        return Err("无法写入 pbcopy 标准输入".to_string());
    };
    stdin
        .write_all(text.as_bytes())
        .map_err(|e| e.to_string())?;
    let status = child.wait().map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("pbcopy 执行失败: {status}"))
    }
}

#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
fn copy_text_to_clipboard(text: &str) -> Result<(), String> {
    for program in ["wl-copy", "xclip", "xsel"] {
        let mut command = Command::new(program);
        match program {
            "xclip" => {
                command.args(["-selection", "clipboard"]);
            }
            "xsel" => {
                command.args(["--clipboard", "--input"]);
            }
            _ => {}
        }

        let Ok(mut child) = command.stdin(Stdio::piped()).spawn() else {
            continue;
        };
        if let Some(stdin) = child.stdin.as_mut() {
            stdin
                .write_all(text.as_bytes())
                .map_err(|e| e.to_string())?;
        }
        let status = child.wait().map_err(|e| e.to_string())?;
        if status.success() {
            return Ok(());
        }
    }

    Err("当前系统未找到可用的剪贴板命令".to_string())
}

fn allocate_controller_address() -> Result<String, String> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let address = listener.local_addr().map_err(|e| e.to_string())?;
    drop(listener);
    Ok(format!("127.0.0.1:{}", address.port()))
}

fn configured_external_controller_address(input: Option<&Value>) -> Option<String> {
    input
        .and_then(Value::as_object)
        .and_then(|config| config.get("external-controller"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn controller_connect_address(listen_address: &str) -> String {
    let trimmed = listen_address.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let value = trimmed
        .strip_prefix("http://")
        .or_else(|| trimmed.strip_prefix("https://"))
        .unwrap_or(trimmed);

    if let Some(port) = value.strip_prefix(':') {
        return format!("127.0.0.1:{port}");
    }

    if value.starts_with('[') {
        if let Some((host, port)) = value.split_once("]:") {
            let normalized_host = match host {
                "[::" | "[::0" | "[::0.0.0.0" => "127.0.0.1".to_string(),
                _ => format!("{host}]"),
            };
            return format!("{normalized_host}:{port}");
        }
        return value.to_string();
    }

    let Some((host, port)) = value.rsplit_once(':') else {
        return value.to_string();
    };

    let normalized_host = match host.trim() {
        "" | "*" | "0.0.0.0" | "::" => "127.0.0.1",
        other => other,
    };

    format!("{normalized_host}:{port}")
}

fn dev_root() -> Result<PathBuf, String> {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "failed to resolve repo root".to_string())
}

fn current_exe_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
}

fn push_resource_candidate(
    candidates: &mut Vec<PathBuf>,
    seen: &mut HashSet<PathBuf>,
    path: PathBuf,
) {
    if seen.insert(path.clone()) {
        candidates.push(path);
    }
}

fn collect_resource_candidates(
    app: &tauri::AppHandle,
    relative_dir: &str,
    file_name: &str,
) -> Result<Vec<PathBuf>, String> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    if cfg!(debug_assertions) {
        push_resource_candidate(
            &mut candidates,
            &mut seen,
            dev_root()?.join("extra").join(relative_dir).join(file_name),
        );
    }

    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    for base in [resource_dir.clone(), resource_dir.join("extra")] {
        if !base.as_os_str().is_empty() {
            push_resource_candidate(
                &mut candidates,
                &mut seen,
                base.join(relative_dir).join(file_name),
            );
        }
    }

    if let Some(exe_dir) = current_exe_dir() {
        for base in [
            exe_dir.clone(),
            exe_dir.join("resources"),
            exe_dir
                .parent()
                .map(|path| path.join("Resources"))
                .unwrap_or_default(),
        ] {
            if !base.as_os_str().is_empty() {
                push_resource_candidate(
                    &mut candidates,
                    &mut seen,
                    base.join(relative_dir).join(file_name),
                );
            }
        }
    }

    Ok(candidates)
}

fn resolve_resource_binary(
    app: &tauri::AppHandle,
    relative_dir: &str,
    file_name: &str,
) -> Result<PathBuf, String> {
    let candidates = collect_resource_candidates(app, relative_dir, file_name)?;
    for path in &candidates {
        if path.exists() {
            return Ok(path.clone());
        }
    }

    let searched = candidates
        .iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(", ");
    Err(format!(
        "Resource not found: {relative_dir}/{file_name}. searched: {searched}"
    ))
}

fn resolve_core_binary(app: &tauri::AppHandle, core: &str) -> Result<PathBuf, String> {
    let extension = if cfg!(target_os = "windows") {
        ".exe"
    } else {
        ""
    };
    let file_name = format!("{core}{extension}");
    resolve_resource_binary(app, "sidecar", &file_name)
        .map_err(|_| format!("Mihomo core not found: {file_name}"))
}

fn resolve_service_binary(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let extension = if cfg!(target_os = "windows") {
        ".exe"
    } else {
        ""
    };
    let file_name = format!("routex-service{extension}");
    resolve_resource_binary(app, "files", &file_name)
        .map_err(|_| format!("RouteX service not found: {file_name}"))
}

