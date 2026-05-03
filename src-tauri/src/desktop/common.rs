fn read_string_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn read_webdav_config(app: &tauri::AppHandle) -> Result<WebdavConfig, String> {
    let config = read_app_config_store(app)?;
    Ok(WebdavConfig {
        url: read_string_field(&config, "webdavUrl"),
        username: read_string_field(&config, "webdavUsername"),
        password: read_string_field(&config, "webdavPassword"),
        dir: {
            let dir = read_string_field(&config, "webdavDir");
            if dir.trim().is_empty() {
                "routex".to_string()
            } else {
                dir
            }
        },
    })
}

fn ensure_webdav_config(config: &WebdavConfig) -> Result<(), String> {
    if config.url.trim().is_empty() {
        return Err("WebDAV 地址未配置".to_string());
    }

    Ok(())
}

fn build_webdav_url(config: &WebdavConfig, child: Option<&str>) -> String {
    let mut base = config.url.trim_end_matches('/').to_string();
    let mut segments = Vec::new();

    if !config.dir.trim().is_empty() {
        segments.extend(
            config
                .dir
                .split('/')
                .filter(|segment| !segment.trim().is_empty())
                .map(|segment| urlencoding::encode(segment).into_owned()),
        );
    }

    if let Some(child) = child {
        segments.extend(
            child
                .split('/')
                .filter(|segment| !segment.trim().is_empty())
                .map(|segment| urlencoding::encode(segment).into_owned()),
        );
    }

    if !segments.is_empty() {
        base.push('/');
        base.push_str(&segments.join("/"));
    }

    base
}

fn get_app_name_value(app_path: &str) -> String {
    Path::new(app_path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(app_path)
        .to_string()
}

fn default_icon_data_url() -> &'static str {
    "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\"><rect width=\"64\" height=\"64\" rx=\"18\" fill=\"%231f6feb\"/><path d=\"M20 21h24a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3V24a3 3 0 0 1 3-3Z\" fill=\"%23fff\" fill-opacity=\".92\"/><path d=\"M24 28h16M24 34h10\" stroke=\"%231f6feb\" stroke-width=\"4\" stroke-linecap=\"round\"/></svg>"
}

fn emit_ipc_event(app: &tauri::AppHandle, channel: &str, payload: Value) {
    let _ = app.emit(channel, payload);
}

fn apply_background_command(command: &mut Command) -> &mut Command {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
}

#[cfg(target_os = "windows")]
fn powershell_command() -> Command {
    let mut command = Command::new("powershell");
    apply_background_command(&mut command);
    command
}

fn guess_mime_from_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    }
}

fn to_data_url(mime: &str, bytes: &[u8]) -> String {
    format!("data:{mime};base64,{}", BASE64_STANDARD.encode(bytes))
}
