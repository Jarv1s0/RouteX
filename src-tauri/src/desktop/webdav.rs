use super::prelude::*;
use super::*;

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
    if relative != Path::new(APP_CONFIG_FILE) {
        return Ok(bytes);
    }

    let mut value = serde_json::from_slice::<Value>(&bytes).map_err(|e| e.to_string())?;
    if let Some(object) = value.as_object_mut() {
        object.remove("webdavPassword");
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
    let root = app_storage_root(app)?;
    if !root.exists() {
        fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    }

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
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;

    let cursor = Cursor::new(bytes.to_vec());
    let mut archive = ZipArchive::new(cursor).map_err(|e| e.to_string())?;

    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|e| e.to_string())?;
        let Some(relative_path) = file.enclosed_name() else {
            continue;
        };

        let output_path = root.join(relative_path);
        if file.name().ends_with('/') {
            fs::create_dir_all(&output_path).map_err(|e| e.to_string())?;
            continue;
        }

        ensure_parent(&output_path)?;
        let mut output = fs::File::create(&output_path).map_err(|e| e.to_string())?;
        std::io::copy(&mut file, &mut output).map_err(|e| e.to_string())?;
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
            Ok(Event::Start(event)) if event.local_name().as_ref() == b"href" => {
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

    let mut response = webdav_request(
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
