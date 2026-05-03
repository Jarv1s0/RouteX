fn handle_system_invoke(app: &tauri::AppHandle, state: &State<'_, CoreState>, channel: &str, args: &[Value]) -> Result<Option<Value>, String> {
    let result: Result<Value, String> = match channel {
        "getVersion" => Ok(json!(app.package_info().version.to_string())),
        "platform" => Ok(json!(platform_name())),
        "checkAutoRun" => Ok(json!(check_auto_run_enabled(&app)?)),
        "enableAutoRun" => {
            enable_auto_run(&app)?;
            Ok(Value::Null)
        }
        "disableAutoRun" => {
            disable_auto_run()?;
            Ok(Value::Null)
        }
        "checkUpdate" => Ok(json!(tauri::async_runtime::block_on(
            check_update_manifest(&app)
        )?)),
        "downloadAndInstallUpdate" => {
            let version = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| String::from("缺少更新版本号"))?;
            tauri::async_runtime::block_on(download_and_install_update(&app, &state, version))?;
            Ok(Value::Null)
        }
        "cancelUpdate" => {
            cancel_update_download(&state)?;
            Ok(Value::Null)
        }
        "getUserAgent" => Ok(json!(format!(
            "RouteX-Tauri/{}",
            app.package_info().version
        ))),
        "openConfigDir" => {
            let runtime_work_dir = {
                let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
                runtime.work_dir.clone()
            };
            let path = match runtime_work_dir {
                Some(path) => path,
                None => {
                    let (_, work_dir, _, _) = resolve_current_runtime_dirs(&app)?;
                    work_dir
                }
            };
            open_path_in_shell(&path)?;
            Ok(Value::Null)
        }
        "getGistUrl" => Ok(json!(get_gist_url_value(&app)?)),
        "copyEnv" => {
            let shell_type = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "copyEnv requires shell type".to_string())?;
            let command = build_proxy_env_command(&app, shell_type)?;
            copy_text_to_clipboard(&command)?;
            Ok(Value::Null)
        }
        "createHeapSnapshot" => Ok(json!(create_heap_snapshot(&app, &state)?)),
        "importThemes" => {
            let files = serde_json::from_value::<Vec<String>>(
                args.first().cloned().unwrap_or_else(|| json!([])),
            )
            .map_err(|e| e.to_string())?;
            import_theme_files(&app, &files)?;
            Ok(Value::Null)
        }
        "getFilePath" => {
            let extensions = serde_json::from_value::<Vec<String>>(
                args.first().cloned().unwrap_or_else(|| json!([])),
            )
            .map_err(|e| e.to_string())?;
            let extensions = normalize_dialog_extensions(&extensions);
            Ok(json!(pick_open_file_paths_native(&extensions)?))
        }
        "saveFile" => {
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
        }
        "resetAppConfig" => {
            stop_core_process(&app, &state)?;
            let root = app_storage_root(&app)?;
            if root.exists() {
                let _ = fs::remove_dir_all(root);
            }
            sync_shell_surfaces(&app)?;
            emit_ipc_event(&app, "appConfigUpdated", Value::Null);
            emit_ipc_event(&app, "controledMihomoConfigUpdated", Value::Null);
            emit_ipc_event(&app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(&app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(&app, "groupsUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "manualGrantCorePermition" => {
            let cores = serde_json::from_value::<Option<Vec<String>>>(
                args.first().cloned().unwrap_or(Value::Null),
            )
            .map_err(|e| e.to_string())?;
            manual_grant_core_permission(&app, cores)?;
            Ok(Value::Null)
        }
        "checkCorePermission" => Ok(check_core_permission_value(&app)?),
        "checkElevateTask" => Ok(json!(check_elevate_task())),
        "deleteElevateTask" => {
            delete_elevate_task()?;
            Ok(Value::Null)
        }
        "revokeCorePermission" => {
            let cores = serde_json::from_value::<Option<Vec<String>>>(
                args.first().cloned().unwrap_or(Value::Null),
            )
            .map_err(|e| e.to_string())?;
            revoke_core_permission(&app, cores)?;
            Ok(Value::Null)
        }
        "serviceStatus" => service_status_value(&app),
        "testServiceConnection" => Ok(json!(test_service_connection_value(&app))),
        "initService" => {
            init_service(&app, args.first().cloned())?;
            Ok(Value::Null)
        }
        "installService" => {
            install_service(&app)?;
            Ok(Value::Null)
        }
        "uninstallService" => {
            uninstall_service(&app)?;
            Ok(Value::Null)
        }
        "startService" => {
            start_service(&app)?;
            Ok(Value::Null)
        }
        "restartService" => {
            restart_service(&app)?;
            Ok(Value::Null)
        }
        "stopService" => {
            stop_service(&app)?;
            Ok(Value::Null)
        }
        "findSystemMihomo" => Ok(json!(find_system_mihomo_paths())),
        "getImageDataURL" => {
            let url = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getImageDataURL requires url".to_string())?;
            match fetch_image_data_url(url) {
                Ok(value) => Ok(json!(value)),
                Err(_) => Ok(json!(default_icon_data_url())),
            }
        }
        "getIconDataURL" => {
            let app_path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getIconDataURL requires path".to_string())?;
            Ok(json!(resolve_icon_data_url(app_path)))
        }
        "getIconDataURLs" => {
            let app_paths = serde_json::from_value::<Vec<String>>(
                args.first().cloned().unwrap_or_else(|| json!([])),
            )
            .map_err(|e| e.to_string())?;
            Ok(json!(resolve_icon_data_urls(&app_paths)))
        }
        "getInterfaces" => Ok(get_interfaces_value()),
        "getTrafficStats" => Ok(json!(read_traffic_stats_store(&app)?)),
        "getProviderStats" => Ok(json!(get_provider_stats_value(&app)?)),
        "recordTrafficSample" => {
            let sample = serde_json::from_value::<TrafficSampleInput>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            Ok(json!(record_traffic_sample(&app, sample)?))
        }
        "clearTrafficStats" => {
            clear_traffic_stats_store(&app)?;
            Ok(Value::Null)
        }
        "clearProviderStats" => {
            clear_provider_stats_value(&app)?;
            Ok(Value::Null)
        }
        "getProcessTrafficRanking" => {
            let _ranking_type = args.first().and_then(Value::as_str).unwrap_or("session");
            let sort_by = args.get(1).and_then(Value::as_str).unwrap_or("download");
            get_process_traffic_ranking_value(&state, sort_by)
        }
        "startNetworkHealthMonitor" => {
            start_network_health_monitor(&app, &state)?;
            Ok(Value::Null)
        }
        "stopNetworkHealthMonitor" => {
            stop_network_health_monitor(&state)?;
            Ok(Value::Null)
        }
        "getNetworkHealthStats" => Ok(get_network_health_stats_value(&state)?),
        "getAppUptime" => Ok(json!(get_app_uptime_seconds())),
        "getAppMemory" => Ok(json!(get_app_memory_value())),
        "testDNSLatency" => {
            let domain = args.first().and_then(Value::as_str).unwrap_or("google.com");
            Ok(json!(test_dns_latency(domain)))
        }
        "webdavBackup" => Ok(json!(webdav_backup(&app)?)),
        "listWebdavBackups" => Ok(json!(list_webdav_backup_names(&read_webdav_config(&app)?)?)),
        "webdavRestore" => {
            let filename = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "webdavRestore requires filename".to_string())?;
            webdav_restore(&app, filename)?;
            Ok(Value::Null)
        }
        "webdavDelete" => {
            let filename = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "webdavDelete requires filename".to_string())?;
            webdav_delete(&app, filename)?;
            Ok(Value::Null)
        }
        "openUWPTool" => {
            open_uwp_tool(&app)?;
            Ok(Value::Null)
        }
        _ => return Ok(None),
    };
    Ok(Some(result?))
}
