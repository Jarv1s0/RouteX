fn handle_shell_invoke(app: &tauri::AppHandle, window: &tauri::WebviewWindow, state: &State<'_, CoreState>, channel: &str, args: &[Value]) -> Result<Option<Value>, String> {
    let result: Result<Value, String> = match channel {
        "registerShortcut" => {
            let old_shortcut = args.first().and_then(Value::as_str).unwrap_or_default();
            let new_shortcut = args.get(1).and_then(Value::as_str).unwrap_or_default();
            let action = args
                .get(2)
                .and_then(Value::as_str)
                .ok_or_else(|| "registerShortcut requires action".to_string())?;
            Ok(json!(register_global_shortcut(
                &app,
                old_shortcut,
                new_shortcut,
                action
            )?))
        }
        "quitWithoutCore" => {
            exit_app_without_core(&app)?;
            Ok(Value::Null)
        }
        "quitConfirmResult" => {
            let confirmed = args.first().and_then(Value::as_bool).unwrap_or(false);
            resolve_quit_confirmation(&state, confirmed)?;
            Ok(Value::Null)
        }
        "quitApp" => {
            if request_quit_confirmation(&app, &state)? {
                shutdown_runtime_once(&app);
                app.exit(0);
            }
            Ok(Value::Null)
        }
        "notDialogQuit" => {
            shutdown_runtime_once(&app);
            app.exit(0);
            Ok(Value::Null)
        }
        "showMainWindow" => {
            show_main_window(&app)?;
            Ok(Value::Null)
        }
        "triggerMainWindow" => {
            trigger_main_window(&app)?;
            Ok(Value::Null)
        }
        "closeMainWindow" => {
            hide_main_window(&app, true)?;
            Ok(Value::Null)
        }
        "windowMin" => {
            let _ = window.minimize();
            Ok(Value::Null)
        }
        "windowMax" => {
            let is_maximized = window.is_maximized().map_err(|e| e.to_string())?;
            if is_maximized {
                let _ = window.unmaximize();
            } else {
                let _ = window.maximize();
            }
            Ok(Value::Null)
        }
        "setAlwaysOnTop" => {
            let always_on_top = args
                .first()
                .and_then(Value::as_bool)
                .ok_or_else(|| "setAlwaysOnTop requires a boolean argument".to_string())?;
            let _ = window.set_always_on_top(always_on_top);
            Ok(Value::Null)
        }
        "isAlwaysOnTop" => Ok(json!(window
            .is_always_on_top()
            .map_err(|e| e.to_string())?)),
        "setTitleBarOverlay" => Ok(Value::Null),
        "setDockVisible" => {
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
        }
        "showFloatingWindow" => {
            let window = ensure_floating_window(&app)?;
            let _ = window.show();
            let _ = window.set_focus();
            Ok(Value::Null)
        }
        "closeFloatingWindow" => {
            if let Some(window) = app.get_webview_window(FLOATING_WINDOW_LABEL) {
                let _ = window.close();
            }
            patch_app_config_store(
                &app,
                &json!({
                    "showFloatingWindow": false,
                    "disableTray": false
                }),
            )?;
            sync_shell_surfaces(&app)?;
            emit_ipc_event(&app, "appConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "showTrayIcon" => {
            ensure_tray_icon(&app)?;
            Ok(Value::Null)
        }
        "closeTrayIcon" => {
            hide_traymenu_window(&app);
            if let Some(tray) = app.remove_tray_by_id(TRAY_ICON_ID) {
                let _ = tray.set_visible(false);
            }
            Ok(Value::Null)
        }
        "closeTrayMenuWindow" => {
            hide_traymenu_window(&app);
            Ok(Value::Null)
        }
        "updateFloatingWindow" => {
            emit_ipc_event(&app, "appConfigUpdated", Value::Null);
            emit_ipc_event(&app, "controledMihomoConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "updateTrayMenu" => {
            update_tray_icon_for_state(&app)?;
            refresh_native_tray_menu(&app)?;
            emit_ipc_event(&app, "appConfigUpdated", Value::Null);
            emit_ipc_event(&app, "controledMihomoConfigUpdated", Value::Null);
            emit_ipc_event(&app, "groupsUpdated", Value::Null);
            Ok(Value::Null)
        }
        "updateTaskbarIcon" => {
            #[cfg(target_os = "windows")]
            {
                let icon_kind = args.first().and_then(Value::as_str).unwrap_or("default");
                let icon_name = windows_shell_icon_name_from_kind(icon_kind);
                set_windows_shell_icon_from_path(&app, icon_name)?;
            }
            Ok(Value::Null)
        }
        "trayIconUpdate" => {
            let data_url = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "trayIconUpdate requires data url".to_string())?;
            apply_tray_icon_data_url(&app, data_url)?;
            Ok(Value::Null)
        }
        "startMonitor" => {
            start_traffic_monitor(&app)?;
            update_tray_icon_for_state(&app)?;
            refresh_native_tray_menu(&app)?;
            Ok(Value::Null)
        }
        "setupFirewall" => {
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
                    resolve_core_binary(&app, "mihomo")?.to_string_lossy(),
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
        }
        "startNetworkDetection" => {
            start_network_detection(&app, &state)?;
            Ok(Value::Null)
        }
        "stopNetworkDetection" => {
            stop_network_detection(&state)?;
            Ok(Value::Null)
        }
        "triggerSysProxy" => {
            let enable = args
                .first()
                .and_then(Value::as_bool)
                .ok_or_else(|| "triggerSysProxy requires enable".to_string())?;
            let only_active_device = args.get(1).and_then(Value::as_bool).unwrap_or(false);
            trigger_sys_proxy(&app, &state, enable, only_active_device)?;
            Ok(Value::Null)
        }
        "showContextMenu" => {
            let position = window.outer_position().map_err(|e| e.to_string())?;
            let size = window.outer_size().map_err(|e| e.to_string())?;
            show_traymenu_window(
                &app,
                Some((
                    position.x as f64 + size.width as f64 / 2.0,
                    position.y as f64,
                )),
            )?;
            Ok(Value::Null)
        }
        "openDevTools" => {
            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }
            Ok(Value::Null)
        }
        "openExternalUrl" => {
            let url = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "openExternalUrl requires url".to_string())?;
            open_external_url(url)?;
            Ok(Value::Null)
        }
        _ => return Ok(None),
    };
    Ok(Some(result?))
}
