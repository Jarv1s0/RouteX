use super::prelude::*;
use super::*;

const MAX_WEBDAV_BACKUP_BYTES: u64 = 512 * 1024 * 1024;

pub(crate) fn webdav_request(
    client: &Client,
    method: reqwest::Method,
    url: &str,
    config: &WebdavConfig,
) -> reqwest::blocking::RequestBuilder {
    let request = client.request(method, url);
    if config.username.trim().is_empty() {
        request
    } else {
        request.basic_auth(&config.username, Some(&config.password))
    }
}

pub(crate) fn sanitize_webdav_backup_entry(
    relative: &Path,
    bytes: Vec<u8>,
) -> Result<Vec<u8>, String> {
    if !relative
        .to_string_lossy()
        .eq_ignore_ascii_case(APP_CONFIG_FILE)
    {
        return Ok(bytes);
    }

    let mut value = serde_json::from_slice::<Value>(&bytes).map_err(|e| e.to_string())?;
    if let Some(object) = value.as_object_mut() {
        object.remove("webdavPassword");
        object.remove("githubToken");
        object.remove("serviceAuthKey");
        object.remove("corePermissionMode");
    }

    serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())
}

pub(crate) fn ensure_webdav_directory(config: &WebdavConfig) -> Result<(), String> {
    ensure_webdav_config(config)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let method = reqwest::Method::from_bytes(b"MKCOL").map_err(|e| e.to_string())?;
    let mut current = config.url.trim_end_matches('/').to_string();
    for segment in config
        .dir
        .split('/')
        .filter(|segment| !segment.trim().is_empty())
    {
        current.push('/');
        current.push_str(&urlencoding::encode(segment));

        let response = webdav_request(&client, method.clone(), &current, config)
            .send()
            .map_err(|e| e.to_string())?;
        let status = response.status();
        if !status.is_success()
            && status != reqwest::StatusCode::METHOD_NOT_ALLOWED
            && status != reqwest::StatusCode::CONFLICT
        {
            return Err(format!("创建 WebDAV 目录失败: {}", status));
        }
    }

    Ok(())
}

pub(crate) fn build_webdav_backup_archive(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    flush_traffic_stats(app)?;
    let root = app_storage_root(app)?;

    let temp_path = std::env::temp_dir().join(format!(
        "routex-webdav-backup-{}-{}.zip",
        current_timestamp_ms(),
        create_id()
    ));

    let build_result = (|| -> Result<(), String> {
        let file = fs::File::create(&temp_path).map_err(|e| e.to_string())?;
        let mut writer = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

        for entry in WalkDir::new(&root) {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let relative = path.strip_prefix(&root).map_err(|e| e.to_string())?;

            if relative.as_os_str().is_empty() {
                continue;
            }

            let name = relative.to_string_lossy().replace('\\', "/");
            if path.is_dir() {
                writer
                    .add_directory(format!("{name}/"), options)
                    .map_err(|e| e.to_string())?;
            } else {
                writer
                    .start_file(name, options)
                    .map_err(|e| e.to_string())?;
                let bytes = fs::read(path).map_err(|e| e.to_string())?;
                let bytes = sanitize_webdav_backup_entry(relative, bytes)?;
                writer.write_all(&bytes).map_err(|e| e.to_string())?;
            }
        }

        writer.finish().map_err(|e| e.to_string())?;
        Ok(())
    })();

    if let Err(error) = build_result {
        let _ = fs::remove_file(&temp_path);
        return Err(error);
    }

    Ok(temp_path)
}

pub(crate) fn restore_webdav_backup_archive(
    app: &tauri::AppHandle,
    bytes: &[u8],
) -> Result<(), String> {
    let root = app_storage_root(app)?;
    let state = app.state::<CoreState>();
    let mut traffic = state.traffic_stats.lock().map_err(|e| e.to_string())?;
    restore_webdav_backup_to_root(&root, bytes)?;
    *traffic = TrafficStatsBuffer::default();
    invalidate_profile_runtime_config_cache();
    Ok(())
}

pub(crate) fn restore_webdav_backup_to_root(root: &Path, bytes: &[u8]) -> Result<(), String> {
    if bytes.len() as u64 > MAX_WEBDAV_BACKUP_BYTES {
        return Err("备份压缩包大小超过 512 MiB".to_string());
    }
    let parent = root.parent().ok_or("配置目录缺少父目录")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let staging = tempfile::Builder::new()
        .prefix("routex-restore-")
        .tempdir_in(parent)
        .map_err(|e| e.to_string())?;
    let cursor = Cursor::new(bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|e| e.to_string())?;
    if archive.len() > 10_000 {
        return Err("备份文件数量超过上限".to_string());
    }
    let mut expanded_bytes = 0u64;
    let mut entries = HashSet::new();
    for index in 0..archive.len() {
        let file = archive.by_index(index).map_err(|e| e.to_string())?;
        let relative_path = file.enclosed_name().ok_or("备份包含无效路径")?;
        if file
            .name()
            .map_err(|e| e.to_string())?
            .contains([':', '\\'])
            || relative_path.as_os_str().is_empty()
        {
            return Err("备份包含无效路径".to_string());
        }
        for component in &relative_path {
            let component = component.to_string_lossy();
            let stem = component
                .split('.')
                .next()
                .unwrap_or_default()
                .to_ascii_uppercase();
            if component.ends_with([' ', '.'])
                || matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
                || (stem.len() == 4
                    && (stem.starts_with("COM") || stem.starts_with("LPT"))
                    && matches!(stem.as_bytes()[3], b'1'..=b'9'))
            {
                return Err("备份包含不兼容的文件名".to_string());
            }
        }
        let name = relative_path
            .to_string_lossy()
            .trim_end_matches('/')
            .to_lowercase();
        if !entries.insert(name) {
            return Err("备份包含重复路径".to_string());
        }
        if file
            .unix_mode()
            .is_some_and(|mode| mode & 0o170000 == 0o120000)
        {
            return Err("备份不能包含符号链接".to_string());
        }
        expanded_bytes = expanded_bytes.checked_add(file.size()).ok_or("备份过大")?;
        if expanded_bytes > MAX_WEBDAV_BACKUP_BYTES {
            return Err("备份解压大小超过 512 MiB".to_string());
        }
        let output_path = staging.path().join(&relative_path);
        if file.is_dir() {
            fs::create_dir_all(&output_path).map_err(|e| e.to_string())?;
            continue;
        }

        ensure_parent(&output_path)?;
        let mut bytes = Vec::new();
        let expected_size = file.size();
        file.take(expected_size + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        if bytes.len() as u64 != expected_size {
            return Err("备份文件大小不匹配".to_string());
        }
        let bytes = sanitize_webdav_backup_entry(relative_path.as_path(), bytes)?;
        if relative_path
            .extension()
            .is_some_and(|extension| extension == "json")
        {
            let value = serde_json::from_slice::<Value>(&bytes)
                .map_err(|e| format!("备份 JSON 无效: {e}"))?;
            if [
                APP_CONFIG_FILE,
                CONTROLLED_CONFIG_FILE,
                PROFILE_CONFIG_FILE,
                OVERRIDE_CONFIG_FILE,
            ]
            .iter()
            .any(|name| relative_path == Path::new(name))
                && !value.is_object()
            {
                return Err("备份配置必须是对象".to_string());
            }
        }
        if (relative_path.starts_with(PROFILE_DIR_NAME)
            || relative_path.starts_with(OVERRIDE_DIR_NAME))
            && relative_path
                .extension()
                .is_some_and(|ext| ext == "yaml" || ext == "yml")
        {
            let text = std::str::from_utf8(&bytes).map_err(|e| e.to_string())?;
            parse_profile_yaml_value(text)?;
        }
        atomic_write_file(&output_path, &bytes)?;
    }
    let app_config = read_json_file::<Value>(&staging.path().join(APP_CONFIG_FILE))?
        .ok_or("备份缺少应用配置")?;
    if !app_config.is_object() {
        return Err("备份应用配置必须是对象".to_string());
    }
    validate_restored_metadata(staging.path())?;
    let backup = parent.join(format!("routex-config-backup-{}", create_id()));
    let swap_guard = CONFIG_DIRECTORY_SWAP_LOCK
        .write()
        .map_err(|e| e.to_string())?;
    let had_original = root.exists();
    if had_original {
        fs::rename(root, &backup).map_err(|e| format!("无法保留原配置: {e}"))?;
    }
    if let Err(error) = fs::rename(staging.path(), root) {
        if had_original {
            fs::rename(&backup, root).map_err(|restore_error| {
                format!(
                    "恢复失败: {error}; 原配置保留在 {}，回滚失败: {restore_error}",
                    backup.display()
                )
            })?;
        }
        return Err(format!("替换配置失败: {error}"));
    }
    drop(swap_guard);
    if had_original {
        if let Err(error) = fs::remove_dir_all(&backup) {
            eprintln!(
                "[desktop.restore] 原配置备份保留在 {}: {error}",
                backup.display()
            );
        }
    }
    Ok(())
}

fn validate_restored_metadata(root: &Path) -> Result<(), String> {
    let profiles: ProfileConfigData =
        read_json_file(&root.join(PROFILE_CONFIG_FILE))?.unwrap_or_default();
    let overrides: OverrideConfigData =
        read_json_file(&root.join(OVERRIDE_CONFIG_FILE))?.unwrap_or_default();
    for (relative, label) in profiles
        .items
        .iter()
        .map(|item| {
            (
                PathBuf::from(PROFILE_DIR_NAME).join(format!("{}.yaml", item.id)),
                "订阅",
            )
        })
        .chain(overrides.items.iter().map(|item| {
            (
                PathBuf::from(OVERRIDE_DIR_NAME).join(format!("{}.{}", item.id, item.ext)),
                "覆写",
            )
        }))
    {
        // IDs and extensions must remain individual names within the staged tree.
        if relative.components().count() != 2
            || !relative
                .components()
                .all(|part| matches!(part, std::path::Component::Normal(_)))
            || !root.join(&relative).is_file()
        {
            return Err(format!(
                "备份{label}文件缺失或路径无效: {}",
                relative.display()
            ));
        }
    }
    Ok(())
}

pub(crate) fn list_webdav_backup_names(config: &WebdavConfig) -> Result<Vec<String>, String> {
    ensure_webdav_config(config)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let method = reqwest::Method::from_bytes(b"PROPFIND").map_err(|e| e.to_string())?;
    let response = webdav_request(&client, method, &build_webdav_url(config, None), config)
        .header("Depth", "1")
        .body(String::new())
        .send()
        .map_err(|e| e.to_string())?;
    let status = response.status();
    if !status.is_success() && status.as_u16() != 207 {
        return Err(format!("读取 WebDAV 目录失败: {}", status));
    }

    let body = response.text().map_err(|e| e.to_string())?;
    let mut reader = Reader::from_str(&body);
    reader.config_mut().trim_text(true);

    let mut names = Vec::new();
    loop {
        match reader.read_event() {
            Ok(Event::Start(event)) if event.local_name().as_ref() == "href" => {
                let text = reader.read_text(event.name()).map_err(|e| e.to_string())?;
                let basename = text
                    .split('/')
                    .rfind(|segment| !segment.is_empty())
                    .unwrap_or_default();
                let decoded = urlencoding::decode(basename)
                    .map(|value| value.into_owned())
                    .unwrap_or_else(|_| basename.to_string());
                if decoded.ends_with(".zip") && !names.contains(&decoded) {
                    names.push(decoded);
                }
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => return Err(error.to_string()),
        }
    }

    names.sort();
    names.reverse();
    Ok(names)
}

pub(crate) fn webdav_backup(app: &tauri::AppHandle) -> Result<bool, String> {
    let config = read_webdav_config(app)?;
    ensure_webdav_directory(&config)?;

    let archive_path = build_webdav_backup_archive(app)?;
    let archive = fs::File::open(&archive_path).map_err(|e| {
        let _ = fs::remove_file(&archive_path);
        e.to_string()
    })?;
    let file_name = format!("routex-{}.zip", current_local_timestamp_string());
    let client = Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let upload_result = webdav_request(
        &client,
        reqwest::Method::PUT,
        &build_webdav_url(&config, Some(&file_name)),
        &config,
    )
    .body(archive)
    .send()
    .map_err(|e| e.to_string());
    let _ = fs::remove_file(&archive_path);
    let response = upload_result?;

    if !response.status().is_success() {
        return Err(format!("上传 WebDAV 备份失败: {}", response.status()));
    }

    Ok(true)
}

pub(crate) fn webdav_restore(app: &tauri::AppHandle, filename: &str) -> Result<(), String> {
    let config = read_webdav_config(app)?;
    ensure_webdav_config(&config)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let response = webdav_request(
        &client,
        reqwest::Method::GET,
        &build_webdav_url(&config, Some(filename)),
        &config,
    )
    .send()
    .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("下载 WebDAV 备份失败: {}", response.status()));
    }

    let mut bytes = Vec::new();
    response
        .take(MAX_WEBDAV_BACKUP_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    restore_webdav_backup_archive(app, &bytes)
}

pub(crate) fn webdav_delete(app: &tauri::AppHandle, filename: &str) -> Result<(), String> {
    let config = read_webdav_config(app)?;
    ensure_webdav_config(&config)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = webdav_request(
        &client,
        reqwest::Method::DELETE,
        &build_webdav_url(&config, Some(filename)),
        &config,
    )
    .send()
    .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("删除 WebDAV 备份失败: {}", response.status()));
    }

    Ok(())
}
