use crate::desktop::prelude::*;
use crate::desktop::*;

pub(crate) fn extract_domain(input: &str) -> String {
    if let Ok(url) = reqwest::Url::parse(input) {
        if let Some(host) = url.host_str() {
            return host.to_string();
        }
    }

    input
        .trim()
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .split('/')
        .next()
        .unwrap_or_default()
        .split(':')
        .next()
        .unwrap_or_default()
        .to_string()
}

pub(crate) fn test_rule_match_value(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    domain: &str,
) -> Result<Value, String> {
    let runtime = current_runtime_value(app, state)?;
    let mixed_port = runtime
        .get("mixed-port")
        .and_then(Value::as_i64)
        .unwrap_or(7890);
    if mixed_port <= 0 {
        return Ok(Value::Null);
    }

    let target_url = if domain.starts_with("http://") || domain.starts_with("https://") {
        domain.to_string()
    } else {
        format!("http://{domain}/")
    };

    let client = Client::builder()
        .timeout(Duration::from_secs(3))
        .proxy(
            reqwest::Proxy::all(format!("http://127.0.0.1:{mixed_port}"))
                .map_err(|e| e.to_string())?,
        )
        .build()
        .map_err(|e| e.to_string())?;
    let _ = client.get(target_url).send();

    std::thread::sleep(Duration::from_millis(500));

    let target_domain = extract_domain(domain).to_lowercase();
    let connections = core_request(state, reqwest::Method::GET, "/connections", None, None)?;
    let items = connections
        .get("connections")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    for item in items {
        let host = item
            .get("metadata")
            .and_then(Value::as_object)
            .and_then(|meta| meta.get("host"))
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_lowercase();
        if host != target_domain && !host.ends_with(&format!(".{target_domain}")) {
            continue;
        }

        if let Some(id) = item.get("id").and_then(Value::as_str) {
            let _ = core_request(
                state,
                reqwest::Method::DELETE,
                &format!("/connections/{}", urlencoding::encode(id)),
                None,
                None,
            );
        }

        let proxy = item
            .get("chains")
            .and_then(Value::as_array)
            .and_then(|chains| chains.first())
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        return Ok(json!({
            "rule": item.get("rule").and_then(Value::as_str).unwrap_or_default(),
            "rulePayload": item.get("rulePayload").and_then(Value::as_str).unwrap_or_default(),
            "proxy": proxy,
        }));
    }

    Ok(Value::Null)
}
