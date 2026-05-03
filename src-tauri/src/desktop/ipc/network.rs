fn handle_network_invoke(app: &tauri::AppHandle, state: &State<'_, CoreState>, channel: &str, args: &[Value]) -> Result<Option<Value>, String> {
    let result: Result<Value, String> = match channel {
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
        _ => return Ok(None),
    };
    Ok(Some(result?))
}
