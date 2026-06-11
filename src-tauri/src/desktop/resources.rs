use super::prelude::*;
use super::*;

pub(crate) fn command_exists(command: &str) -> bool {
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
        .is_ok_and(|status| status.success())
}

pub(crate) fn find_system_mihomo_paths() -> Vec<String> {
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

pub(crate) fn build_proxy_env_command(
    app: &tauri::AppHandle,
    shell_type: &str,
) -> Result<String, String> {
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

pub(crate) fn copy_text_to_clipboard(text: &str) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(text).map_err(|e| e.to_string())
}

pub(crate) fn allocate_controller_address() -> Result<String, String> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let address = listener.local_addr().map_err(|e| e.to_string())?;
    drop(listener);
    Ok(format!("127.0.0.1:{}", address.port()))
}

pub(crate) fn configured_external_controller_address(input: Option<&Value>) -> Option<String> {
    input
        .and_then(Value::as_object)
        .and_then(|config| config.get("external-controller"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

pub(crate) fn controller_connect_address(listen_address: &str) -> String {
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

pub(crate) fn dev_root() -> Result<PathBuf, String> {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "failed to resolve repo root".to_string())
}

pub(crate) fn current_exe_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
}

pub(crate) fn push_resource_candidate(
    candidates: &mut Vec<PathBuf>,
    seen: &mut HashSet<PathBuf>,
    path: PathBuf,
) {
    if seen.insert(path.clone()) {
        candidates.push(path);
    }
}

pub(crate) fn collect_resource_candidates(
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
    for base in [resource_dir.clone()] {
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

pub(crate) fn resolve_resource_binary(
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

pub(crate) fn runtime_core_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    ensure_dir(app_core_root_path(&app_data_root(app)?))
}

pub(crate) fn runtime_core_binary_path(
    app: &tauri::AppHandle,
    file_name: &str,
) -> Result<PathBuf, String> {
    Ok(runtime_core_dir(app)?.join(file_name))
}

pub(crate) fn resolve_core_binary(app: &tauri::AppHandle, core: &str) -> Result<PathBuf, String> {
    let extension = if cfg!(target_os = "windows") {
        ".exe"
    } else {
        ""
    };
    let file_name = format!("{core}{extension}");
    if let Ok(path) = runtime_core_binary_path(app, &file_name) {
        if path.exists() {
            return Ok(path);
        }
    }

    if let Ok(path) = resolve_resource_binary(app, "core", &file_name) {
        return Ok(path);
    }

    Err(format!("Mihomo core not found: {file_name}"))
}

pub(crate) fn get_mihomo_asset_prefix_candidates() -> Result<Vec<&'static str>, String> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => Ok(vec![
            "mihomo-windows-amd64",
            "mihomo-windows-amd64-compatible",
            "mihomo-windows-amd64-v1",
            "mihomo-windows-amd64-v2",
            "mihomo-windows-amd64-v3",
        ]),
        ("windows", "x86") => Ok(vec!["mihomo-windows-386"]),
        ("windows", "aarch64") => Ok(vec!["mihomo-windows-arm64"]),
        ("macos", "x86_64") => Ok(vec![
            "mihomo-darwin-amd64",
            "mihomo-darwin-amd64-compatible",
            "mihomo-darwin-amd64-v1",
        ]),
        ("macos", "aarch64") => Ok(vec!["mihomo-darwin-arm64"]),
        ("linux", "x86_64") => Ok(vec![
            "mihomo-linux-amd64",
            "mihomo-linux-amd64-compatible",
            "mihomo-linux-amd64-v1",
            "mihomo-linux-amd64-v2",
            "mihomo-linux-amd64-v3",
        ]),
        ("linux", "aarch64") => Ok(vec!["mihomo-linux-arm64"]),
        ("linux", "loongarch64") => Ok(vec!["mihomo-linux-loong64", "mihomo-linux-loong64-abi2"]),
        (os, arch) => Err(format!("unsupported mihomo platform \"{os}-{arch}\"")),
    }
}

pub(crate) fn mihomo_asset_matches(
    asset_name: &str,
    version: &str,
    is_alpha: bool,
    ext: &str,
    prefixes: &[&str],
) -> bool {
    let suffix = format!("-{version}{ext}");
    if !asset_name.ends_with(&suffix) {
        return false;
    }

    prefixes.iter().any(|prefix| {
        if !asset_name.starts_with(prefix) {
            return false;
        }
        let middle = &asset_name[prefix.len()..asset_name.len() - suffix.len()];
        if is_alpha {
            middle.is_empty() || middle == "-alpha" || middle.starts_with("-alpha-")
        } else {
            middle.is_empty()
                || middle.strip_prefix("-go").is_some_and(|suffix| {
                    !suffix.is_empty() && suffix.chars().all(|ch| ch.is_ascii_digit())
                })
        }
    })
}

pub(crate) fn score_mihomo_asset_name(
    asset_name: &str,
    version: &str,
    is_alpha: bool,
    ext: &str,
) -> i32 {
    let suffix = format!("-{version}{ext}");
    let middle = asset_name.strip_suffix(&suffix).unwrap_or(asset_name);
    if is_alpha {
        if middle.ends_with("-alpha") {
            return 0;
        }
        if middle.contains("-alpha-go") {
            return 1;
        }
        2
    } else if middle.contains("-go") {
        1
    } else {
        0
    }
}

pub(crate) fn fetch_mihomo_release_assets(
    app: &tauri::AppHandle,
    tag: &str,
) -> Result<Vec<GitHubReleaseAsset>, String> {
    let release = fetch_mihomo_release(app, &format!("tags/{tag}"))?;
    Ok(release.assets.unwrap_or_default())
}

pub(crate) fn fetch_mihomo_release(
    app: &tauri::AppHandle,
    release_path: &str,
) -> Result<GitHubReleaseResponse, String> {
    let client = update_client(app, 30)?;
    let response = client
        .get(format!(
            "https://api.github.com/repos/MetaCubeX/mihomo/releases/{release_path}"
        ))
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
        .send()
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("请求 Mihomo release 失败: {}", response.status()));
    }

    response
        .json::<GitHubReleaseResponse>()
        .map_err(|e| e.to_string())
}

pub(crate) fn fallback_mihomo_asset(
    version: &str,
    tag: &str,
    prefixes: &[&str],
    ext: &str,
) -> GitHubReleaseAsset {
    let file_name = format!("{}-{version}{ext}", prefixes[0]);
    GitHubReleaseAsset {
        name: file_name.clone(),
        browser_download_url: format!(
            "https://github.com/MetaCubeX/mihomo/releases/download/{tag}/{file_name}"
        ),
    }
}

pub(crate) fn resolve_mihomo_asset(
    app: &tauri::AppHandle,
    version: &str,
    is_alpha: bool,
) -> Result<GitHubReleaseAsset, String> {
    let ext = if cfg!(target_os = "windows") {
        ".zip"
    } else {
        ".gz"
    };
    let prefixes = get_mihomo_asset_prefix_candidates()?;
    let tag = if is_alpha {
        "Prerelease-Alpha"
    } else {
        version
    };

    match fetch_mihomo_release_assets(app, tag) {
        Ok(assets) => assets
            .into_iter()
            .filter(|asset| mihomo_asset_matches(&asset.name, version, is_alpha, ext, &prefixes))
            .min_by_key(|asset| {
                let prefix_score = prefixes
                    .iter()
                    .position(|prefix| asset.name.starts_with(prefix))
                    .unwrap_or(prefixes.len());
                (
                    prefix_score,
                    score_mihomo_asset_name(&asset.name, version, is_alpha, ext),
                )
            })
            .ok_or_else(|| format!("未找到匹配的 Mihomo 资源: {version}")),
        Err(_) => Ok(fallback_mihomo_asset(version, tag, &prefixes, ext)),
    }
}

pub(crate) fn send_with_update_client<T>(
    app: &tauri::AppHandle,
    url: &str,
    timeout_secs: u64,
    action_label: &str,
    read_response: impl Fn(reqwest::blocking::Response) -> Result<T, String>,
) -> Result<T, String> {
    let send = |client: Client| -> Result<T, String> {
        let response = client
            .get(url)
            .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
            .send()
            .map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!("{action_label}失败: {}", response.status()));
        }
        read_response(response)
    };

    match update_client(app, timeout_secs).and_then(send) {
        Ok(value) => Ok(value),
        Err(proxy_error) => {
            let client = Client::builder()
                .timeout(Duration::from_secs(timeout_secs))
                .build()
                .map_err(|e| e.to_string())?;
            send(client).map_err(|direct_error| {
                format!(
                    "代理{action_label}失败: {proxy_error}; 直连{action_label}失败: {direct_error}"
                )
            })
        }
    }
}

pub(crate) fn download_with_update_client(
    app: &tauri::AppHandle,
    url: &str,
    timeout_secs: u64,
) -> Result<Vec<u8>, String> {
    send_with_update_client(app, url, timeout_secs, "下载", |response| {
        response
            .bytes()
            .map(|bytes| bytes.to_vec())
            .map_err(|e| e.to_string())
    })
}

pub(crate) fn fetch_text_with_update_client(
    app: &tauri::AppHandle,
    url: &str,
    timeout_secs: u64,
) -> Result<String, String> {
    send_with_update_client(app, url, timeout_secs, "请求", |response| {
        response.text().map_err(|e| e.to_string())
    })
}

pub(crate) fn find_mihomo_zip_entry(
    archive: &mut ZipArchive<Cursor<Vec<u8>>>,
) -> Result<usize, String> {
    for index in 0..archive.len() {
        let file = archive.by_index(index).map_err(|e| e.to_string())?;
        if file.is_dir() {
            continue;
        }
        let name = file.name().replace('\\', "/");
        let file_name = Path::new(&name)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        if file_name.ends_with(".exe") || file_name.contains("mihomo") {
            return Ok(index);
        }
    }
    Err("Mihomo 下载完成但压缩包内未找到可执行文件".to_string())
}

pub(crate) fn write_mihomo_zip_entry(bytes: Vec<u8>, target_path: &Path) -> Result<(), String> {
    let reader = Cursor::new(bytes);
    let mut archive = ZipArchive::new(reader).map_err(|e| e.to_string())?;
    let entry_index = find_mihomo_zip_entry(&mut archive)?;
    let mut file = archive.by_index(entry_index).map_err(|e| e.to_string())?;
    let temp_path = target_path.with_extension("download");
    ensure_parent(&temp_path)?;
    {
        let mut output = fs::File::create(&temp_path).map_err(|e| e.to_string())?;
        std::io::copy(&mut file, &mut output).map_err(|e| e.to_string())?;
    }
    if target_path.exists() {
        fs::remove_file(target_path).map_err(|e| e.to_string())?;
    }
    fs::rename(&temp_path, target_path).map_err(|e| e.to_string())
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn write_mihomo_gzip_bytes(bytes: Vec<u8>, target_path: &Path) -> Result<(), String> {
    let temp_path = target_path.with_extension("download");
    ensure_parent(&temp_path)?;

    let mut decoder = flate2::read::GzDecoder::new(std::io::Cursor::new(bytes));
    let mut output_file = fs::File::create(&temp_path).map_err(|e| e.to_string())?;
    std::io::copy(&mut decoder, &mut output_file)
        .map_err(|e| format!("解压 Mihomo Alpha 失败: {e}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temp_path, fs::Permissions::from_mode(0o755))
            .map_err(|e| e.to_string())?;
    }
    if target_path.exists() {
        fs::remove_file(target_path).map_err(|e| e.to_string())?;
    }
    fs::rename(&temp_path, target_path).map_err(|e| e.to_string())
}

pub(crate) fn fetch_mihomo_core_archive(
    app: &tauri::AppHandle,
    version: &str,
    is_alpha: bool,
) -> Result<(GitHubReleaseAsset, Vec<u8>), String> {
    let asset = resolve_mihomo_asset(app, version, is_alpha)?;
    let bytes = download_with_update_client(app, &asset.browser_download_url, 120)?;
    Ok((asset, bytes))
}

pub(crate) fn write_mihomo_core_archive(
    asset: &GitHubReleaseAsset,
    bytes: Vec<u8>,
    target_path: &Path,
) -> Result<(), String> {
    if asset.name.ends_with(".zip") {
        write_mihomo_zip_entry(bytes, target_path)?;
    } else if asset.name.ends_with(".gz") {
        #[cfg(target_os = "windows")]
        {
            return Err(format!("不支持的 Mihomo 压缩格式: {}", asset.name));
        }
        #[cfg(not(target_os = "windows"))]
        {
            write_mihomo_gzip_bytes(bytes, target_path)?;
        }
    } else {
        return Err(format!("不支持的 Mihomo 资源格式: {}", asset.name));
    }

    Ok(())
}

pub(crate) fn download_mihomo_alpha_core(
    app: &tauri::AppHandle,
    target_path: &Path,
) -> Result<(), String> {
    let version = latest_mihomo_version(app, true)?;
    let (asset, bytes) = fetch_mihomo_core_archive(app, &version, true)?;
    write_mihomo_core_archive(&asset, bytes, target_path)
}

pub(crate) fn latest_mihomo_version(
    app: &tauri::AppHandle,
    is_alpha: bool,
) -> Result<String, String> {
    let version = if is_alpha {
        fetch_text_with_update_client(
            app,
            "https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt",
            30,
        )
        .map(|text| text.trim().to_string())
    } else {
        fetch_mihomo_release(app, "latest")
            .and_then(|release| {
                release
                    .tag_name
                    .map(|tag| tag.trim().to_string())
                    .filter(|tag| !tag.is_empty())
                    .ok_or_else(|| "Mihomo latest release tag 为空".to_string())
            })
            .or_else(|_| {
                fetch_text_with_update_client(
                    app,
                    "https://github.com/MetaCubeX/mihomo/releases/latest/download/version.txt",
                    30,
                )
                .map(|text| text.trim().to_string())
            })
    }?;
    if version.is_empty() {
        let label = if is_alpha { "Mihomo Alpha" } else { "Mihomo" };
        return Err(format!("{label} version 为空"));
    }
    Ok(version)
}

pub(crate) fn mihomo_core_target_path(
    app: &tauri::AppHandle,
    is_alpha: bool,
) -> Result<PathBuf, String> {
    let extension = if cfg!(target_os = "windows") {
        ".exe"
    } else {
        ""
    };
    let name = if is_alpha { "mihomo-alpha" } else { "mihomo" };
    runtime_core_binary_path(app, &format!("{name}{extension}"))
}

pub(crate) fn ensure_mihomo_core_available(
    app: &tauri::AppHandle,
    core: &str,
) -> Result<PathBuf, String> {
    if let Ok(path) = resolve_core_binary(app, core) {
        return Ok(path);
    }

    if core != "mihomo-alpha" {
        let extension = if cfg!(target_os = "windows") {
            ".exe"
        } else {
            ""
        };
        return Err(format!("Mihomo core not found: {core}{extension}"));
    }

    let target_path = mihomo_core_target_path(app, true)?;
    download_mihomo_alpha_core(app, &target_path)?;
    resolve_core_binary(app, core)
}

pub(crate) fn resolve_service_binary(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let extension = if cfg!(target_os = "windows") {
        ".exe"
    } else {
        ""
    };
    let file_name = format!("routex-service{extension}");
    resolve_resource_binary(app, "tools", &file_name)
        .map_err(|_| format!("RouteX service not found: {file_name}"))
}
