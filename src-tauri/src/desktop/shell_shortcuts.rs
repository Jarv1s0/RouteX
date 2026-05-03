fn run_shortcut_action(
    app: &tauri::AppHandle,
    action: &str,
    event: &ShortcutEvent,
) -> Result<(), String> {
    if event.state != ShortcutState::Pressed {
        return Ok(());
    }

    let state = app.state::<CoreState>();

    match action {
        "showWindowShortcut" => trigger_main_window(app),
        "showFloatingWindowShortcut" => handle_tray_toggle_floating(app),
        "triggerSysProxyShortcut" => handle_tray_toggle_sys_proxy(app, &state),
        "triggerTunShortcut" => handle_tray_toggle_tun(app, &state),
        "ruleModeShortcut" => handle_tray_change_mode(app, &state, "rule"),
        "globalModeShortcut" => handle_tray_change_mode(app, &state, "global"),
        "directModeShortcut" => handle_tray_change_mode(app, &state, "direct"),
        "quitWithoutCoreShortcut" => exit_app_without_core(app),
        "restartAppShortcut" => relaunch_current_app(app, &state),
        _ => Err(format!("Unknown shortcut action: {action}")),
    }
}

fn register_shortcut_binding(
    app: &tauri::AppHandle,
    shortcut_text: &str,
    action: &str,
) -> Result<(), String> {
    if shortcut_text.trim().is_empty() {
        return Ok(());
    }

    let action_name = action.to_string();
    app.global_shortcut()
        .on_shortcut(
            shortcut_text,
            move |app_handle, _shortcut: &Shortcut, event| {
                if let Err(error) = run_shortcut_action(app_handle, &action_name, &event) {
                    eprintln!("shortcut action failed: {error}");
                }
            },
        )
        .map_err(|e| e.to_string())
}

fn read_shortcut_binding(config: &Value, action: &str) -> String {
    config
        .get(action)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn init_global_shortcuts(app: &tauri::AppHandle) -> Result<(), String> {
    if !global_shortcut_plugin_enabled() {
        return Ok(());
    }

    let config = read_app_config_store(app)?;

    app.global_shortcut()
        .unregister_all()
        .map_err(|e| e.to_string())?;

    for action in SHORTCUT_ACTION_KEYS {
        let shortcut_text = read_shortcut_binding(&config, action);
        if shortcut_text.is_empty() {
            continue;
        }

        register_shortcut_binding(app, &shortcut_text, action)?;
    }

    Ok(())
}

fn register_global_shortcut(
    app: &tauri::AppHandle,
    old_shortcut: &str,
    new_shortcut: &str,
    action: &str,
) -> Result<bool, String> {
    if !global_shortcut_plugin_enabled() {
        return Ok(true);
    }

    let shortcut_manager = app.global_shortcut();

    if !old_shortcut.trim().is_empty() {
        let _ = shortcut_manager.unregister(old_shortcut);
    }

    if new_shortcut.trim().is_empty() {
        return Ok(true);
    }

    match register_shortcut_binding(app, new_shortcut, action) {
        Ok(()) => Ok(true),
        Err(_) => Ok(false),
    }
}

