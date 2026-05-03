fn ensure_floating_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(FLOATING_WINDOW_LABEL) {
        return Ok(window);
    }

    let mut builder = WebviewWindowBuilder::new(
        app,
        FLOATING_WINDOW_LABEL,
        WebviewUrl::App("floating.html".into()),
    )
    .title("RouteX Floating")
    .inner_size(120.0, 42.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(true)
    .visible(false)
    .focused(true);

    #[cfg(target_os = "windows")]
    {
        builder = builder.transparent(true);
    }

    if let Some(state) = read_floating_window_state(app)? {
        builder = builder.position(state.x as f64, state.y as f64);
    }

    let window = builder.build().map_err(|e: tauri::Error| e.to_string())?;

    window.on_window_event({
        let handle = app.clone();
        move |event| {
            if let WindowEvent::Moved(position) = event {
                let _ = write_floating_window_state(
                    &handle,
                    &FloatingWindowState {
                        x: position.x,
                        y: position.y,
                    },
                );
            }
        }
    });

    let _ = window.set_always_on_top(true);
    let _ = window.set_skip_taskbar(true);
    Ok(window)
}

fn position_traymenu_window(
    window: &tauri::WebviewWindow,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .or_else(|| window.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let monitor_position = monitor.position();
        let size = monitor.size();
        let min_x = monitor_position.x as f64;
        let min_y = monitor_position.y as f64;
        let max_x = (min_x + size.width as f64 - width).max(min_x);
        let max_y = (min_y + size.height as f64 - height).max(min_y);
        let open_below = y <= min_y + size.height as f64 / 2.0;
        let preferred_x = x - width / 2.0;
        let preferred_y = if open_below {
            y + TRAYMENU_WINDOW_GAP
        } else {
            y - height - TRAYMENU_WINDOW_GAP
        };
        let safe_x = preferred_x.clamp(min_x, max_x);
        let safe_y = preferred_y.clamp(min_y, max_y);
        window
            .set_position(Position::Physical(PhysicalPosition::new(
                safe_x as i32,
                safe_y as i32,
            )))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn ensure_traymenu_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(TRAYMENU_WINDOW_LABEL) {
        return Ok(window);
    }

    let window = WebviewWindowBuilder::new(
        app,
        TRAYMENU_WINDOW_LABEL,
        WebviewUrl::App("traymenu.html".into()),
    )
    .title("RouteX Tray Menu")
    .inner_size(TRAYMENU_WINDOW_WIDTH, TRAYMENU_WINDOW_HEIGHT)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(true)
    .visible(false)
    .focused(true);

    #[cfg(target_os = "windows")]
    let window = window.transparent(true);

    let window = window.build().map_err(|e| e.to_string())?;

    window.on_window_event({
        let handle = app.clone();
        move |event| {
            if let WindowEvent::Focused(false) = event {
                hide_traymenu_window(&handle);
            }
        }
    });

    Ok(window)
}

fn show_traymenu_window(
    app: &tauri::AppHandle,
    position: Option<(f64, f64)>,
) -> Result<(), String> {
    let window = ensure_traymenu_window(app)?;
    if let Some((x, y)) = position {
        let _ =
            position_traymenu_window(&window, x, y, TRAYMENU_WINDOW_WIDTH, TRAYMENU_WINDOW_HEIGHT);
    }
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

fn toggle_traymenu_window(
    app: &tauri::AppHandle,
    position: Option<(f64, f64)>,
) -> Result<(), String> {
    let window = ensure_traymenu_window(app)?;
    if window.is_visible().map_err(|e| e.to_string())? {
        let _ = window.hide();
        return Ok(());
    }
    show_traymenu_window(app, position)
}

fn sync_shell_surfaces(app: &tauri::AppHandle) -> Result<(), String> {
    let config = read_app_config_store(app)?;
    let disable_tray = config
        .get("disableTray")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let show_floating = config
        .get("showFloatingWindow")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    if disable_tray {
        hide_traymenu_window(app);
        if let Some(tray) = app.remove_tray_by_id(TRAY_ICON_ID) {
            let _ = tray.set_visible(false);
        }
    } else {
        ensure_tray_icon(app)?;
        update_tray_icon_for_state(app)?;
        let _ = refresh_native_tray_menu(app);
    }

    if show_floating {
        let window = ensure_floating_window(app)?;
        let _ = window.show();
    } else if let Some(window) = app.get_webview_window(FLOATING_WINDOW_LABEL) {
        let _ = window.close();
    }

    Ok(())
}

fn ensure_tray_icon(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(TRAY_ICON_ID) {
        let _ = tray.set_visible(true);
        let _ = refresh_native_tray_menu(app);
        update_tray_icon_for_state(app)?;
        return Ok(());
    }

    let mut builder = TrayIconBuilder::with_id(TRAY_ICON_ID)
        .tooltip("RouteX")
        .show_menu_on_left_click(false);

    #[cfg(not(target_os = "macos"))]
    {
        let menu = build_native_tray_menu(app)?;
        builder = builder.menu(&menu).on_menu_event(|app, event| {
            if let Err(error) = handle_native_tray_menu_event(app, &event) {
                eprintln!("tray menu event failed: {error}");
            }
        });
    }

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder
        .on_tray_icon_event({
            let handle = app.clone();
            move |_tray, event| match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    position,
                    ..
                } => {
                    if cfg!(target_os = "macos") {
                        let _ = toggle_traymenu_window(&handle, Some((position.x, position.y)));
                    } else {
                        let _ = trigger_main_window(&handle);
                    }
                }
                TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                } => {
                    if !cfg!(target_os = "macos") {
                        let _ = show_main_window(&handle);
                    }
                }
                TrayIconEvent::Click {
                    button: MouseButton::Right,
                    button_state: MouseButtonState::Up,
                    ..
                } => {
                    if cfg!(target_os = "macos") {
                        let _ = show_main_window(&handle);
                    }
                }
                _ => {}
            }
        })
        .build(app)
        .map_err(|e| e.to_string())?;

    update_tray_icon_for_state(app)?;
    Ok(())
}

