pub fn run() {
    wait_for_admin_relaunch_parent_exit();
    let context = tauri::generate_context!();
    if !prepare_windows_elevated_startup_before_tauri(context.config().identifier.as_str()) {
        return;
    }
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
            allow_single_instance_messages_from_unelevated_launchers(&app_handle);
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
        .build(context)
        .expect("error while building RouteX Tauri shell")
        .run(|app_handle, event| {
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                shutdown_runtime_once(app_handle);
            }
        });
}

#[cfg(target_os = "windows")]
fn allow_single_instance_messages_from_unelevated_launchers(app: &tauri::AppHandle) {
    const WM_COPYDATA: u32 = 0x004A;
    const MSGFLT_ALLOW: u32 = 1;

    #[link(name = "user32")]
    unsafe extern "system" {
        fn FindWindowW(class_name: *const u16, window_name: *const u16) -> *mut std::ffi::c_void;
        fn ChangeWindowMessageFilterEx(
            hwnd: *mut std::ffi::c_void,
            message: u32,
            action: u32,
            change_filter_struct: *mut std::ffi::c_void,
        ) -> i32;
    }

    fn wide_null(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    let id = &app.config().identifier;
    let class_name = wide_null(&format!("{id}-sic"));
    let window_name = wide_null(&format!("{id}-siw"));

    let hwnd = unsafe { FindWindowW(class_name.as_ptr(), window_name.as_ptr()) };
    if !hwnd.is_null() {
        let _ = unsafe {
            ChangeWindowMessageFilterEx(hwnd, WM_COPYDATA, MSGFLT_ALLOW, std::ptr::null_mut())
        };
    }
}

#[cfg(not(target_os = "windows"))]
fn allow_single_instance_messages_from_unelevated_launchers(_app: &tauri::AppHandle) {}
