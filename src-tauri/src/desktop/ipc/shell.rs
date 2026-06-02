#[allow(clippy::redundant_closure_call)]
pub(crate) fn register_shell_handlers(map: &mut std::collections::HashMap<&'static str, crate::desktop::ipc::IpcHandler>) {
    map.insert("registerShortcut", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let old_shortcut = args.first().and_then(Value::as_str).unwrap_or_default();
            let new_shortcut = args.get(1).and_then(Value::as_str).unwrap_or_default();
            let action = args
                .get(2)
                .and_then(Value::as_str)
                .ok_or_else(|| "registerShortcut requires action".to_string())?;
            Ok(json!(register_global_shortcut(
                app,
                old_shortcut,
                new_shortcut,
                action
            )?))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("quitWithoutCore", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            exit_app_without_core(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("quitConfirmResult", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let confirmed = args.first().and_then(Value::as_bool).unwrap_or(false);
            resolve_quit_confirmation(state, confirmed)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("quitApp", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            if request_quit_confirmation(app, state)? {
                exit_app(app)?;
            }
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("notDialogQuit", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            exit_app(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("showMainWindow", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            show_main_window(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("mainWindowReady", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            if should_show_main_window_after_renderer_ready(app)? {
                show_main_window(app)?;
            }
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("triggerMainWindow", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            trigger_main_window(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("closeMainWindow", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            hide_main_window(app, true)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("windowMin", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let _ = window.minimize();
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("windowMax", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let is_maximized = window.is_maximized().map_err(|e| e.to_string())?;
            if is_maximized {
                let _ = window.unmaximize();
            } else {
                let _ = window.maximize();
            }
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("setAlwaysOnTop", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let always_on_top = args
                .first()
                .and_then(Value::as_bool)
                .ok_or_else(|| "setAlwaysOnTop requires a boolean argument".to_string())?;
            let _ = window.set_always_on_top(always_on_top);
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("isAlwaysOnTop", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(window
            .is_always_on_top()
            .map_err(|e| e.to_string())?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("setTitleBarOverlay", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(Value::Null) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("setDockVisible", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let visible = args
                .first()
                .and_then(Value::as_bool)
                .ok_or_else(|| "setDockVisible requires visible".to_string())?;
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_dock_visibility(visible);
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = visible;
            }
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("showFloatingWindow", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let window = ensure_floating_window(app)?;
            let _ = window.show();
            let _ = window.set_focus();
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("closeFloatingWindow", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            if let Some(window) = app.get_webview_window(FLOATING_WINDOW_LABEL) {
                let _ = window.close();
            }
            patch_app_config_store(
                app,
                &json!({
                    "showFloatingWindow": false,
                    "disableTray": false
                }),
            )?;
            sync_shell_surfaces(app)?;
            emit_ipc_event(app, "appConfigUpdated", Value::Null);
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("showTrayIcon", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            ensure_tray_icon(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("closeTrayIcon", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            hide_traymenu_window(app);
            if let Some(tray) = app.remove_tray_by_id(TRAY_ICON_ID) {
                let _ = tray.set_visible(false);
            }
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("closeTrayMenuWindow", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            hide_traymenu_window(app);
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("updateFloatingWindow", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            emit_ipc_event(app, "appConfigUpdated", Value::Null);
            emit_ipc_event(app, "controledMihomoConfigUpdated", Value::Null);
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("updateTrayMenu", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            update_tray_icon_for_state(app)?;
            refresh_native_tray_menu(app)?;
            emit_ipc_event(app, "appConfigUpdated", Value::Null);
            emit_ipc_event(app, "controledMihomoConfigUpdated", Value::Null);
            emit_ipc_event(app, "groupsUpdated", Value::Null);
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("updateTaskbarIcon", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            #[cfg(target_os = "windows")]
            {
                let icon_kind = args.first().and_then(Value::as_str).unwrap_or("default");
                let (window_icon, tray_icon) = windows_shell_icon_names_from_kind(icon_kind);
                set_windows_shell_icon_from_paths(app, window_icon, tray_icon)?;
            }
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("trayIconUpdate", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let data_url = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "trayIconUpdate requires data url".to_string())?;
            apply_tray_icon_data_url(app, data_url)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("startMonitor", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            start_traffic_monitor(app)?;
            update_tray_icon_for_state(app)?;
            refresh_native_tray_menu(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("setupFirewall", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            #[cfg(target_os = "windows")]
            {
                let remove_command = r#"
                $rules = @("mihomo", "mihomo-alpha", "RouteX")
                foreach ($rule in $rules) {
                  if (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue) {
                    Remove-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue
                  }
                }
                "#;
                let create_command = format!(
                    r#"
                    New-NetFirewallRule -DisplayName "mihomo" -Direction Inbound -Action Allow -Program "{}" -Enabled True -Profile Any -ErrorAction SilentlyContinue
                    New-NetFirewallRule -DisplayName "RouteX" -Direction Inbound -Action Allow -Program "{}" -Enabled True -Profile Any -ErrorAction SilentlyContinue
                    "#,
                    resolve_core_binary(app, "mihomo")?.to_string_lossy(),
                    std::env::current_exe()
                        .map_err(|e| e.to_string())?
                        .to_string_lossy()
                );
                let _ = powershell_command()
                    .args(["-Command", remove_command])
                    .status()
                    .map_err(|e| e.to_string())?;
                let _ = powershell_command()
                    .args(["-Command", &create_command])
                    .status()
                    .map_err(|e| e.to_string())?;
            }
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("startNetworkDetection", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            start_network_detection(app, state)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("stopNetworkDetection", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            stop_network_detection(state)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("triggerSysProxy", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let enable = args
                .first()
                .and_then(Value::as_bool)
                .ok_or_else(|| "triggerSysProxy requires enable".to_string())?;
            let only_active_device = args.get(1).and_then(Value::as_bool).unwrap_or(false);
            trigger_sys_proxy(app, state, enable, only_active_device)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("showContextMenu", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let position = window.outer_position().map_err(|e| e.to_string())?;
            let size = window.outer_size().map_err(|e| e.to_string())?;
            show_traymenu_window(
                app,
                Some((
                    position.x as f64 + size.width as f64 / 2.0,
                    position.y as f64,
                )),
            )?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("openDevTools", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("openExternalUrl", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let url = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "openExternalUrl requires url".to_string())?;
            open_external_url(url)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
}
