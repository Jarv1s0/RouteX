use super::prelude::*;
use super::*;

pub(crate) fn embedded_app_icon_bytes(file_name: &str) -> Option<&'static [u8]> {
    match file_name {
        "icon_tun.ico" => Some(include_bytes!("../../../resources/icon_tun.ico")),
        "icon_tun_tray.ico" => Some(include_bytes!("../../../resources/icon_tun_tray.ico")),
        "icon_proxy.ico" => Some(include_bytes!("../../../resources/icon_proxy.ico")),
        "icon_proxy_tray.ico" => Some(include_bytes!("../../../resources/icon_proxy_tray.ico")),
        "icon.ico" => Some(include_bytes!("../../../resources/icon.ico")),
        "icon_tray.ico" => Some(include_bytes!("../../../resources/icon_tray.ico")),
        "icon.png" => Some(include_bytes!("../../../resources/icon.png")),
        "iconTemplate.png" => Some(include_bytes!("../../../resources/iconTemplate.png")),
        _ => None,
    }
}

pub(crate) fn resolve_tray_icon_image(file_name: &str) -> Result<Image<'static>, String> {
    if let Some(bytes) = embedded_app_icon_bytes(file_name) {
        return Image::from_bytes(bytes).map_err(|e| e.to_string());
    }

    Err(format!("Tray icon not embedded: {file_name}"))
}

pub(crate) fn set_tray_icon_from_path(
    app: &tauri::AppHandle,
    file_name: &str,
) -> Result<(), String> {
    let Some(tray) = app.tray_by_id(TRAY_ICON_ID) else {
        return Ok(());
    };
    let image = resolve_tray_icon_image(file_name)?;
    tray.set_icon(Some(image)).map_err(|e| e.to_string())
}

pub(crate) fn set_main_window_icon_from_path(
    app: &tauri::AppHandle,
    file_name: &str,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };
    let image = resolve_tray_icon_image(file_name)?;
    window.set_icon(image).map_err(|e| e.to_string())
}

pub(crate) fn set_windows_shell_icon_from_paths(
    app: &tauri::AppHandle,
    window_icon: &str,
    tray_icon: &str,
) -> Result<(), String> {
    set_main_window_icon_from_path(app, window_icon)?;
    set_tray_icon_from_path(app, tray_icon)
}

pub(crate) fn windows_shell_icon_names_from_kind(kind: &str) -> (&'static str, &'static str) {
    match kind {
        "tun" => ("icon_tun.ico", "icon_tun_tray.ico"),
        "proxy" => ("icon_proxy.ico", "icon_proxy_tray.ico"),
        _ => ("icon.ico", "icon_tray.ico"),
    }
}

pub(crate) fn windows_shell_icon_names_from_state(
    app: &tauri::AppHandle,
) -> Result<(&'static str, &'static str), String> {
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
        ("icon_tun.ico", "icon_tun_tray.ico")
    } else if sysproxy_enabled {
        ("icon_proxy.ico", "icon_proxy_tray.ico")
    } else {
        ("icon.ico", "icon_tray.ico")
    })
}

pub(crate) fn update_windows_shell_icon_for_state(app: &tauri::AppHandle) -> Result<(), String> {
    let (window_icon, tray_icon) = windows_shell_icon_names_from_state(app)?;
    set_windows_shell_icon_from_paths(app, window_icon, tray_icon)
}

pub(crate) fn update_tray_icon_for_state(app: &tauri::AppHandle) -> Result<(), String> {
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

pub(crate) fn apply_tray_icon_data_url(
    app: &tauri::AppHandle,
    data_url: &str,
) -> Result<(), String> {
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
        tray.set_icon(Some(image)).map_err(|e| e.to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, data_url);
        Ok(())
    }
}
