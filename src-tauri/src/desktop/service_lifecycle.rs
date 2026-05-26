use super::prelude::*;
use super::*;

pub(crate) fn read_service_auth_key(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(read_app_config_store(app)?
        .get("serviceAuthKey")
        .and_then(Value::as_str)
        .map(str::to_string))
}

pub(crate) fn parse_service_auth_key(service_auth_key: &str) -> Result<(String, String), String> {
    let Some((public_key, private_key)) = service_auth_key.split_once(':') else {
        return Err("serviceAuthKey 格式无效，无法初始化服务".to_string());
    };
    if public_key.trim().is_empty() || private_key.trim().is_empty() {
        return Err("serviceAuthKey 格式无效，无法初始化服务".to_string());
    }
    Ok((public_key.to_string(), private_key.to_string()))
}

pub(crate) fn der_to_pem(label: &str, der: &[u8]) -> String {
    let encoded = BASE64_STANDARD.encode(der);
    let body = encoded
        .as_bytes()
        .chunks(64)
        .map(|chunk| std::str::from_utf8(chunk).unwrap_or_default())
        .collect::<Vec<_>>()
        .join("\n");
    format!("-----BEGIN {label}-----\n{body}\n-----END {label}-----\n")
}

pub(crate) fn generate_service_auth_key() -> Result<String, String> {
    pub(crate) const ED25519_SPKI_PREFIX: &[u8] = &[
        0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
    ];

    let rng = SystemRandom::new();
    let private_key =
        Ed25519KeyPair::generate_pkcs8(&rng).map_err(|_| "生成服务密钥失败".to_string())?;
    let key_pair = Ed25519KeyPair::from_pkcs8(private_key.as_ref())
        .map_err(|_| "生成的服务密钥无效".to_string())?;

    let mut public_key_der = ED25519_SPKI_PREFIX.to_vec();
    public_key_der.extend_from_slice(key_pair.public_key().as_ref());

    Ok(format!(
        "{}:{}",
        BASE64_STANDARD.encode(public_key_der),
        der_to_pem("PRIVATE KEY", private_key.as_ref())
    ))
}

#[cfg(target_os = "windows")]
pub(crate) fn current_service_authorized_principal_args() -> Result<Vec<String>, String> {
    let mut command = Command::new("whoami");
    apply_background_command(&mut command);
    let output = command
        .args(["/user", "/fo", "csv", "/nh"])
        .output()
        .map_err(|e| format!("读取当前用户 SID 失败: {e}"))?;
    if !output.status.success() {
        return Err("读取当前用户 SID 失败".to_string());
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let sid = text
        .trim()
        .rsplit_once(',')
        .map(|(_, value)| value.trim().trim_matches('"').to_string())
        .or_else(|| Some(text.trim().trim_matches('"').to_string()))
        .filter(|value| value.starts_with("S-"))
        .ok_or_else(|| "无法解析当前用户 SID".to_string())?;

    Ok(vec![String::from("--authorized-sid"), sid])
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn current_service_authorized_principal_args() -> Result<Vec<String>, String> {
    let output = Command::new("id")
        .arg("-u")
        .output()
        .map_err(|e| format!("读取当前用户 UID 失败: {e}"))?;
    if !output.status.success() {
        return Err("读取当前用户 UID 失败".to_string());
    }

    let uid = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if uid.parse::<u32>().is_err() {
        return Err("无法解析当前用户 UID".to_string());
    }

    Ok(vec![String::from("--authorized-uid"), uid])
}

pub(crate) fn classify_service_status_token(value: &str) -> Option<&'static str> {
    let normalized = value.to_ascii_lowercase();
    if normalized.contains("not-installed")
        || normalized.contains("not installed")
        || value.contains("未安装")
    {
        return Some("not-installed");
    }
    if normalized.contains("stopped")
        || normalized.contains("not-running")
        || normalized.contains("not running")
        || value.contains("已停止")
    {
        return Some("stopped");
    }
    if normalized.contains("running") || value.contains("运行中") {
        return Some("running");
    }
    None
}

pub(crate) fn classify_service_status_text(output: &str) -> Option<&'static str> {
    if let Ok(value) = serde_json::from_str::<Value>(output) {
        if let Some(status) = value
            .pointer("/status/state")
            .and_then(Value::as_str)
            .or_else(|| value.get("state").and_then(Value::as_str))
            .and_then(classify_service_status_token)
        {
            return Some(status);
        }
    }

    classify_service_status_token(output)
}

pub(crate) fn service_status_value(app: &tauri::AppHandle) -> Result<Value, String> {
    let has_auth_key = read_service_auth_key(app)?.is_some();
    let output = match run_service_command_capture(
        app,
        &[String::from("service"), String::from("status")],
    ) {
        Ok(output) => output,
        Err(error) => {
            if let Some(status) = classify_service_status_text(&error) {
                return Ok(json!(status));
            }
            return Ok(json!("unknown"));
        }
    };

    if let Some(status) = classify_service_status_text(&output) {
        if status == "running" && !has_auth_key {
            return Ok(json!("need-init"));
        }
        return Ok(json!(status));
    }
    Ok(json!("unknown"))
}

pub(crate) fn test_service_connection_value(app: &tauri::AppHandle) -> bool {
    if read_service_auth_key(app).ok().flatten().is_none() {
        return false;
    }
    service_http_request_json(app, "GET", "/test", None).is_ok()
}

pub(crate) fn init_service(app: &tauri::AppHandle, auth_key_input: Option<Value>) -> Result<(), String> {
    let service_auth_key = match auth_key_input {
        Some(Value::Object(payload)) => {
            let public_key = payload
                .get("publicKey")
                .and_then(Value::as_str)
                .ok_or_else(|| "initService requires publicKey".to_string())?;
            let private_key = payload
                .get("privateKey")
                .and_then(Value::as_str)
                .ok_or_else(|| "initService requires privateKey".to_string())?;
            format!("{public_key}:{private_key}")
        }
        Some(Value::Null) | None => match read_service_auth_key(app)? {
            Some(value) => value,
            None => generate_service_auth_key()?,
        },
        Some(_) => return Err("initService 参数格式无效".to_string()),
    };

    let (public_key, _) = parse_service_auth_key(&service_auth_key)?;
    let mut args = vec![
        String::from("service"),
        String::from("init"),
        String::from("--public-key"),
        public_key,
    ];
    args.extend(current_service_authorized_principal_args()?);
    run_service_command(app, &args)?;
    patch_app_config_store(app, &json!({ "serviceAuthKey": service_auth_key }))?;
    Ok(())
}

pub(crate) fn install_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("install")])
}

pub(crate) fn uninstall_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("uninstall")])
}

pub(crate) fn start_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("start")])
}

pub(crate) fn restart_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("restart")])
}

pub(crate) fn stop_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("stop")])
}
