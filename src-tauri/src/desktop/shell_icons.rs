fn resolve_tray_icon_path(app: &tauri::AppHandle, file_name: &str) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join(file_name));
        candidates.push(resource_dir.join("resources").join(file_name));
    }

    #[cfg(debug_assertions)]
    {
        let manifest_resource_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("resources")
            .join(file_name);
        candidates.push(manifest_resource_path);
    }

    if let Some(path) = candidates.iter().find(|path| path.exists()) {
        return Ok(path.clone());
    }

    let tried_paths = if candidates.is_empty() {
        "<no candidate paths>".to_string()
    } else {
        candidates
            .iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join(", ")
    };

    Err(format!(
        "Tray icon not found: {file_name}. Tried: {tried_paths}"
    ))
}

fn set_tray_icon_from_path(app: &tauri::AppHandle, file_name: &str) -> Result<(), String> {
    let Some(tray) = app.tray_by_id(TRAY_ICON_ID) else {
        return Ok(());
    };
    let path = resolve_tray_icon_path(app, file_name)?;
    let image = Image::from_path(path).map_err(|e| e.to_string())?;
    tray.set_icon(Some(image)).map_err(|e| e.to_string())
}

fn set_main_window_icon_from_path(app: &tauri::AppHandle, file_name: &str) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };
    let path = resolve_tray_icon_path(app, file_name)?;
    let image = Image::from_path(path).map_err(|e| e.to_string())?;
    window.set_icon(image).map_err(|e| e.to_string())
}

fn set_windows_shell_icon_from_path(app: &tauri::AppHandle, file_name: &str) -> Result<(), String> {
    set_main_window_icon_from_path(app, file_name)?;
    set_tray_icon_from_path(app, file_name)
}

fn windows_shell_icon_name_from_kind(kind: &str) -> &'static str {
    match kind {
        "tun" => "icon_tun.ico",
        "proxy" => "icon_proxy.ico",
        _ => "icon.ico",
    }
}

fn windows_shell_icon_name_from_state(app: &tauri::AppHandle) -> Result<&'static str, String> {
    let config = read_app_config_store(app)?;
    let controled = read_controlled_config_store(app)?;
    let sysproxy_enabled = config
        .get("sysProxy")
        .and_then(Value::as_object)
        .and_then(|value| value.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let tun_enabled = controled
        .get("tun")
        .and_then(Value::as_object)
        .and_then(|value| value.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);

    Ok(if tun_enabled {
        "icon_tun.ico"
    } else if sysproxy_enabled {
        "icon_proxy.ico"
    } else {
        "icon.ico"
    })
}

fn update_windows_shell_icon_for_state(app: &tauri::AppHandle) -> Result<(), String> {
    let icon_name = windows_shell_icon_name_from_state(app)?;
    set_windows_shell_icon_from_path(app, icon_name)
}

fn update_tray_icon_for_state(app: &tauri::AppHandle) -> Result<(), String> {
    if cfg!(target_os = "windows") {
        return update_windows_shell_icon_for_state(app);
    }

    if app.tray_by_id(TRAY_ICON_ID).is_none() {
        return Ok(());
    }

    if cfg!(target_os = "macos") {
        let config = read_app_config_store(app)?;
        let show_traffic = config
            .get("showTraffic")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if !show_traffic {
            return set_tray_icon_from_path(app, "iconTemplate.png");
        }
    }

    if cfg!(target_os = "linux") {
        return set_tray_icon_from_path(app, "icon.png");
    }

    Ok(())
}

fn apply_tray_icon_data_url(app: &tauri::AppHandle, data_url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let Some(tray) = app.tray_by_id(TRAY_ICON_ID) else {
            return Ok(());
        };
        let encoded = data_url
            .split_once(',')
            .map(|(_, value)| value)
            .ok_or_else(|| "invalid tray icon data url".to_string())?;
        let bytes = BASE64_STANDARD.decode(encoded).map_err(|e| e.to_string())?;
        let image = Image::from_bytes(&bytes).map_err(|e| e.to_string())?;
        return tray.set_icon(Some(image)).map_err(|e| e.to_string());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, data_url);
        Ok(())
    }
}

