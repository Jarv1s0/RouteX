use super::*;

pub(super) fn fetch_text(url: &str, timeout_secs: u64) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client.get(url).send().map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("请求失败: {}", response.status()));
    }
    response.text().map_err(|e| e.to_string())
}

fn compare_versions(left: &str, right: &str) -> std::cmp::Ordering {
    let parse_parts = |version: &str| {
        version
            .split('.')
            .map(|part| {
                part.chars()
                    .take_while(|char| char.is_ascii_digit())
                    .collect::<String>()
                    .parse::<u64>()
                    .unwrap_or(0)
            })
            .collect::<Vec<_>>()
    };

    let left_parts = parse_parts(left);
    let right_parts = parse_parts(right);
    let max_len = left_parts.len().max(right_parts.len());

    for index in 0..max_len {
        let left_value = *left_parts.get(index).unwrap_or(&0);
        let right_value = *right_parts.get(index).unwrap_or(&0);
        match left_value.cmp(&right_value) {
            std::cmp::Ordering::Equal => continue,
            ordering => return ordering,
        }
    }

    std::cmp::Ordering::Equal
}

fn stringify_release_notes(value: Option<&serde_yaml::Value>) -> String {
    match value {
        Some(serde_yaml::Value::String(text)) => text.trim().to_string(),
        Some(serde_yaml::Value::Sequence(items)) => items
            .iter()
            .filter_map(|item| match item {
                serde_yaml::Value::String(text) => Some(text.trim().to_string()),
                other => serde_yaml::to_string(other)
                    .ok()
                    .map(|text| text.trim().to_string()),
            })
            .filter(|text| !text.is_empty())
            .collect::<Vec<_>>()
            .join("\n"),
        Some(other) => serde_yaml::to_string(other)
            .map(|text| text.trim().to_string())
            .unwrap_or_default(),
        None => String::new(),
    }
}

fn update_channel(app: &tauri::AppHandle) -> Result<String, String> {
    Ok(read_app_config_store(app)?
        .get("updateChannel")
        .and_then(Value::as_str)
        .unwrap_or("stable")
        .to_string())
}

fn release_tag_for_version(version: &str) -> String {
    if version.contains("beta") {
        String::from("pre-release")
    } else {
        format!("v{version}")
    }
}

fn update_manifest_url(app: &tauri::AppHandle) -> Result<String, String> {
    let update_channel = update_channel(app)?;
    Ok(if update_channel == "beta" {
        String::from("https://github.com/Jarv1s0/RouteX/releases/download/pre-release/latest.yml")
    } else {
        String::from("https://github.com/Jarv1s0/RouteX/releases/latest/download/latest.yml")
    })
}

pub(super) fn update_client(app: &tauri::AppHandle, timeout_secs: u64) -> Result<Client, String> {
    let controlled_config = read_controlled_config_store(app)?;
    let mixed_port = controlled_config
        .get("mixed-port")
        .and_then(Value::as_u64)
        .unwrap_or(7890);

    let mut client_builder = Client::builder().timeout(Duration::from_secs(timeout_secs));
    if mixed_port != 0 {
        let proxy = reqwest::Proxy::http(format!("http://127.0.0.1:{mixed_port}"))
            .map_err(|e| e.to_string())?;
        client_builder = client_builder.proxy(proxy);
    }

    client_builder.build().map_err(|e| e.to_string())
}

fn fetch_update_manifest(app: &tauri::AppHandle) -> Result<ReleaseManifest, String> {
    let client = update_client(app, 20)?;
    let manifest_url = update_manifest_url(app)?;
    let response = client
        .get(&manifest_url)
        .header(reqwest::header::CONTENT_TYPE, "application/octet-stream")
        .send()
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("请求失败: {}", response.status()));
    }

    let manifest_text = response.text().map_err(|e| e.to_string())?;
    serde_yaml::from_str::<ReleaseManifest>(&manifest_text).map_err(|e| e.to_string())
}

fn emit_update_status(
    app: &tauri::AppHandle,
    downloading: bool,
    progress: u64,
    error: Option<&str>,
) {
    let payload = match error {
        Some(message) => json!({
            "downloading": downloading,
            "progress": progress,
            "error": message,
        }),
        None => json!({
            "downloading": downloading,
            "progress": progress,
        }),
    };
    emit_ipc_event(app, "update-status", payload);
}

fn supported_update_asset(path: &str) -> bool {
    let path = path.to_ascii_lowercase();

    #[cfg(target_os = "windows")]
    {
        return path.ends_with(".exe") || path.ends_with(".msi");
    }

    #[cfg(target_os = "macos")]
    {
        return path.ends_with(".pkg") || path.ends_with(".dmg");
    }

    #[cfg(target_os = "linux")]
    {
        return path.ends_with(".appimage") || path.ends_with(".deb") || path.ends_with(".rpm");
    }

    #[allow(unreachable_code)]
    false
}

fn resolve_update_asset(manifest: &ReleaseManifest) -> Result<(String, Option<String>), String> {
    if let Some(files) = manifest.files.as_ref() {
        if let Some(file) = files.iter().find(|file| {
            file.url
                .as_deref()
                .map(supported_update_asset)
                .unwrap_or(false)
        }) {
            return Ok((file.url.clone().unwrap_or_default(), file.sha512.clone()));
        }
    }

    if let Some(path) = manifest.path.as_ref() {
        if supported_update_asset(path) {
            return Ok((path.clone(), manifest.sha512.clone()));
        }
    }

    Err(String::from("更新清单里没有当前平台可用的安装包"))
}

fn resolve_update_asset_url(version: &str, asset_path: &str) -> String {
    if asset_path.starts_with("http://") || asset_path.starts_with("https://") {
        return asset_path.to_string();
    }

    format!(
        "https://github.com/Jarv1s0/RouteX/releases/download/{}/{}",
        release_tag_for_version(version),
        asset_path.trim_start_matches('/')
    )
}

fn update_download_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    ensure_dir(app_data_root(app)?.join(UPDATES_DIR_NAME))
}

fn expected_sha512_bytes(sha512: &Option<String>) -> Result<Option<Vec<u8>>, String> {
    match sha512
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        Some(value) => BASE64_STANDARD
            .decode(value)
            .map(Some)
            .map_err(|e| format!("无法解析更新清单里的 SHA-512: {e}")),
        None => Ok(None),
    }
}

fn verify_file_sha512(path: &Path, expected: &Option<Vec<u8>>) -> Result<(), String> {
    let Some(expected) = expected.as_ref() else {
        return Ok(());
    };

    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha512::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    let actual = hasher.finalize().to_vec();
    if actual == *expected {
        return Ok(());
    }

    Err(String::from("更新包 SHA-512 校验失败"))
}

fn start_update_download(state: &State<'_, CoreState>) -> Result<Arc<AtomicBool>, String> {
    let mut guard = state
        .update_download_cancel
        .lock()
        .map_err(|_| String::from("更新状态锁已损坏"))?;
    if guard.is_some() {
        return Err(String::from("已有更新下载任务正在进行"));
    }

    let cancel_flag = Arc::new(AtomicBool::new(false));
    *guard = Some(cancel_flag.clone());
    Ok(cancel_flag)
}

fn finish_update_download(state: &State<'_, CoreState>) {
    if let Ok(mut guard) = state.update_download_cancel.lock() {
        *guard = None;
    }
}

fn launch_downloaded_update(app: &tauri::AppHandle, installer_path: &Path) -> Result<(), String> {
    let _ = app;
    #[cfg(target_os = "windows")]
    {
        let is_msi = installer_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("msi"))
            .unwrap_or(false);

        if is_msi {
            Command::new("msiexec")
                .arg("/i")
                .arg(installer_path)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            Command::new(installer_path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }

        app.exit(0);
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(installer_path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        if installer_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("AppImage"))
            .unwrap_or(false)
        {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;

                let mut permissions = fs::metadata(installer_path)
                    .map_err(|e| e.to_string())?
                    .permissions();
                permissions.set_mode(0o755);
                fs::set_permissions(installer_path, permissions).map_err(|e| e.to_string())?;
            }
        }

        open_path_in_shell(installer_path)?;
        Ok(())
    }
}

pub(super) fn download_and_install_update(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    version: &str,
) -> Result<(), String> {
    let cancel_flag = start_update_download(state)?;
    let result = (|| -> Result<(), String> {
        let manifest = fetch_update_manifest(app)?;
        if manifest.version != version {
            return Err(String::from("更新信息已变化，请重新检查更新"));
        }

        let (asset_path, sha512) = resolve_update_asset(&manifest)?;
        let download_url = resolve_update_asset_url(&manifest.version, &asset_path);
        let file_name = Path::new(&asset_path)
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| String::from("无法解析更新包文件名"))?;
        let download_path = update_download_dir(app)?.join(file_name);
        let expected_hash = expected_sha512_bytes(&sha512)?;

        emit_update_status(app, true, 0, None);

        let client = update_client(app, 600)?;
        let mut response = client
            .get(&download_url)
            .send()
            .map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!("下载更新失败: {}", response.status()));
        }

        let total_size = response.content_length();
        let mut file = fs::File::create(&download_path).map_err(|e| e.to_string())?;
        let mut downloaded_bytes = 0_u64;
        let mut buffer = [0_u8; 64 * 1024];

        loop {
            if cancel_flag.load(AtomicOrdering::SeqCst) {
                let _ = fs::remove_file(&download_path);
                emit_update_status(app, false, 0, Some("下载已取消"));
                return Ok(());
            }

            let read = response.read(&mut buffer).map_err(|e| e.to_string())?;
            if read == 0 {
                break;
            }

            file.write_all(&buffer[..read]).map_err(|e| e.to_string())?;
            downloaded_bytes += read as u64;

            let progress = total_size
                .map(|size| ((downloaded_bytes * 100) / size.max(1)).min(100))
                .unwrap_or(0);
            emit_update_status(app, true, progress, None);
        }

        file.flush().map_err(|e| e.to_string())?;
        verify_file_sha512(&download_path, &expected_hash)?;
        emit_update_status(app, false, 100, None);
        launch_downloaded_update(app, &download_path)
    })();

    if let Err(error) = &result {
        emit_update_status(app, false, 0, Some(error));
    }
    finish_update_download(state);
    result
}

pub(super) fn cancel_update_download(state: &State<'_, CoreState>) -> Result<(), String> {
    let guard = state
        .update_download_cancel
        .lock()
        .map_err(|_| String::from("更新状态锁已损坏"))?;
    if let Some(cancel_flag) = guard.as_ref() {
        cancel_flag.store(true, AtomicOrdering::SeqCst);
    }
    Ok(())
}

pub(super) fn check_update_manifest(app: &tauri::AppHandle) -> Result<Option<Value>, String> {
    let manifest = fetch_update_manifest(app)?;
    let current_version = app.package_info().version.to_string();

    if compare_versions(&manifest.version, &current_version).is_gt() {
        return Ok(Some(json!({
            "version": manifest.version,
            "releaseNotes": stringify_release_notes(manifest.release_notes.as_ref()),
        })));
    }

    Ok(None)
}
