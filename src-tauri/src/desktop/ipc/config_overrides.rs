#[allow(clippy::redundant_closure_call)]
pub(crate) fn register_overrides_config_handlers(map: &mut std::collections::HashMap<&'static str, crate::desktop::ipc::IpcHandler>) {
    map.insert("getOverrideConfig", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(read_override_config(app)?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("setOverrideConfig", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getOverrideItem", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("addOverrideItem", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let item = serde_json::from_value::<OverrideItemInput>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            let runtime_override_affected = add_or_replace_override_item(app, item)?;
            emit_ipc_event(app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            if runtime_override_affected {
                restart_core_and_emit(app, state)?;
            }
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("updateOverrideItem", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let item = serde_json::from_value::<OverrideItemData>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            let runtime_override_affected = update_override_item_store(app, item)?;
            emit_ipc_event(app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            if runtime_override_affected {
                restart_core_and_emit(app, state)?;
            }
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("removeOverrideItem", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getOverride", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("canRollbackOverride", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("rollbackOverride", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("setOverride", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getOverrideProfileStr", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(current_override_profile_text(app)?)) 
    })().map_err(crate::desktop::error::AppError::from) });
}
