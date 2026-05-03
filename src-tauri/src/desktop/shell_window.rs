fn set_main_window_close_allowed(app: &tauri::AppHandle, allowed: bool) {
    if let Ok(mut value) = app.state::<CoreState>().allow_main_window_close.lock() {
        *value = allowed;
    }
}

fn take_main_window_close_allowed(app: &tauri::AppHandle) -> bool {
    let state = app.state::<CoreState>();
    let Ok(mut value) = state.allow_main_window_close.lock() else {
        return false;
    };
    let current = *value;
    *value = false;
    current
}

fn stop_lightweight_mode(app: &tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<CoreState>();
    let mut handle = state.lightweight_mode.lock().map_err(|e| e.to_string())?;
    if let Some(current) = handle.take() {
        let _ = current.shutdown.send(());
    }
    Ok(())
}

fn close_main_window_renderer(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        set_main_window_close_allowed(app, true);
        let _ = window.close();
    }
    Ok(())
}

fn exit_app_without_core(app: &tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<CoreState>();
    state
        .preserve_core_on_exit
        .store(true, AtomicOrdering::SeqCst);
    let _ = stop_lightweight_mode(app);
    let _ = start_traffic_monitor(app);
    close_main_window_renderer(app)?;
    app.exit(0);
    Ok(())
}

fn resolve_quit_confirmation(state: &State<'_, CoreState>, confirmed: bool) -> Result<(), String> {
    let sender = state
        .quit_confirm_sender
        .lock()
        .map_err(|e| e.to_string())?
        .take();

    if let Some(sender) = sender {
        let _ = sender.send(confirmed);
    }

    Ok(())
}

fn request_quit_confirmation(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<bool, String> {
    let _ = stop_lightweight_mode(app);
    show_main_window(app)?;

    let (sender, receiver) = mpsc::channel();
    {
        let mut pending = state
            .quit_confirm_sender
            .lock()
            .map_err(|e| e.to_string())?;
        *pending = Some(sender);
    }

    emit_ipc_event(app, "show-quit-confirm", Value::Null);

    let confirmed = receiver
        .recv_timeout(Duration::from_secs(60))
        .unwrap_or(false);

    let mut pending = state
        .quit_confirm_sender
        .lock()
        .map_err(|e| e.to_string())?;
    pending.take();

    Ok(confirmed)
}

fn schedule_lightweight_mode(app: &tauri::AppHandle) -> Result<(), String> {
    stop_lightweight_mode(app)?;

    let config = read_app_config_store(app)?;
    let enabled = config
        .get("autoLightweight")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    if !enabled {
        return Ok(());
    }

    let delay_secs = config
        .get("autoLightweightDelay")
        .and_then(Value::as_u64)
        .unwrap_or(60);
    let mode = config
        .get("autoLightweightMode")
        .and_then(Value::as_str)
        .unwrap_or("core")
        .to_string();
    let (shutdown_tx, shutdown_rx) = mpsc::channel();

    {
        let state = app.state::<CoreState>();
        let mut handle = state.lightweight_mode.lock().map_err(|e| e.to_string())?;
        *handle = Some(LightweightModeHandle {
            shutdown: shutdown_tx,
        });
    }

    let app_handle = app.clone();
    thread::spawn(move || {
        if shutdown_rx
            .recv_timeout(Duration::from_secs(delay_secs))
            .is_ok()
        {
            return;
        }

        let _ = match mode.as_str() {
            "tray" => close_main_window_renderer(&app_handle),
            _ => exit_app_without_core(&app_handle),
        };

        if let Ok(mut handle) = app_handle.state::<CoreState>().lightweight_mode.lock() {
            *handle = None;
        }
    });

    Ok(())
}

fn refresh_lightweight_mode(app: &tauri::AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return stop_lightweight_mode(app);
    };

    if window.is_visible().map_err(|e| e.to_string())? {
        stop_lightweight_mode(app)
    } else {
        schedule_lightweight_mode(app)
    }
}

fn install_main_window_handlers(app: &tauri::AppHandle, window: &tauri::WebviewWindow) {
    let handle = app.clone();
    let tracked_window = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            if take_main_window_close_allowed(&handle) {
                return;
            }

            api.prevent_close();
            let _ = tracked_window.hide();
            let _ = schedule_lightweight_mode(&handle);
        }
    });
}

fn build_main_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|config| config.label == "main")
        .cloned()
        .ok_or_else(|| "main window config is missing".to_string())?;
    let window = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;
    install_main_window_handlers(app, &window);
    Ok(window)
}

fn ensure_main_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(window) = app.get_webview_window("main") {
        return Ok(window);
    }

    build_main_window(app)
}

fn hide_main_window(app: &tauri::AppHandle, lightweight: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }

    if lightweight {
        schedule_lightweight_mode(app)
    } else {
        stop_lightweight_mode(app)
    }
}

fn show_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    stop_lightweight_mode(app)?;
    let window = ensure_main_window(app)?;
    if window.is_minimized().map_err(|e| e.to_string())? {
        let _ = window.unminimize();
    }
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

fn trigger_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    let window = ensure_main_window(app)?;

    if window.is_visible().map_err(|e| e.to_string())?
        && !window.is_minimized().map_err(|e| e.to_string())?
    {
        return hide_main_window(app, false);
    }

    show_main_window(app)
}

