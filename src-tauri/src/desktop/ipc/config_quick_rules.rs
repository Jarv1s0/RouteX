#[allow(clippy::redundant_closure_call)]
pub(crate) fn register_quick_rules_config_handlers(map: &mut std::collections::HashMap<&'static str, crate::desktop::ipc::IpcHandler>) {
    map.insert("getQuickRulesConfig", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(read_quick_rules_config(app)?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("setQuickRulesConfig", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getQuickRules", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            Ok(json!(read_quick_rules(app, profile_id)?))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("addQuickRule", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("updateQuickRule", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("removeQuickRule", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("setQuickRulesEnabled", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("reorderQuickRules", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("clearQuickRules", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let profile_id = args.first().and_then(Value::as_str).unwrap_or("default");
            clear_quick_rules_store(app, profile_id)?;
            restart_core_and_emit(app, state)?;
            emit_ipc_event(app, "quickRulesConfigUpdated", Value::Null);
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
}
