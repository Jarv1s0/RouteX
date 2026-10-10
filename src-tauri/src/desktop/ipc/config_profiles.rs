#[allow(clippy::redundant_closure_call)]
pub(crate) fn register_profiles_config_handlers(map: &mut std::collections::HashMap<&'static str, crate::desktop::ipc::IpcHandler>) {
    map.insert("getProfileMergeReport", |app, _window, state, _args| {
        (|| -> Result<Value, String> {
            let _guard = state.profile_mutation_lock.lock().map_err(|e| e.to_string())?;
            Ok(json!(current_profile_runtime_details(app)?.1))
        })().map_err(crate::desktop::error::AppError::from)
    });
    map.insert("setProfileMergeTargets", |app, _window, state, args| {
        (|| -> Result<Value, String> {
            let id = args.first().and_then(Value::as_str)
                .ok_or_else(|| "setProfileMergeTargets requires profile id".to_string())?;
            let targets = serde_json::from_value::<Vec<String>>(
                args.get(1).cloned().unwrap_or(Value::Null)
            ).map_err(|e| e.to_string())?;
            let mut config = read_profile_config(app)?;
            if config.current.as_deref() != Some(id) {
                return Err("主订阅已切换，请刷新后重新设置接入策略组".to_string());
            }
            config.merge_targets.insert(id.to_string(), dedupe_ids(targets));
            write_profile_config(app, &config)?;
            restart_core_and_emit(app, state)?;
            emit_ipc_event(app, "profileConfigUpdated", Value::Null);
            Ok(Value::Null)
        })().map_err(crate::desktop::error::AppError::from)
    });
    map.insert("getProfileConfig", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(read_profile_config(app)?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("setProfileConfig", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getCurrentProfileItem", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(current_profile_item(app)?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getProfileItem", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args.first().and_then(Value::as_str);
            let config = read_profile_config(app)?;
            Ok(json!(get_profile_item_from_config(&config, id)
                .unwrap_or_else(default_empty_profile_item)))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("changeCurrentProfile", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("setActiveProfiles", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("addProfileItem", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let item = serde_json::from_value::<ProfileItemInput>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            let runtime_profile_affected = add_or_replace_profile_item(app, item)?;
            emit_ipc_event(app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            if runtime_profile_affected {
                restart_core_and_emit(app, state)?;
            }
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("updateProfileItem", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let item = serde_json::from_value::<ProfileItemData>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            let runtime_profile_affected = update_profile_item_store(app, item)?;
            emit_ipc_event(app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            if runtime_profile_affected {
                restart_core_and_emit(app, state)?;
            }
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("removeProfileItem", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getProfileStr", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getProfileStr requires profile id".to_string())?;
            Ok(json!(read_profile_text(app, id)?))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("setProfileStr", |app, window, state, args| { (|| -> Result<Value, String> {
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
            if profile_affects_runtime(&read_profile_config(app)?, id) {
                restart_core_and_emit(app, state)?;
            }
            emit_ipc_event(app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getRawProfileStr", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let current = current_profile_item(app)?;
            Ok(json!(read_profile_text(app, &current.id)?))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getCurrentProfileStr", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let current = current_profile_item(app)?;
            Ok(json!(read_profile_text(app, &current.id)?))
        
    })().map_err(crate::desktop::error::AppError::from) });
}
