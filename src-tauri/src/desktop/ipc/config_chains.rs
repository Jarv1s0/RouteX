#[allow(clippy::redundant_closure_call)]
pub(crate) fn register_chains_config_handlers(map: &mut std::collections::HashMap<&'static str, crate::desktop::ipc::IpcHandler>) {
    map.insert("getChainsConfig", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(read_chains_config(app)?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getAllChains", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(read_chains_config(app)?.items)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("addChainItem", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("updateChainItem", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("removeChainItem", |app, window, state, args| { (|| -> Result<Value, String> {
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
        
    })().map_err(crate::desktop::error::AppError::from) });
}
