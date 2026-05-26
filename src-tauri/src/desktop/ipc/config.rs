pub(crate) fn register_config_handlers(map: &mut std::collections::HashMap<&'static str, crate::desktop::ipc::IpcHandler>) {
    map.insert("getAppConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         read_app_config_store(app) 
    });
    map.insert("getChainsConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(read_chains_config(app)?)) 
    });
    map.insert("getAllChains", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(read_chains_config(app)?.items)) 
    });
    map.insert("patchAppConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let patch = args.first().unwrap_or(&Value::Null);
            patch_app_config_store(app, patch)?;
            if patch_requires_shell_surface_sync(patch) {
                sync_shell_surfaces(app)?;
            }
            if patch.get("pauseSSID").is_some() {
                refresh_ssid_check(app)?;
            }
            if patch.get("autoLightweight").is_some()
                || patch.get("autoLightweightDelay").is_some()
                || patch.get("autoLightweightMode").is_some()
                || patch.get("showFloatingWindow").is_some()
            {
                let _ = refresh_lightweight_mode(app);
            }
            emit_ipc_event(app, "appConfigUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("addChainItem", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let item = serde_json::from_value::<ChainItemInput>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            let chain = add_chain_item_store(app, item)?;
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Ok(json!(chain))
        
    });
    map.insert("updateChainItem", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let item = serde_json::from_value::<ChainItemData>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            update_chain_item_store(app, item)?;
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("removeChainItem", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "removeChainItem requires chain id".to_string())?;
            remove_chain_item_store(app, id)?;
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("getControledMihomoConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         read_controlled_config_store(app) 
    });
    map.insert("patchControledMihomoConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            patch_controlled_config_store(app, args.first().unwrap_or(&Value::Null))?;
            update_tray_icon_for_state(app)?;
            emit_ipc_event(app, "controledMihomoConfigUpdated", Value::Null);
            emit_ipc_event(app, "groupsUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("getProfileConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(read_profile_config(app)?)) 
    });
    map.insert("setProfileConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let config = serde_json::from_value::<ProfileConfigData>(
                args.first()
                    .cloned()
                    .unwrap_or_else(|| json!({ "items": [] })),
            )
            .map_err(|e| e.to_string())?;
            write_profile_config(app, &config)?;
            emit_ipc_event(app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("getCurrentProfileItem", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(current_profile_item(app)?)) 
    });
    map.insert("getProfileItem", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args.first().and_then(Value::as_str);
            let config = read_profile_config(app)?;
            Ok(json!(get_profile_item_from_config(&config, id)
                .unwrap_or_else(default_empty_profile_item)))
        
    });
    map.insert("changeCurrentProfile", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "changeCurrentProfile requires profile id".to_string())?;
            change_current_profile_store(app, id)?;
            emit_ipc_event(app, "profileConfigUpdated", Value::Null);
            restart_core_and_emit(app, state)?;
            Ok(Value::Null)
        
    });
    map.insert("setActiveProfiles", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
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
            set_active_profiles_store(app, &ids, current)?;
            emit_ipc_event(app, "profileConfigUpdated", Value::Null);
            restart_core_and_emit(app, state)?;
            Ok(Value::Null)
        
    });
    map.insert("addProfileItem", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let item = serde_json::from_value::<ProfileItemInput>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            add_or_replace_profile_item(app, item)?;
            emit_ipc_event(app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("updateProfileItem", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let item = serde_json::from_value::<ProfileItemData>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            update_profile_item_store(app, item)?;
            emit_ipc_event(app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("removeProfileItem", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "removeProfileItem requires profile id".to_string())?;
            let runtime_profile_affected = remove_profile_item_store(app, id)?;
            emit_ipc_event(app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            if runtime_profile_affected {
                restart_core_and_emit(app, state)?;
            }
            Ok(Value::Null)
        
    });
    map.insert("getProfileStr", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getProfileStr requires profile id".to_string())?;
            Ok(json!(read_profile_text(app, id)?))
        
    });
    map.insert("setProfileStr", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "setProfileStr requires profile id".to_string())?;
            let content = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "setProfileStr requires content".to_string())?;
            write_profile_text(app, id, content)?;
            Ok(Value::Null)
        
    });
    map.insert("getRawProfileStr", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let current = current_profile_item(app)?;
            Ok(json!(read_profile_text(app, &current.id)?))
        
    });
    map.insert("getCurrentProfileStr", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let current = current_profile_item(app)?;
            Ok(json!(read_profile_text(app, &current.id)?))
        
    });
    map.insert("getOverrideConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(read_override_config(app)?)) 
    });
    map.insert("setOverrideConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let config = serde_json::from_value::<OverrideConfigData>(
                args.first()
                    .cloned()
                    .unwrap_or_else(|| json!({ "items": [] })),
            )
            .map_err(|e| e.to_string())?;
            write_override_config(app, &config)?;
            emit_ipc_event(app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("getOverrideItem", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getOverrideItem requires override id".to_string())?;
            let config = read_override_config(app)?;
            Ok(json!(config.items.into_iter().find(|item| item.id == id)))
        
    });
    map.insert("addOverrideItem", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let item = serde_json::from_value::<OverrideItemInput>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            add_or_replace_override_item(app, item)?;
            emit_ipc_event(app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("updateOverrideItem", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let item = serde_json::from_value::<OverrideItemData>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            update_override_item_store(app, item)?;
            emit_ipc_event(app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("removeOverrideItem", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "removeOverrideItem requires override id".to_string())?;
            remove_override_item_store(app, id)?;
            let _ = remove_override_reference_store(app, id)?;
            restart_core_and_emit(app, state)?;
            emit_ipc_event(app, "overrideConfigUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("getOverride", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getOverride requires override id".to_string())?;
            let ext = args.get(1).and_then(Value::as_str).unwrap_or("yaml");
            Ok(json!(read_override_text(app, id, ext)?))
        
    });
    map.insert("canRollbackOverride", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "canRollbackOverride requires override id".to_string())?;
            let ext = args.get(1).and_then(Value::as_str).unwrap_or("yaml");
            let path = override_rollback_path(app, id, ext)?;
            Ok(json!(path.exists()))
        
    });
    map.insert("rollbackOverride", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "rollbackOverride requires override id".to_string())?;
            let ext = args.get(1).and_then(Value::as_str).unwrap_or("yaml");
            rollback_override_text(app, id, ext)?;
            restart_core_and_emit(app, state)?;
            emit_ipc_event(app, "overrideConfigUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("setOverride", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "setOverride requires override id".to_string())?;
            let ext = args.get(1).and_then(Value::as_str).unwrap_or("yaml");
            let content = args
                .get(2)
                .and_then(Value::as_str)
                .ok_or_else(|| "setOverride requires content".to_string())?;
            write_override_text(app, id, ext, content)?;
            emit_ipc_event(app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("getQuickRulesConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(read_quick_rules_config(app)?)) 
    });
    map.insert("setQuickRulesConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let config = serde_json::from_value::<QuickRulesConfigData>(
                args.first()
                    .cloned()
                    .unwrap_or_else(|| json!({ "version": 1, "profiles": {} })),
            )
            .map_err(|e| e.to_string())?;
            write_quick_rules_config(app, &config)?;
            restart_core_and_emit(app, state)?;
            emit_ipc_event(app, "quickRulesConfigUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("getQuickRules", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            Ok(json!(read_quick_rules(app, profile_id)?))
        
    });
    map.insert("addQuickRule", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            let input = serde_json::from_value::<QuickRuleInput>(
                args.get(1).cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            let rule = add_quick_rule_store(app, profile_id, input)?;
            restart_core_and_emit(app, state)?;
            emit_ipc_event(app, "quickRulesConfigUpdated", Value::Null);
            Ok(json!(rule))
        
    });
    map.insert("updateQuickRule", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            let rule_id = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "updateQuickRule requires rule id".to_string())?;
            update_quick_rule_store(
                app,
                profile_id,
                rule_id,
                args.get(2).cloned().unwrap_or_else(|| json!({})),
            )?;
            restart_core_and_emit(app, state)?;
            emit_ipc_event(app, "quickRulesConfigUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("removeQuickRule", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            let rule_id = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "removeQuickRule requires rule id".to_string())?;
            remove_quick_rule_store(app, profile_id, rule_id)?;
            restart_core_and_emit(app, state)?;
            emit_ipc_event(app, "quickRulesConfigUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("setQuickRulesEnabled", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            let enabled = args.get(1).and_then(Value::as_bool).unwrap_or(true);
            set_quick_rules_enabled_store(app, profile_id, enabled)?;
            restart_core_and_emit(app, state)?;
            emit_ipc_event(app, "quickRulesConfigUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("reorderQuickRules", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
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
            reorder_quick_rules_store(app, profile_id, &rule_ids)?;
            restart_core_and_emit(app, state)?;
            emit_ipc_event(app, "quickRulesConfigUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("clearQuickRules", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            clear_quick_rules_store(app, profile_id)?;
            restart_core_and_emit(app, state)?;
            emit_ipc_event(app, "quickRulesConfigUpdated", Value::Null);
            Ok(Value::Null)
        
    });
    map.insert("getOverrideProfileStr", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(current_override_profile_text(app)?)) 
    });
    map.insert("getFileStr", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getFileStr requires path".to_string())?;
            Ok(json!(read_runtime_text(app, state, path)?))
        
    });
    map.insert("setFileStr", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "setFileStr requires path".to_string())?;
            let content = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "setFileStr requires content".to_string())?;
            write_runtime_text(app, state, path, content)?;
            Ok(Value::Null)
        
    });
    map.insert("readTextFile", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "readTextFile requires path".to_string())?;
            Ok(json!(read_runtime_text(app, state, path)?))
        
    });
    map.insert("convertMrsRuleset", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "convertMrsRuleset requires path".to_string())?;
            let behavior = args.get(1).and_then(Value::as_str).unwrap_or("domain");
            Ok(json!(convert_mrs_ruleset(app, state, path, behavior)?))
        
    });
    map.insert("openFile", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
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
                profile_file_path(app, id)?
            } else {
                override_file_path(app, id, ext)?
            };
            open_path_in_shell(&path)?;
            Ok(Value::Null)
        
    });
    map.insert("resolveThemes", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(resolve_theme_entries(app)?)) 
    });
    map.insert("fetchThemes", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            fetch_theme_archive(app)?;
            Ok(Value::Null)
        
    });
    map.insert("readTheme", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let theme = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "readTheme requires theme name".to_string())?;
            Ok(json!(read_theme_text(app, theme)?))
        
    });
    map.insert("getAppName", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let app_path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getAppName requires app path".to_string())?;
            Ok(json!(get_app_name_value(app_path)))
        
    });
    map.insert("writeTheme", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let theme = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "writeTheme requires theme name".to_string())?;
            let css = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "writeTheme requires css content".to_string())?;
            write_theme_text(app, theme, css)?;
            Ok(Value::Null)
        
    });
    map.insert("getControllerUrl", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(current_controller_url(state)?)) 
    });
    map.insert("getRuntimeConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         current_runtime_value_for_renderer(app, state) 
    });
    map.insert("getRuntimeConfigStr", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let value = current_runtime_value_for_renderer(app, state)?;
            Ok(json!(
                serde_yaml::to_string(&value).map_err(|e| e.to_string())?
            ))
        
    });
}
