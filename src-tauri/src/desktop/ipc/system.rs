#[allow(clippy::redundant_closure_call)]
pub(crate) fn register_system_handlers(map: &mut std::collections::HashMap<&'static str, crate::desktop::ipc::IpcHandler>) {
    map.insert("getVersion", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(app.package_info().version.to_string())) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("platform", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(platform_name())) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("checkAutoRun", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(check_auto_run_enabled(app)?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("enableAutoRun", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            enable_auto_run(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("disableAutoRun", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            disable_auto_run()?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("checkUpdate", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(tauri::async_runtime::block_on(
            check_update_manifest(app)
        )?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("downloadAndInstallUpdate", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let version = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| String::from("缺少更新版本号"))?;
            tauri::async_runtime::block_on(download_and_install_update(app, state, version))?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("cancelUpdate", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            cancel_update_download(state)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getUserAgent", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(format!(
            "RouteX-Tauri/{}",
            app.package_info().version
        ))) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("openConfigDir", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let runtime_work_dir = {
                let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
                runtime.work_dir.clone()
            };
            let path = match runtime_work_dir {
                Some(path) => path,
                None => {
                    let (_, work_dir, _, _) = resolve_current_runtime_dirs(app)?;
                    work_dir
                }
            };
            open_path_in_shell(&path)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getGistUrl", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(get_gist_url_value(app)?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("copyEnv", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let shell_type = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "copyEnv requires shell type".to_string())?;
            let command = build_proxy_env_command(app, shell_type)?;
            copy_text_to_clipboard(&command)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("createHeapSnapshot", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(create_heap_snapshot(app, state)?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("importThemes", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let files = serde_json::from_value::<Vec<String>>(
                args.first().cloned().unwrap_or_else(|| json!([])),
            )
            .map_err(|e| e.to_string())?;
            import_theme_files(app, &files)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getFilePath", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let extensions = serde_json::from_value::<Vec<String>>(
                args.first().cloned().unwrap_or_else(|| json!([])),
            )
            .map_err(|e| e.to_string())?;
            let extensions = normalize_dialog_extensions(&extensions);
            Ok(json!(pick_open_file_paths_native(&extensions)?))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("saveFile", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let content = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "saveFile requires content".to_string())?;
            let default_name = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "saveFile requires default name".to_string())?;
            let ext = args
                .get(2)
                .and_then(Value::as_str)
                .ok_or_else(|| "saveFile requires extension".to_string())?;
            Ok(json!(save_text_file_with_dialog(
                content,
                default_name,
                ext
            )?))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("resetAppConfig", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            stop_core_process(app, state)?;
            let root = app_storage_root(app)?;
            if root.exists() {
                let _ = fs::remove_dir_all(root);
            }
            sync_shell_surfaces(app)?;
            emit_ipc_event(app, "appConfigUpdated", Value::Null);
            emit_ipc_event(app, "controledMihomoConfigUpdated", Value::Null);
            emit_ipc_event(app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(app, "groupsUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("manualGrantCorePermition", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let cores = serde_json::from_value::<Option<Vec<String>>>(
                args.first().cloned().unwrap_or(Value::Null),
            )
            .map_err(|e| e.to_string())?;
            manual_grant_core_permission(app, cores)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("checkCorePermission", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         check_core_permission_value(app) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("checkElevateTask", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(check_elevate_task())) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("deleteElevateTask", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            delete_elevate_task()?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("revokeCorePermission", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let cores = serde_json::from_value::<Option<Vec<String>>>(
                args.first().cloned().unwrap_or(Value::Null),
            )
            .map_err(|e| e.to_string())?;
            revoke_core_permission(app, cores)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("serviceStatus", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         service_status_value(app) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("testServiceConnection", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(test_service_connection_value(app))) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("initService", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            init_service(app, args.first().cloned())?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("installService", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            install_service(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("uninstallService", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            uninstall_service(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("startService", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            start_service(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("restartService", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            restart_service(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("stopService", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            stop_service(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("findSystemMihomo", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(find_system_mihomo_paths())) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getImageDataURL", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let url = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getImageDataURL requires url".to_string())?;
            fetch_image_data_url(url).map(|value| json!(value))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getIconDataURL", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let app_path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getIconDataURL requires path".to_string())?;
            Ok(json!(resolve_icon_data_url(app_path)))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getIconDataURLs", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let app_paths = serde_json::from_value::<Vec<String>>(
                args.first().cloned().unwrap_or_else(|| json!([])),
            )
            .map_err(|e| e.to_string())?;
            Ok(json!(resolve_icon_data_urls(&app_paths)))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getInterfaces", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(get_interfaces_value()) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getTrafficStats", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(read_traffic_stats_store(app)?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("recordTrafficSample", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let sample = serde_json::from_value::<TrafficSampleInput>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            Ok(json!(record_traffic_sample(app, sample)?))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("clearTrafficStats", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            clear_traffic_stats_store(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("startNetworkHealthMonitor", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            start_network_health_monitor(app, state)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("stopNetworkHealthMonitor", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            stop_network_health_monitor(state)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getNetworkHealthStats", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         get_network_health_stats_value(state) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getAppUptime", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(get_app_uptime_seconds())) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("webdavBackup", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(webdav_backup(app)?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("listWebdavBackups", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(list_webdav_backup_names(&read_webdav_config(app)?)?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("webdavRestore", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let filename = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "webdavRestore requires filename".to_string())?;
            webdav_restore(app, filename)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("webdavDelete", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let filename = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "webdavDelete requires filename".to_string())?;
            webdav_delete(app, filename)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("openUWPTool", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            open_uwp_tool(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
}
