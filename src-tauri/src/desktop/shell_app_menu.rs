#[cfg(target_os = "macos")]
fn build_application_menu(app: &tauri::AppHandle) -> Result<Menu<tauri::Wry>, String> {
    let package_info = app.package_info();
    let config = app.config();
    let about_metadata = AboutMetadata {
        name: Some(package_info.name.clone()),
        version: Some(package_info.version.to_string()),
        authors: config
            .bundle
            .publisher
            .clone()
            .map(|publisher| vec![publisher]),
        copyright: config.bundle.copyright.clone(),
        ..Default::default()
    };

    let quit_without_core = MenuItem::with_id(
        app,
        APP_MENU_QUIT_WITHOUT_CORE_ID,
        "保留内核退出",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let restart_app =
        MenuItem::with_id(app, APP_MENU_RESTART_APP_ID, "重启应用", true, None::<&str>)
            .map_err(|e| e.to_string())?;
    let quit = MenuItem::with_id(
        app,
        APP_MENU_QUIT_ID,
        "退出应用",
        true,
        Some("CommandOrControl+Q"),
    )
    .map_err(|e| e.to_string())?;
    let open_app_dir = MenuItem::with_id(
        app,
        APP_MENU_OPEN_APP_DIR_ID,
        "应用目录",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let open_work_dir = MenuItem::with_id(
        app,
        APP_MENU_OPEN_WORK_DIR_ID,
        "工作目录",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let open_core_dir = MenuItem::with_id(
        app,
        APP_MENU_OPEN_CORE_DIR_ID,
        "内核目录",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let open_log_dir = MenuItem::with_id(
        app,
        APP_MENU_OPEN_LOG_DIR_ID,
        "日志目录",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let reload = MenuItem::with_id(
        app,
        APP_MENU_RELOAD_ID,
        "重新加载",
        true,
        Some("CommandOrControl+R"),
    )
    .map_err(|e| e.to_string())?;
    let open_devtools = MenuItem::with_id(
        app,
        APP_MENU_OPEN_DEVTOOLS_ID,
        "开发者工具",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let learn_more = MenuItem::with_id(app, APP_MENU_LEARN_MORE_ID, "了解更多", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let report_issue = MenuItem::with_id(
        app,
        APP_MENU_REPORT_ISSUE_ID,
        "报告问题",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let about =
        PredefinedMenuItem::about(app, None, Some(about_metadata)).map_err(|e| e.to_string())?;
    let services = PredefinedMenuItem::services(app, None).map_err(|e| e.to_string())?;
    let hide = PredefinedMenuItem::hide(app, None).map_err(|e| e.to_string())?;
    let hide_others = PredefinedMenuItem::hide_others(app, None).map_err(|e| e.to_string())?;
    let show_all = PredefinedMenuItem::show_all(app, None).map_err(|e| e.to_string())?;
    let separator_1 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let separator_2 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let separator_3 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let separator_4 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let undo = PredefinedMenuItem::undo(app, None).map_err(|e| e.to_string())?;
    let redo = PredefinedMenuItem::redo(app, None).map_err(|e| e.to_string())?;
    let edit_separator = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let cut = PredefinedMenuItem::cut(app, None).map_err(|e| e.to_string())?;
    let copy = PredefinedMenuItem::copy(app, None).map_err(|e| e.to_string())?;
    let paste = PredefinedMenuItem::paste(app, None).map_err(|e| e.to_string())?;
    let select_all = PredefinedMenuItem::select_all(app, None).map_err(|e| e.to_string())?;
    let minimize = PredefinedMenuItem::minimize(app, None).map_err(|e| e.to_string())?;
    let window_separator = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let close_window = PredefinedMenuItem::close_window(app, None).map_err(|e| e.to_string())?;

    let app_submenu = Submenu::with_items(
        app,
        package_info.name.clone(),
        true,
        &[
            &about,
            &separator_1,
            &services,
            &separator_2,
            &hide,
            &hide_others,
            &show_all,
            &separator_3,
            &quit_without_core,
            &restart_app,
            &quit,
        ],
    )
    .map_err(|e| e.to_string())?;

    let edit_submenu = Submenu::with_items(
        app,
        "编辑",
        true,
        &[
            &undo,
            &redo,
            &edit_separator,
            &cut,
            &copy,
            &paste,
            &select_all,
        ],
    )
    .map_err(|e| e.to_string())?;

    let open_dir_submenu = Submenu::with_items(
        app,
        "打开目录",
        true,
        &[&open_app_dir, &open_work_dir, &open_core_dir, &open_log_dir],
    )
    .map_err(|e| e.to_string())?;
    let tools_submenu = Submenu::with_items(
        app,
        "工具",
        true,
        &[&open_dir_submenu, &separator_4, &reload, &open_devtools],
    )
    .map_err(|e| e.to_string())?;

    let window_submenu = Submenu::with_items(
        app,
        "窗口",
        true,
        &[&minimize, &window_separator, &close_window],
    )
    .map_err(|e| e.to_string())?;

    let help_submenu = Submenu::with_items(app, "帮助", true, &[&learn_more, &report_issue])
        .map_err(|e| e.to_string())?;

    Menu::with_items(
        app,
        &[
            &app_submenu,
            &edit_submenu,
            &tools_submenu,
            &window_submenu,
            &help_submenu,
        ],
    )
    .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn handle_application_menu_event(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    event: &MenuEvent,
) -> Result<(), String> {
    match event.id().as_ref() {
        APP_MENU_QUIT_WITHOUT_CORE_ID => exit_app_without_core(app),
        APP_MENU_RESTART_APP_ID => relaunch_current_app(app, state),
        APP_MENU_QUIT_ID => {
            if request_quit_confirmation(app, state)? {
                shutdown_runtime_once(app);
                app.exit(0);
            }
            Ok(())
        }
        APP_MENU_OPEN_APP_DIR_ID => open_path_in_shell(&app_data_root(app)?),
        APP_MENU_OPEN_WORK_DIR_ID => open_path_in_shell(&resolve_current_runtime_dirs(app)?.1),
        APP_MENU_OPEN_CORE_DIR_ID => {
            let core = read_core_name(app)?;
            let core_binary = resolve_core_binary(app, &core)?;
            let core_dir = core_binary
                .parent()
                .map(Path::to_path_buf)
                .ok_or_else(|| "无法解析内核目录".to_string())?;
            open_path_in_shell(&core_dir)
        }
        APP_MENU_OPEN_LOG_DIR_ID => open_path_in_shell(&resolve_current_runtime_dirs(app)?.2),
        APP_MENU_RELOAD_ID => {
            let window = ensure_main_window(app)?;
            window
                .eval("window.location.reload()")
                .map_err(|e| e.to_string())?;
            Ok(())
        }
        APP_MENU_OPEN_DEVTOOLS_ID => {
            #[cfg(debug_assertions)]
            {
                ensure_main_window(app)?.open_devtools();
            }
            Ok(())
        }
        APP_MENU_LEARN_MORE_ID => open_external_url("https://github.com/Jarv1s0/RouteX"),
        APP_MENU_REPORT_ISSUE_ID => open_external_url("https://github.com/Jarv1s0/RouteX/issues"),
        _ => Ok(()),
    }
}

