#[cfg(target_os = "macos")]
fn get_default_device_macos() -> Result<String, String> {
    let output = Command::new("route")
        .args(["-n", "get", "default"])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("Get device failed".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let device = stdout
        .lines()
        .find_map(|line| {
            let trimmed = line.trim();
            trimmed
                .strip_prefix("interface:")
                .map(|value| value.trim().to_string())
        })
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Get device failed".to_string())?;

    Ok(device)
}

#[cfg(target_os = "macos")]
fn get_default_service_macos() -> Result<String, String> {
    let device = get_default_device_macos()?;
    let output = Command::new("networksetup")
        .args(["-listnetworkserviceorder"])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("Get networkservice failed".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let block = stdout
        .split("\n\n")
        .find(|section| section.contains(&format!("Device: {device}")))
        .ok_or_else(|| "Get networkservice failed".to_string())?;

    let service = block
        .lines()
        .find_map(|line| {
            let trimmed = line.trim();
            if !trimmed.starts_with('(') {
                return None;
            }

            trimmed
                .find(')')
                .map(|index| trimmed[index + 1..].trim().to_string())
        })
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Get service failed".to_string())?;

    Ok(service)
}

#[cfg(target_os = "macos")]
fn set_app_config_partial(app: &tauri::AppHandle, patch: &Value) -> Result<(), String> {
    patch_app_config_store(app, patch)?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn get_origin_dns_macos(app: &tauri::AppHandle) -> Result<(), String> {
    let service = get_default_service_macos()?;
    let output = Command::new("networksetup")
        .args(["-getdnsservers", &service])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("Get DNS failed".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.starts_with("There aren't any DNS Servers set on") {
        set_app_config_partial(app, &json!({ "originDNS": "Empty" }))?;
    } else {
        set_app_config_partial(app, &json!({ "originDNS": stdout.replace('\n', " ") }))?;
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn set_dns_macos(_app: &tauri::AppHandle, dns: &str, _mode: &str) -> Result<(), String> {
    let service = get_default_service_macos()?;
    let dns_servers = if dns == "Empty" {
        vec!["Empty".to_string()]
    } else {
        dns.split_whitespace()
            .map(str::to_string)
            .collect::<Vec<_>>()
    };

    let mut command = Command::new("networksetup");
    command.arg("-setdnsservers").arg(&service);
    for dns_server in dns_servers {
        command.arg(dns_server);
    }

    let status = command.status().map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("networksetup 执行失败: {status}"))
    }
}

#[cfg(target_os = "macos")]
fn set_public_dns_macos(app: &tauri::AppHandle) -> Result<(), String> {
    let app_config = read_app_config_store(app)?;
    let auto_set_dns_mode = app_config
        .get("autoSetDNSMode")
        .and_then(Value::as_str)
        .unwrap_or("none");
    if auto_set_dns_mode == "none" {
        return Ok(());
    }

    let origin_dns = app_config.get("originDNS").and_then(Value::as_str);
    if origin_dns.is_none() || origin_dns == Some("") {
        get_origin_dns_macos(app)?;
        set_dns_macos(app, "223.5.5.5", auto_set_dns_mode)?;
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn recover_dns_macos(app: &tauri::AppHandle) -> Result<(), String> {
    let app_config = read_app_config_store(app)?;
    let auto_set_dns_mode = app_config
        .get("autoSetDNSMode")
        .and_then(Value::as_str)
        .unwrap_or("none");
    if auto_set_dns_mode == "none" {
        return Ok(());
    }

    let Some(origin_dns) = app_config.get("originDNS").and_then(Value::as_str) else {
        return Ok(());
    };

    set_dns_macos(app, origin_dns, auto_set_dns_mode)?;
    set_app_config_partial(app, &json!({ "originDNS": Value::Null }))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn set_public_dns(app: &tauri::AppHandle) -> Result<(), String> {
    set_public_dns_macos(app)
}

#[cfg(not(target_os = "macos"))]
fn set_public_dns(_app: &tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn recover_dns(app: &tauri::AppHandle) -> Result<(), String> {
    recover_dns_macos(app)
}

#[cfg(not(target_os = "macos"))]
fn recover_dns(_app: &tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

