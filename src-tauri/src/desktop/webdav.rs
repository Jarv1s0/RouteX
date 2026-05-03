fn webdav_request(
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

fn ensure_webdav_directory(config: &WebdavConfig) -> Result<(), String> {
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

fn build_webdav_backup_archive(app: &tauri::AppHandle) -> Result<Vec<u8>, String> {
    let root = app_storage_root(app)?;
    if !root.exists() {
        fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    }

    let cursor = Cursor::new(Vec::<u8>::new());
    let mut writer = ZipWriter::new(cursor);
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

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
            writer.write_all(&bytes).map_err(|e| e.to_string())?;
        }
    }

    writer
        .finish()
        .map(|cursor| cursor.into_inner())
        .map_err(|e| e.to_string())
}

fn restore_webdav_backup_archive(app: &tauri::AppHandle, bytes: &[u8]) -> Result<(), String> {
    let root = app_storage_root(app)?;
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;

    let cursor = Cursor::new(bytes.to_vec());
    let mut archive = ZipArchive::new(cursor).map_err(|e| e.to_string())?;

    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|e| e.to_string())?;
        let Some(relative_path) = file.enclosed_name().map(Path::to_path_buf) else {
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

fn list_webdav_backup_names(config: &WebdavConfig) -> Result<Vec<String>, String> {
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
                    .filter(|segment| !segment.is_empty())
                    .last()
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

fn webdav_backup(app: &tauri::AppHandle) -> Result<bool, String> {
    let config = read_webdav_config(app)?;
    ensure_webdav_directory(&config)?;

    let archive = build_webdav_backup_archive(app)?;
    let file_name = format!("routex-{}.zip", current_local_timestamp_string());
    let client = Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let response = webdav_request(
        &client,
        reqwest::Method::PUT,
        &build_webdav_url(&config, Some(&file_name)),
        &config,
    )
    .body(archive)
    .send()
    .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("上传 WebDAV 备份失败: {}", response.status()));
    }

    Ok(true)
}

fn webdav_restore(app: &tauri::AppHandle, filename: &str) -> Result<(), String> {
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

fn webdav_delete(app: &tauri::AppHandle, filename: &str) -> Result<(), String> {
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

