use super::*;

pub(super) struct StartupAlignmentConfig {
    pub(super) sysproxy_enabled: bool,
    pub(super) only_active_device: bool,
    pub(super) network_detection: bool,
    pub(super) show_traffic: bool,
}

pub(super) fn read_startup_alignment_config(
    app: &tauri::AppHandle,
) -> Result<StartupAlignmentConfig, String> {
    let config = read_app_config_store(app)?;
    let silent_start = config
        .get("silentStart")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    #[cfg(target_os = "macos")]
    {
        let use_dock_icon = config
            .get("useDockIcon")
            .and_then(Value::as_bool)
            .unwrap_or(true);
        let _ = app.set_dock_visibility(use_dock_icon);
    }
    let sysproxy_enabled = config
        .get("sysProxy")
        .and_then(Value::as_object)
        .and_then(|value| value.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let only_active_device = config
        .get("onlyActiveDevice")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let network_detection = config
        .get("networkDetection")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let show_traffic = config
        .get("showTraffic")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    sync_shell_surfaces(app)?;

    if silent_start {
        let _ = hide_main_window(app, true);
    } else {
        let _ = show_main_window(app);
    }

    Ok(StartupAlignmentConfig {
        sysproxy_enabled,
        only_active_device,
        network_detection,
        show_traffic,
    })
}

pub(super) fn run_startup_alignment(
    app: &tauri::AppHandle,
    startup_config: &StartupAlignmentConfig,
) -> Result<(), String> {
    let state = app.state::<CoreState>();

    if startup_config.sysproxy_enabled {
        let _ = trigger_sys_proxy(app, &state, true, startup_config.only_active_device);
    }

    if startup_config.network_detection {
        let _ = start_network_detection(app, &state);
    }

    if startup_config.show_traffic {
        let _ = start_traffic_monitor(app);
    }

    let _ = refresh_ssid_check(app);

    if restart_core_and_emit(app, &state).is_ok() {
        let _ = get_provider_stats_value(app);
    }

    Ok(())
}
