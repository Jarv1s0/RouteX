pub(crate) fn register_network_handlers(map: &mut std::collections::HashMap<&'static str, crate::desktop::ipc::IpcHandler>) {
    map.insert("testConnectivity", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let url = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "testConnectivity requires url".to_string())?;
            let timeout = args.get(1).and_then(Value::as_u64).unwrap_or(5_000);
            Ok(test_connectivity_value(url, timeout))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("testRuleMatch", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let domain = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "testRuleMatch requires domain".to_string())?;
            test_rule_match_value(app, state, domain)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("applyTheme", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(Value::Null) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("fetchIpInfo", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         fetch_ip_info_current() 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("fetchIpInfoQuery", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let query = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "fetchIpInfoQuery requires query".to_string())?;
            fetch_ip_info_query(query)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("fetchBatchIpInfo", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let queries = serde_json::from_value::<Vec<IpInfoQueryInput>>(
                args.first().cloned().unwrap_or_else(|| json!([])),
            )
            .map_err(|e| e.to_string())?;
            fetch_batch_ip_info(&queries)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("httpGet", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let url = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "httpGet requires url".to_string())?;
            let timeout = args.get(1).and_then(Value::as_u64).unwrap_or(5_000);
            http_get_value(url, timeout)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("checkStreamingUnlock", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let service = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "checkStreamingUnlock requires service".to_string())?;
            check_streaming_unlock(service)
        
    })().map_err(crate::desktop::error::AppError::from) });
}
