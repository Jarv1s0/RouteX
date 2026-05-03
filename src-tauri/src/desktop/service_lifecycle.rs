fn read_service_auth_key(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(read_app_config_store(app)?
        .get("serviceAuthKey")
        .and_then(Value::as_str)
        .map(str::to_string))
}

fn parse_service_auth_key(service_auth_key: &str) -> Result<(String, String), String> {
    let Some((public_key, private_key)) = service_auth_key.split_once(':') else {
        return Err("serviceAuthKey 格式无效，无法初始化服务".to_string());
    };
    if public_key.trim().is_empty() || private_key.trim().is_empty() {
        return Err("serviceAuthKey 格式无效，无法初始化服务".to_string());
    }
    Ok((public_key.to_string(), private_key.to_string()))
}

#[cfg(target_os = "windows")]
fn current_service_authorized_principal_args() -> Result<Vec<String>, String> {
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
fn current_service_authorized_principal_args() -> Result<Vec<String>, String> {
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

fn service_status_value(app: &tauri::AppHandle) -> Result<Value, String> {
    let output = match run_service_command_capture(
        app,
        &[String::from("service"), String::from("status")],
    ) {
        Ok(output) => output,
        Err(error) => {
            let normalized = error.to_ascii_lowercase();
            if normalized.contains("not installed") || error.contains("未安装") {
                return Ok(json!("not-installed"));
            }
            if normalized.contains("stopped") || normalized.contains("not running") {
                return Ok(json!("stopped"));
            }
            return Ok(json!("unknown"));
        }
    };

    let normalized = output.to_ascii_lowercase();
    if normalized.contains("running") || output.contains("运行中") {
        return Ok(json!("running"));
    }
    if normalized.contains("stopped")
        || normalized.contains("not running")
        || output.contains("已停止")
    {
        return Ok(json!("stopped"));
    }
    if normalized.contains("not installed") {
        return Ok(json!("not-installed"));
    }
    if read_service_auth_key(app)?.is_none() {
        return Ok(json!("need-init"));
    }
    Ok(json!("unknown"))
}

fn test_service_connection_value(app: &tauri::AppHandle) -> bool {
    if read_service_auth_key(app).ok().flatten().is_none() {
        return false;
    }
    service_http_request_json(app, "GET", "/test", None).is_ok()
}

fn init_service(app: &tauri::AppHandle, auth_key_input: Option<Value>) -> Result<(), String> {
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
        Some(Value::Null) | None => read_service_auth_key(app)?.ok_or_else(|| {
            "当前未提供服务密钥，无法初始化服务；请先生成并传入 serviceAuthKey".to_string()
        })?,
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

fn install_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("install")])
}

fn uninstall_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("uninstall")])
}

fn start_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("start")])
}

fn restart_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("restart")])
}

fn stop_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("stop")])
}

