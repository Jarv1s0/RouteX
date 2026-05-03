fn run_service_command(app: &tauri::AppHandle, args: &[String]) -> Result<(), String> {
    let binary = resolve_service_binary(app)?;
    let mut command = Command::new(binary);
    apply_background_command(&mut command);
    let output = command.args(args).output().map_err(|e| e.to_string())?;
    let combined = command_output_text(&output);

    if output.status.success() && !command_output_contains_error(&combined) {
        return Ok(());
    }

    if combined.is_empty() {
        Err(format!("RouteX service command failed: {}", output.status))
    } else {
        Err(combined)
    }
}

fn run_service_command_capture(app: &tauri::AppHandle, args: &[String]) -> Result<String, String> {
    let binary = resolve_service_binary(app)?;
    let mut command = Command::new(binary);
    apply_background_command(&mut command);
    let output = command.args(args).output().map_err(|e| e.to_string())?;
    let combined = command_output_text(&output);

    if output.status.success() {
        Ok(combined)
    } else if combined.is_empty() {
        Err(format!("RouteX service command failed: {}", output.status))
    } else {
        Err(combined)
    }
}

fn command_output_text(output: &Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    match (stdout.is_empty(), stderr.is_empty()) {
        (true, true) => String::new(),
        (false, true) => stdout,
        (true, false) => stderr,
        (false, false) => format!("{stdout}\n{stderr}"),
    }
}

fn command_output_contains_error(text: &str) -> bool {
    let normalized = text.to_ascii_lowercase();
    text.contains("失败")
        || text.contains("错误")
        || normalized.contains("failed")
        || normalized.contains("error")
}

fn service_command_args(
    only_active_device: bool,
    command: &str,
    extra_args: Vec<String>,
) -> Vec<String> {
    let mut args = Vec::new();
    #[cfg(target_os = "windows")]
    {
        args.push(String::from("--use-registry"));
    }
    if only_active_device {
        args.push(String::from("--only-active-device"));
    }
    args.push(command.to_string());
    args.extend(extra_args);
    args
}

fn read_core_permission_mode(app: &tauri::AppHandle) -> Result<String, String> {
    Ok(read_app_config_store(app)?
        .get("corePermissionMode")
        .and_then(Value::as_str)
        .unwrap_or("elevated")
        .to_string())
}

struct ServiceAuthHeaders {
    timestamp: String,
    key_id: String,
    nonce: String,
    content_sha256: String,
    signature: String,
}

fn service_key_id(public_key_base64: &str) -> Result<String, String> {
    let public_key_der = BASE64_STANDARD
        .decode(public_key_base64.trim().as_bytes())
        .map_err(|e| format!("解析服务公钥失败: {e}"))?;
    Ok(format!("{:x}", Sha256::digest(&public_key_der)))
}

fn service_auth_nonce() -> Result<String, String> {
    let rng = SystemRandom::new();
    let mut bytes = [0u8; 16];
    rng.fill(&mut bytes)
        .map_err(|_| "生成服务请求 nonce 失败".to_string())?;
    Ok(bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<Vec<_>>()
        .join(""))
}

fn canonicalize_service_query(raw_query: &str) -> Result<String, String> {
    if raw_query.is_empty() {
        return Ok(String::new());
    }

    let mut pairs = Vec::new();
    for part in raw_query.split('&') {
        let (key, value) = part.split_once('=').unwrap_or((part, ""));
        let decoded_key = urlencoding::decode(key)
            .map_err(|e| format!("解析服务请求 query 失败: {e}"))?
            .into_owned();
        let decoded_value = urlencoding::decode(value)
            .map_err(|e| format!("解析服务请求 query 失败: {e}"))?
            .into_owned();
        pairs.push((decoded_key, decoded_value));
    }
    pairs.sort();

    Ok(pairs
        .into_iter()
        .map(|(key, value)| {
            format!(
                "{}={}",
                urlencoding::encode(&key),
                urlencoding::encode(&value)
            )
        })
        .collect::<Vec<_>>()
        .join("&"))
}

fn build_service_auth_headers(
    app: &tauri::AppHandle,
    method: &str,
    path: &str,
    body_text: &str,
) -> Result<ServiceAuthHeaders, String> {
    let service_auth_key = read_service_auth_key(app)?.ok_or_else(|| {
        "当前未提供服务密钥，无法通过 RouteX 服务管理内核；请先初始化服务".to_string()
    })?;
    let (public_key, private_key_pem) = parse_service_auth_key(&service_auth_key)?;
    let key_id = service_key_id(&public_key)?;
    let private_key_der = BASE64_STANDARD
        .decode(
            private_key_pem
                .lines()
                .filter(|line| !line.trim_start().starts_with("-----"))
                .collect::<String>()
                .as_bytes(),
        )
        .map_err(|e| format!("解析服务私钥失败: {e}"))?;
    let key_pair = Ed25519KeyPair::from_pkcs8(&private_key_der)
        .map_err(|_| "serviceAuthKey 中的私钥无效，无法生成服务签名".to_string())?;
    let timestamp = current_timestamp_ms().to_string();
    let nonce = service_auth_nonce()?;
    let content_sha256 = format!("{:x}", Sha256::digest(body_text.as_bytes()));
    let (path_part, query_part) = path.split_once('?').unwrap_or((path, ""));
    let canonical_query = canonicalize_service_query(query_part)?;
    let method_upper = method.to_ascii_uppercase();
    let canonical = [
        "ROUTEX-AUTH-V2",
        timestamp.as_str(),
        nonce.as_str(),
        key_id.as_str(),
        method_upper.as_str(),
        if path_part.is_empty() { "/" } else { path_part },
        canonical_query.as_str(),
        content_sha256.as_str(),
    ]
    .join("\n");
    let signature = BASE64_STANDARD.encode(key_pair.sign(canonical.as_bytes()).as_ref());
    Ok(ServiceAuthHeaders {
        timestamp,
        key_id,
        nonce,
        content_sha256,
        signature,
    })
}

fn build_service_http_request(
    app: &tauri::AppHandle,
    method: &str,
    path: &str,
    body: Option<&Value>,
) -> Result<Vec<u8>, String> {
    let body_text = body
        .map(|value| serde_json::to_string(value).map_err(|e| e.to_string()))
        .transpose()?
        .unwrap_or_default();
    let auth = build_service_auth_headers(app, method, path, &body_text)?;
    let mut request = format!(
        "{method} {path} HTTP/1.1\r\nHost: localhost\r\nAccept: application/json\r\nX-Auth-Version: 2\r\nX-Timestamp: {}\r\nX-Key-Id: {}\r\nX-Nonce: {}\r\nX-Content-SHA256: {}\r\nX-Signature: {}\r\nConnection: close\r\n",
        auth.timestamp,
        auth.key_id,
        auth.nonce,
        auth.content_sha256,
        auth.signature
    );
    if method != "GET" || !body_text.is_empty() {
        request.push_str("Content-Type: application/json\r\n");
        request.push_str(&format!(
            "Content-Length: {}\r\n",
            body_text.as_bytes().len()
        ));
    }
    request.push_str("\r\n");
    request.push_str(&body_text);
    Ok(request.into_bytes())
}

fn find_http_header_end(bytes: &[u8]) -> Option<usize> {
    bytes.windows(4).position(|window| window == b"\r\n\r\n")
}

fn find_crlf(bytes: &[u8], offset: usize) -> Option<usize> {
    bytes[offset..]
        .windows(2)
        .position(|window| window == b"\r\n")
        .map(|index| offset + index)
}

fn decode_chunked_http_body(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let mut decoded = Vec::new();
    let mut offset = 0usize;

    loop {
        let line_end = find_crlf(bytes, offset)
            .ok_or_else(|| "RouteX 服务返回了不完整的 chunked 响应".to_string())?;
        let chunk_len_text = String::from_utf8_lossy(&bytes[offset..line_end]);
        let chunk_len = usize::from_str_radix(
            chunk_len_text.split(';').next().unwrap_or_default().trim(),
            16,
        )
        .map_err(|e| format!("解析 RouteX 服务 chunk 长度失败: {e}"))?;
        offset = line_end + 2;

        if chunk_len == 0 {
            return Ok(decoded);
        }

        let chunk_end = offset + chunk_len;
        if chunk_end > bytes.len() {
            return Err("RouteX 服务返回的 chunk 数据不完整".to_string());
        }

        decoded.extend_from_slice(&bytes[offset..chunk_end]);
        offset = chunk_end;

        if bytes.get(offset..offset + 2) != Some(b"\r\n" as &[u8]) {
            return Err("RouteX 服务 chunk 响应格式无效".to_string());
        }
        offset += 2;
    }
}

fn parse_service_http_response(bytes: &[u8]) -> Result<(u16, Vec<u8>), String> {
    let header_end = find_http_header_end(bytes)
        .ok_or_else(|| "RouteX 服务响应不是合法的 HTTP 报文".to_string())?;
    let header_text = String::from_utf8_lossy(&bytes[..header_end]);
    let mut lines = header_text.split("\r\n");
    let status_line = lines
        .next()
        .ok_or_else(|| "RouteX 服务响应缺少状态行".to_string())?;
    let status = status_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| "RouteX 服务响应状态行无效".to_string())?
        .parse::<u16>()
        .map_err(|e| format!("解析 RouteX 服务状态码失败: {e}"))?;

    let mut chunked = false;
    for line in lines {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        if name.trim().eq_ignore_ascii_case("Transfer-Encoding")
            && value.to_ascii_lowercase().contains("chunked")
        {
            chunked = true;
        }
    }

    let body = if chunked {
        decode_chunked_http_body(&bytes[header_end + 4..])?
    } else {
        bytes[header_end + 4..].to_vec()
    };

    Ok((status, body))
}

fn send_service_http_over_stream<T: Read + Write>(
    mut stream: T,
    request: &[u8],
) -> Result<Vec<u8>, String> {
    stream.write_all(request).map_err(|e| e.to_string())?;
    stream.flush().map_err(|e| e.to_string())?;
    let mut response = Vec::new();
    stream
        .read_to_end(&mut response)
        .map_err(|e| e.to_string())?;
    if response.is_empty() {
        return Err("RouteX 服务没有返回任何数据".to_string());
    }
    Ok(response)
}

#[cfg(target_os = "windows")]
fn send_service_http_request(request: &[u8]) -> Result<Vec<u8>, String> {
    let pipe_path = r"\\.\pipe\routex\service";
    let mut last_error = None;

    for _ in 0..10 {
        match OpenOptions::new().read(true).write(true).open(pipe_path) {
            Ok(pipe) => return send_service_http_over_stream(pipe, request),
            Err(error) => {
                last_error = Some(error.to_string());
                thread::sleep(Duration::from_millis(300));
            }
        }
    }

    Err(last_error.unwrap_or_else(|| "连接 RouteX 服务命名管道失败".to_string()))
}

#[cfg(not(target_os = "windows"))]
fn send_service_http_request(request: &[u8]) -> Result<Vec<u8>, String> {
    let socket = UnixStream::connect("/tmp/routex-service.sock").map_err(|e| e.to_string())?;
    send_service_http_over_stream(socket, request)
}

fn service_http_request_json(
    app: &tauri::AppHandle,
    method: &str,
    path: &str,
    body: Option<&Value>,
) -> Result<Value, String> {
    let request = build_service_http_request(app, method, path, body)?;
    let response = send_service_http_request(&request)?;
    let (status, body_bytes) = parse_service_http_response(&response)?;
    let body_text = String::from_utf8(body_bytes).map_err(|e| e.to_string())?;

    if body_text.trim().is_empty() {
        if status >= 400 {
            return Err(format!("RouteX 服务请求失败: HTTP {}", status));
        }
        return Ok(Value::Null);
    }

    let value = serde_json::from_str::<Value>(&body_text)
        .map_err(|e| format!("解析 RouteX 服务响应失败: {e}; body={body_text}"))?;
    if let Some("error") = value.get("status").and_then(Value::as_str) {
        return Err(value
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("RouteX 服务请求失败")
            .to_string());
    }
    if status >= 400 {
        return Err(format!("RouteX 服务请求失败: HTTP {}", status));
    }
    Ok(value)
}

fn service_core_control(app: &tauri::AppHandle, path: &str) -> Result<(), String> {
    service_http_request_json(app, "POST", path, None).map(|_| ())
}

fn service_core_status_info(app: &tauri::AppHandle) -> Result<Option<Value>, String> {
    match service_http_request_json(app, "GET", "/core", None) {
        Ok(value) => Ok(Some(value)),
        Err(error)
            if error.contains("进程未运行")
                || error.to_ascii_lowercase().contains("not running") =>
        {
            Ok(None)
        }
        Err(error) => Err(error),
    }
}

fn build_service_core_restart_payload(
    binary_path: &Path,
    work_dir: &Path,
    log_path: &Path,
    safe_paths: &[String],
    app_config: &Value,
) -> Value {
    let mut env = serde_json::Map::new();
    for (env_key, config_key) in [
        ("DISABLE_LOOPBACK_DETECTOR", "disableLoopbackDetector"),
        ("DISABLE_EMBED_CA", "disableEmbedCA"),
        ("DISABLE_SYSTEM_CA", "disableSystemCA"),
        ("DISABLE_NFTABLES", "disableNftables"),
    ] {
        env.insert(
            env_key.to_string(),
            Value::String(config_bool_string(app_config, config_key)),
        );
    }

    if !safe_paths.is_empty() {
        env.insert(
            "SAFE_PATHS".to_string(),
            Value::String(safe_paths.join(path_delimiter())),
        );
    }

    if let Some(path) = std::env::var_os("PATH") {
        env.insert(
            "PATH".to_string(),
            Value::String(path.to_string_lossy().to_string()),
        );
    }

    json!({
        "core_path": binary_path.to_string_lossy(),
        "log_path": log_path.to_string_lossy(),
        "args": ["-d", work_dir.to_string_lossy().to_string()],
        "safe_paths": safe_paths,
        "env": env,
    })
}

