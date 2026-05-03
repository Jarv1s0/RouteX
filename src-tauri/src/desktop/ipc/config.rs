fn handle_config_invoke(app: &tauri::AppHandle, state: &State<'_, CoreState>, channel: &str, args: &[Value]) -> Result<Option<Value>, String> {
    let result: Result<Value, String> = match channel {
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
        _ => return Ok(None),
    };
    Ok(Some(result?))
}
