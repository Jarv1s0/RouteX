use super::*;

#[tauri::command]
pub(super) async fn desktop_check_update(app: tauri::AppHandle) -> Result<Value, String> {
    let started_at = Instant::now();
    let app_for_task = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || check_update_manifest(&app_for_task))
        .await
        .map_err(|e| e.to_string())
        .and_then(|result| result.map(|value| json!(value)));

    let elapsed_ms = started_at.elapsed().as_millis();
    match &result {
        Ok(_) => eprintln!("[desktop.invoke] checkUpdate {}ms", elapsed_ms),
        Err(error) if !should_suppress_update_check_error_log(error) => eprintln!(
            "[desktop.invoke] checkUpdate failed in {}ms: {}",
            elapsed_ms, error
        ),
        Err(_) => {}
    }

    result
}

fn should_suppress_update_check_error_log(error: &str) -> bool {
    error.contains("error sending request for url")
}

fn should_suppress_desktop_invoke_error_log(channel: &str, error: &str) -> bool {
    matches!(channel, "mihomoProxyDelay" | "mihomoGroupDelay")
        && (error.contains("Mihomo API request failed: 503 Service Unavailable")
            || error.contains("Mihomo API request failed: 504 Gateway Timeout"))
}

#[tauri::command]
pub(super) async fn desktop_get_icon_data_urls(app_paths: Vec<String>) -> Result<Value, String> {
    let started_at = Instant::now();
    let paths = app_paths;
    let result =
        tauri::async_runtime::spawn_blocking(move || Ok(json!(resolve_icon_data_urls(&paths))))
            .await
            .map_err(|e| e.to_string())?;

    let elapsed_ms = started_at.elapsed().as_millis();
    if elapsed_ms >= 80 {
        match &result {
            Ok(_) => eprintln!("[desktop.invoke] getIconDataURLs {}ms", elapsed_ms),
            Err(error) => eprintln!(
                "[desktop.invoke] getIconDataURLs failed in {}ms: {}",
                elapsed_ms, error
            ),
        }
    }

    result
}

fn desktop_invoke_sync(
    app: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
    state: State<'_, CoreState>,
    channel: String,
    args: Vec<Value>,
) -> Result<Value, String> {
    let started_at = Instant::now();
    let result = match channel.as_str() {
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
        "checkUpdate" => Ok(json!(check_update_manifest(&app)?)),
        "downloadAndInstallUpdate" => {
            let version = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| String::from("缺少更新版本号"))?;
            download_and_install_update(&app, &state, version)?;
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
        "getAppConfig" => Ok(read_app_config_store(&app)?),
        "getChainsConfig" => Ok(json!(read_chains_config(&app)?)),
        "getAllChains" => Ok(json!(read_chains_config(&app)?.items)),
        "patchAppConfig" => {
            let patch = args.first().unwrap_or(&Value::Null);
            patch_app_config_store(&app, patch)?;
            if patch_requires_shell_surface_sync(patch) {
                sync_shell_surfaces(&app)?;
            }
            if patch.get("pauseSSID").is_some() {
                refresh_ssid_check(&app)?;
            }
            if patch.get("autoLightweight").is_some()
                || patch.get("autoLightweightDelay").is_some()
                || patch.get("autoLightweightMode").is_some()
                || patch.get("showFloatingWindow").is_some()
            {
                let _ = refresh_lightweight_mode(&app);
            }
            emit_ipc_event(&app, "appConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "addChainItem" => {
            let item = serde_json::from_value::<ChainItemInput>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            let chain = add_chain_item_store(&app, item)?;
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(json!(chain))
        }
        "updateChainItem" => {
            let item = serde_json::from_value::<ChainItemData>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            update_chain_item_store(&app, item)?;
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "removeChainItem" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "removeChainItem requires chain id".to_string())?;
            remove_chain_item_store(&app, id)?;
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getControledMihomoConfig" => Ok(read_controlled_config_store(&app)?),
        "patchControledMihomoConfig" => {
            patch_controlled_config_store(&app, args.first().unwrap_or(&Value::Null))?;
            update_tray_icon_for_state(&app)?;
            emit_ipc_event(&app, "controledMihomoConfigUpdated", Value::Null);
            emit_ipc_event(&app, "groupsUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getProfileConfig" => Ok(json!(read_profile_config(&app)?)),
        "setProfileConfig" => {
            let config = serde_json::from_value::<ProfileConfigData>(
                args.first()
                    .cloned()
                    .unwrap_or_else(|| json!({ "items": [] })),
            )
            .map_err(|e| e.to_string())?;
            write_profile_config(&app, &config)?;
            emit_ipc_event(&app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getCurrentProfileItem" => Ok(json!(current_profile_item(&app)?)),
        "getProfileItem" => {
            let id = args.first().and_then(Value::as_str);
            let config = read_profile_config(&app)?;
            Ok(json!(get_profile_item_from_config(&config, id)
                .unwrap_or_else(default_empty_profile_item)))
        }
        "changeCurrentProfile" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "changeCurrentProfile requires profile id".to_string())?;
            change_current_profile_store(&app, id)?;
            emit_ipc_event(&app, "profileConfigUpdated", Value::Null);
            restart_core_and_emit(&app, &state)?;
            Ok(Value::Null)
        }
        "setActiveProfiles" => {
            let ids = args
                .first()
                .and_then(Value::as_array)
                .map(|values| {
                    values
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let current = args.get(1).and_then(Value::as_str);
            set_active_profiles_store(&app, &ids, current)?;
            emit_ipc_event(&app, "profileConfigUpdated", Value::Null);
            restart_core_and_emit(&app, &state)?;
            Ok(Value::Null)
        }
        "addProfileItem" => {
            let item = serde_json::from_value::<ProfileItemInput>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            add_or_replace_profile_item(&app, item)?;
            emit_ipc_event(&app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "updateProfileItem" => {
            let item = serde_json::from_value::<ProfileItemData>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            update_profile_item_store(&app, item)?;
            emit_ipc_event(&app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "removeProfileItem" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "removeProfileItem requires profile id".to_string())?;
            remove_profile_item_store(&app, id)?;
            emit_ipc_event(&app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getProfileStr" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getProfileStr requires profile id".to_string())?;
            Ok(json!(read_profile_text(&app, id)?))
        }
        "setProfileStr" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "setProfileStr requires profile id".to_string())?;
            let content = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "setProfileStr requires content".to_string())?;
            write_profile_text(&app, id, content)?;
            Ok(Value::Null)
        }
        "getRawProfileStr" => {
            let current = current_profile_item(&app)?;
            Ok(json!(read_profile_text(&app, &current.id)?))
        }
        "getCurrentProfileStr" => {
            let current = current_profile_item(&app)?;
            Ok(json!(read_profile_text(&app, &current.id)?))
        }
        "getOverrideConfig" => Ok(json!(read_override_config(&app)?)),
        "setOverrideConfig" => {
            let config = serde_json::from_value::<OverrideConfigData>(
                args.first()
                    .cloned()
                    .unwrap_or_else(|| json!({ "items": [] })),
            )
            .map_err(|e| e.to_string())?;
            write_override_config(&app, &config)?;
            emit_ipc_event(&app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getOverrideItem" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getOverrideItem requires override id".to_string())?;
            let config = read_override_config(&app)?;
            Ok(json!(config.items.into_iter().find(|item| item.id == id)))
        }
        "addOverrideItem" => {
            let item = serde_json::from_value::<OverrideItemInput>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            add_or_replace_override_item(&app, item)?;
            emit_ipc_event(&app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "updateOverrideItem" => {
            let item = serde_json::from_value::<OverrideItemData>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            update_override_item_store(&app, item)?;
            emit_ipc_event(&app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "removeOverrideItem" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "removeOverrideItem requires override id".to_string())?;
            remove_override_item_store(&app, id)?;
            let _ = remove_override_reference_store(&app, id)?;
            restart_core_and_emit(&app, &state)?;
            emit_ipc_event(&app, "overrideConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getOverride" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getOverride requires override id".to_string())?;
            let ext = args.get(1).and_then(Value::as_str).unwrap_or("yaml");
            Ok(json!(read_override_text(&app, id, ext)?))
        }
        "canRollbackOverride" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "canRollbackOverride requires override id".to_string())?;
            let ext = args.get(1).and_then(Value::as_str).unwrap_or("yaml");
            let path = override_rollback_path(&app, id, ext)?;
            Ok(json!(path.exists()))
        }
        "rollbackOverride" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "rollbackOverride requires override id".to_string())?;
            let ext = args.get(1).and_then(Value::as_str).unwrap_or("yaml");
            rollback_override_text(&app, id, ext)?;
            restart_core_and_emit(&app, &state)?;
            emit_ipc_event(&app, "overrideConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "setOverride" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "setOverride requires override id".to_string())?;
            let ext = args.get(1).and_then(Value::as_str).unwrap_or("yaml");
            let content = args
                .get(2)
                .and_then(Value::as_str)
                .ok_or_else(|| "setOverride requires content".to_string())?;
            write_override_text(&app, id, ext, content)?;
            emit_ipc_event(&app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getQuickRulesConfig" => Ok(json!(read_quick_rules_config(&app)?)),
        "setQuickRulesConfig" => {
            let config = serde_json::from_value::<QuickRulesConfigData>(
                args.first()
                    .cloned()
                    .unwrap_or_else(|| json!({ "version": 1, "profiles": {} })),
            )
            .map_err(|e| e.to_string())?;
            write_quick_rules_config(&app, &config)?;
            restart_core_and_emit(&app, &state)?;
            emit_ipc_event(&app, "quickRulesConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getQuickRules" => {
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            Ok(json!(read_quick_rules(&app, profile_id)?))
        }
        "addQuickRule" => {
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            let input = serde_json::from_value::<QuickRuleInput>(
                args.get(1).cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            let rule = add_quick_rule_store(&app, profile_id, input)?;
            restart_core_and_emit(&app, &state)?;
            emit_ipc_event(&app, "quickRulesConfigUpdated", Value::Null);
            Ok(json!(rule))
        }
        "updateQuickRule" => {
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            let rule_id = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "updateQuickRule requires rule id".to_string())?;
            update_quick_rule_store(
                &app,
                profile_id,
                rule_id,
                args.get(2).cloned().unwrap_or_else(|| json!({})),
            )?;
            restart_core_and_emit(&app, &state)?;
            emit_ipc_event(&app, "quickRulesConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "removeQuickRule" => {
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            let rule_id = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "removeQuickRule requires rule id".to_string())?;
            remove_quick_rule_store(&app, profile_id, rule_id)?;
            restart_core_and_emit(&app, &state)?;
            emit_ipc_event(&app, "quickRulesConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "setQuickRulesEnabled" => {
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            let enabled = args.get(1).and_then(Value::as_bool).unwrap_or(true);
            set_quick_rules_enabled_store(&app, profile_id, enabled)?;
            restart_core_and_emit(&app, &state)?;
            emit_ipc_event(&app, "quickRulesConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "reorderQuickRules" => {
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            let rule_ids = args
                .get(1)
                .and_then(Value::as_array)
                .map(|values| {
                    values
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            reorder_quick_rules_store(&app, profile_id, &rule_ids)?;
            restart_core_and_emit(&app, &state)?;
            emit_ipc_event(&app, "quickRulesConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "clearQuickRules" => {
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            clear_quick_rules_store(&app, profile_id)?;
            restart_core_and_emit(&app, &state)?;
            emit_ipc_event(&app, "quickRulesConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getOverrideProfileStr" => Ok(json!(current_override_profile_text(&app)?)),
        "getFileStr" => {
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getFileStr requires path".to_string())?;
            Ok(json!(read_runtime_text(&app, &state, path)?))
        }
        "setFileStr" => {
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "setFileStr requires path".to_string())?;
            let content = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "setFileStr requires content".to_string())?;
            write_runtime_text(&app, &state, path, content)?;
            Ok(Value::Null)
        }
        "readTextFile" => {
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "readTextFile requires path".to_string())?;
            Ok(json!(read_runtime_text(&app, &state, path)?))
        }
        "convertMrsRuleset" => {
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "convertMrsRuleset requires path".to_string())?;
            let behavior = args.get(1).and_then(Value::as_str).unwrap_or("domain");
            Ok(json!(convert_mrs_ruleset(&app, &state, path, behavior)?))
        }
        "openFile" => {
            let file_type = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "openFile requires file type".to_string())?;
            let id = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "openFile requires id".to_string())?;
            let ext = args.get(2).and_then(Value::as_str).unwrap_or("yaml");
            let path = if file_type == "profile" {
                profile_file_path(&app, id)?
            } else {
                override_file_path(&app, id, ext)?
            };
            open_path_in_shell(&path)?;
            Ok(Value::Null)
        }
        "resolveThemes" => Ok(json!(resolve_theme_entries(&app)?)),
        "fetchThemes" => {
            fetch_theme_archive(&app)?;
            Ok(Value::Null)
        }
        "readTheme" => {
            let theme = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "readTheme requires theme name".to_string())?;
            Ok(json!(read_theme_text(&app, theme)?))
        }
        "getAppName" => {
            let app_path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getAppName requires app path".to_string())?;
            Ok(json!(get_app_name_value(app_path)))
        }
        "writeTheme" => {
            let theme = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "writeTheme requires theme name".to_string())?;
            let css = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "writeTheme requires css content".to_string())?;
            write_theme_text(&app, theme, css)?;
            Ok(Value::Null)
        }
        "getControllerUrl" => Ok(json!(current_controller_url(&state)?)),
        "getRuntimeConfig" => Ok(current_runtime_value_for_renderer(&app, &state)?),
        "getRuntimeConfigStr" => {
            let value = current_runtime_value_for_renderer(&app, &state)?;
            Ok(json!(
                serde_yaml::to_string(&value).map_err(|e| e.to_string())?
            ))
        }
        "testConnectivity" => {
            let url = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "testConnectivity requires url".to_string())?;
            let timeout = args.get(1).and_then(Value::as_u64).unwrap_or(5_000);
            Ok(test_connectivity_value(url, timeout))
        }
        "testRuleMatch" => {
            let domain = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "testRuleMatch requires domain".to_string())?;
            test_rule_match_value(&app, &state, domain)
        }
        "alert" => {
            let message =
                args.first()
                    .map(|value| match value {
                        Value::String(text) => text.clone(),
                        other => serde_json::to_string_pretty(other)
                            .unwrap_or_else(|_| other.to_string()),
                    })
                    .unwrap_or_default();
            emit_ipc_event(
                &app,
                "show-dialog-modal",
                json!(["warning", "提示", message]),
            );
            Ok(Value::Null)
        }
        "applyTheme" => Ok(Value::Null),
        "fetchIpInfo" => Ok(fetch_ip_info_current()?),
        "fetchIpInfoQuery" => {
            let query = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "fetchIpInfoQuery requires query".to_string())?;
            Ok(fetch_ip_info_query(query)?)
        }
        "fetchBatchIpInfo" => {
            let queries = serde_json::from_value::<Vec<IpInfoQueryInput>>(
                args.first().cloned().unwrap_or_else(|| json!([])),
            )
            .map_err(|e| e.to_string())?;
            Ok(fetch_batch_ip_info(&queries)?)
        }
        "httpGet" => {
            let url = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "httpGet requires url".to_string())?;
            let timeout = args.get(1).and_then(Value::as_u64).unwrap_or(5_000);
            Ok(http_get_value(url, timeout)?)
        }
        "checkStreamingUnlock" => {
            let service = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "checkStreamingUnlock requires service".to_string())?;
            Ok(check_streaming_unlock(service)?)
        }
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
        "ensureMihomoCoreAvailable" => {
            let core = args.first().and_then(Value::as_str).unwrap_or("mihomo");
            let path = resolve_core_binary(&app, core)?;
            Ok(json!(path.to_string_lossy().to_string()))
        }
        "mihomoVersion" => core_request(&state, reqwest::Method::GET, "/version", None, None),
        "mihomoConfig" => core_request(&state, reqwest::Method::GET, "/configs", None, None),
        "mihomoConnections" => {
            core_request(&state, reqwest::Method::GET, "/connections", None, None)
        }
        "mihomoRules" => core_request(&state, reqwest::Method::GET, "/rules", None, None),
        "mihomoProxies" => core_request(&state, reqwest::Method::GET, "/proxies", None, None),
        "mihomoGroups" => {
            let proxies = core_request(&state, reqwest::Method::GET, "/proxies", None, None)?;
            let runtime = current_runtime_value(&app, &state)?;
            Ok(build_mihomo_groups_value(&proxies, &runtime))
        }
        "mihomoProxyProviders" => core_request(
            &state,
            reqwest::Method::GET,
            "/providers/proxies",
            None,
            None,
        ),
        "mihomoRuleProviders" => {
            core_request(&state, reqwest::Method::GET, "/providers/rules", None, None)
        }
        "patchMihomoConfig" => core_request(
            &state,
            reqwest::Method::PATCH,
            "/configs",
            None,
            Some(args.first().cloned().unwrap_or(Value::Null)),
        )
        .map(|_| {
            emit_ipc_event(&app, "groupsUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Value::Null
        }),
        "mihomoChangeProxy" => {
            let group = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoChangeProxy requires group".to_string())?;
            let proxy = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoChangeProxy requires proxy".to_string())?;
            core_request(
                &state,
                reqwest::Method::PUT,
                &format!("/proxies/{}", urlencoding::encode(group)),
                None,
                Some(json!({ "name": proxy })),
            )
            .map(|value| {
                emit_ipc_event(&app, "groupsUpdated", Value::Null);
                value
            })
        }
        "mihomoUnfixedProxy" => {
            let group = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoUnfixedProxy requires group".to_string())?;
            core_request(
                &state,
                reqwest::Method::DELETE,
                &format!("/proxies/{}", urlencoding::encode(group)),
                None,
                None,
            )
            .map(|value| {
                emit_ipc_event(&app, "groupsUpdated", Value::Null);
                value
            })
        }
        "mihomoCloseConnection" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoCloseConnection requires connection id".to_string())?;
            core_request(
                &state,
                reqwest::Method::DELETE,
                &format!("/connections/{}", urlencoding::encode(id)),
                None,
                None,
            )
            .map(|_| Value::Null)
        }
        "mihomoCloseAllConnections" => {
            if let Some(name) = args.first().and_then(Value::as_str) {
                close_connections_by_group(&state, name)?;
                Ok(Value::Null)
            } else {
                core_request(&state, reqwest::Method::DELETE, "/connections", None, None)
                    .map(|_| Value::Null)
            }
        }
        "mihomoProxyDelay" => {
            let proxy = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoProxyDelay requires proxy".to_string())?;
            let (url, timeout) =
                resolve_delay_test_options(&app, args.get(1).and_then(Value::as_str))?;
            core_request(
                &state,
                reqwest::Method::GET,
                &format!("/proxies/{}/delay", urlencoding::encode(proxy)),
                Some(&[("url", url), ("timeout", timeout)]),
                None,
            )
        }
        "mihomoGroupDelay" => {
            let group = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoGroupDelay requires group".to_string())?;
            let (url, timeout) =
                resolve_delay_test_options(&app, args.get(1).and_then(Value::as_str))?;
            core_request(
                &state,
                reqwest::Method::GET,
                &format!("/group/{}/delay", urlencoding::encode(group)),
                Some(&[("url", url), ("timeout", timeout)]),
                None,
            )
        }
        "mihomoDnsQuery" => {
            let name = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoDnsQuery requires name".to_string())?
                .to_string();
            let record_type = args
                .get(1)
                .and_then(Value::as_str)
                .unwrap_or("A")
                .to_string();
            core_request(
                &state,
                reqwest::Method::GET,
                "/dns/query",
                Some(&[("name", name), ("type", record_type)]),
                None,
            )
        }
        "mihomoToggleRuleDisabled" => core_request(
            &state,
            reqwest::Method::PATCH,
            "/rules/disable",
            None,
            Some(args.first().cloned().unwrap_or_else(|| json!({}))),
        )
        .map(|_| {
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Value::Null
        }),
        "mihomoUpdateProxyProviders" => {
            let name = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoUpdateProxyProviders requires name".to_string())?;
            core_request(
                &state,
                reqwest::Method::PUT,
                &format!("/providers/proxies/{}", urlencoding::encode(name)),
                None,
                None,
            )
            .map(|_| {
                emit_ipc_event(&app, "groupsUpdated", Value::Null);
                Value::Null
            })
        }
        "mihomoUpdateRuleProviders" => {
            let name = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoUpdateRuleProviders requires name".to_string())?;
            core_request(
                &state,
                reqwest::Method::PUT,
                &format!("/providers/rules/{}", urlencoding::encode(name)),
                None,
                None,
            )
            .map(|_| {
                emit_ipc_event(&app, "rulesUpdated", Value::Null);
                Value::Null
            })
        }
        "mihomoUpgrade" => {
            core_request(&state, reqwest::Method::POST, "/upgrade", None, None).map(|_| Value::Null)
        }
        "mihomoUpgradeGeo" => {
            core_request(&state, reqwest::Method::POST, "/upgrade/geo", None, None)
                .map(|_| Value::Null)
        }
        "mihomoUpgradeUI" => core_request(&state, reqwest::Method::POST, "/upgrade/ui", None, None)
            .map(|_| Value::Null),
        "checkMihomoLatestVersion" => {
            let is_alpha = args.first().and_then(Value::as_bool).unwrap_or(false);
            let url = if is_alpha {
                "https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt"
            } else {
                "https://github.com/MetaCubeX/mihomo/releases/latest/download/version.txt"
            };
            match fetch_text(url, 10) {
                Ok(text) => Ok(json!(text.trim())),
                Err(_) => Ok(Value::Null),
            }
        }
        "restartMihomoConnections" => {
            if current_controller_url(&state)?.is_some() {
                start_core_events_monitor(&app, &state)?;
            } else {
                stop_core_events_monitor(&state)?;
            }
            Ok(Value::Null)
        }
        "restartCore" => restart_core_process(&app, &state, args.first()).map(|value| {
            emit_ipc_event(&app, "core-started", value.clone());
            emit_ipc_event(&app, "groupsUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            value
        }),
        "setNativeTheme" => {
            let theme = args.first().and_then(Value::as_str);
            apply_window_theme(&window, theme);
            Ok(Value::Null)
        }
        "relaunchApp" => {
            relaunch_current_app(&app, &state)?;
            Ok(Value::Null)
        }
        unsupported => Err(format!("Unsupported Tauri desktop channel: {unsupported}")),
    };

    let elapsed_ms = started_at.elapsed().as_millis();
    if elapsed_ms >= 80
        || channel == "getRuntimeConfig"
        || channel == "getRuntimeConfigStr"
        || channel == "mihomoRules"
        || channel == "mihomoRuleProviders"
        || channel == "mihomoProxyProviders"
    {
        match &result {
            Ok(_) => eprintln!("[desktop.invoke] {} {}ms", channel, elapsed_ms),
            Err(error) if !should_suppress_desktop_invoke_error_log(&channel, error) => eprintln!(
                "[desktop.invoke] {} failed in {}ms: {}",
                channel, elapsed_ms, error
            ),
            Err(_) => {}
        }
    }

    result
}

#[tauri::command]
pub(super) async fn desktop_invoke(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    channel: String,
    args: Vec<Value>,
) -> Result<Value, String> {
    let app_for_task = app.clone();
    let window_for_task = window.clone();
    let channel_for_task = channel.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let state = app_for_task.state::<CoreState>();
        desktop_invoke_sync(
            &app_for_task,
            &window_for_task,
            state,
            channel_for_task,
            args,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}
