fn read_sysproxy_value(app: &tauri::AppHandle) -> Result<Value, String> {
    Ok(read_app_config_store(app)?
        .get("sysProxy")
        .cloned()
        .unwrap_or_else(|| json!({ "enable": false, "mode": "manual" })))
}

fn read_only_active_device(app: &tauri::AppHandle) -> Result<bool, String> {
    Ok(read_app_config_store(app)?
        .get("onlyActiveDevice")
        .and_then(Value::as_bool)
        .unwrap_or(false))
}

fn read_mixed_port(app: &tauri::AppHandle) -> Result<u64, String> {
    Ok(read_controlled_config_store(app)?
        .get("mixed-port")
        .and_then(Value::as_u64)
        .unwrap_or(7890))
}

fn build_sysproxy_signature(
    app: &tauri::AppHandle,
    enable: bool,
    only_active_device: bool,
) -> Result<String, String> {
    if !enable {
        return Ok(json!({
            "enable": enable,
            "onlyActiveDevice": only_active_device,
        })
        .to_string());
    }

    let sysproxy = read_sysproxy_value(app)?;
    let bypass = {
        let values = json_array_strings(sysproxy.get("bypass"));
        if values.is_empty() {
            default_sysproxy_bypass()
        } else {
            values
        }
    };

    Ok(json!({
        "enable": enable,
        "onlyActiveDevice": only_active_device,
        "mode": sysproxy.get("mode").and_then(Value::as_str).unwrap_or("manual"),
        "host": sysproxy.get("host").and_then(Value::as_str).unwrap_or("127.0.0.1"),
        "settingMode": sysproxy.get("settingMode").and_then(Value::as_str).unwrap_or("exec"),
        "bypass": bypass,
        "port": read_mixed_port(app)?,
    })
    .to_string())
}

