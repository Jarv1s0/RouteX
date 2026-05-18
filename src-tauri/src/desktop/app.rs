pub fn run() {
    let _ = APP_STARTED_AT.get_or_init(Instant::now);
    let builder = tauri::Builder::default();
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            let _ = show_main_window(app);
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build());
    let builder = if global_shortcut_plugin_enabled() {
        builder.plugin(tauri_plugin_global_shortcut::Builder::new().build())
    } else {
        builder
    };
    builder
        .manage(CoreState::default())
        .setup(|app| {
            let app_handle = app.handle().clone();
            if !ensure_elevated_startup(&app_handle)? {
                app_handle.exit(0);
                return Ok(());
            }
            let _ = initialize_traffic_stats_store(&app_handle);
            let _ = init_global_shortcuts(&app_handle);
            let _ = install_process_signal_handlers(&app_handle);
            #[cfg(target_os = "macos")]
            {
                let menu = build_application_menu(&app_handle)?;
                let _ = app_handle.set_menu(menu).map_err(|e| e.to_string())?;
                app_handle.on_menu_event(|app, event| {
                    let state = app.state::<CoreState>();
                    if let Err(error) = handle_application_menu_event(app, &state, &event) {
                        eprintln!("application menu event failed: {error}");
                    }
                });
            }
            if let Some(window) = app_handle.get_webview_window("main") {
                install_main_window_handlers(&app_handle, &window);
            }
            let startup_launch =
                std::env::args().any(|arg| arg.eq_ignore_ascii_case(ROUTEX_STARTUP_ARG));
            match read_startup_alignment_config(&app_handle) {
                Ok(startup_config) => {
                    let startup_handle = app_handle.clone();
                    thread::spawn(move || {
                        let _ = run_startup_alignment(&startup_handle, &startup_config);
                    });
                }
                Err(error) => {
                    eprintln!("startup alignment failed: {error}");
                    if !startup_launch {
                        let _ = show_main_window(&app_handle);
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            desktop_invoke,
            desktop_check_update,
            desktop_get_icon_data_urls
        ])
        .build(tauri::generate_context!())
        .expect("error while building RouteX Tauri shell")
        .run(|app_handle, event| {
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                shutdown_runtime_once(app_handle);
            }
        });
}
