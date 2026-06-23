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

fn find_matching_connection(items: Vec<Value>, target_domain: &str) -> Option<Value> {
    for item in items {
        let host = item
            .get("metadata")
            .and_then(Value::as_object)
            .and_then(|meta| meta.get("host"))
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_lowercase();
        if host == target_domain || host.ends_with(&format!(".{target_domain}")) {
            return Some(item);
        }
    }

    None
}

fn read_matching_connection(
    state: &State<'_, CoreState>,
    target_domain: &str,
) -> Result<Option<Value>, String> {
    let connections = core_request(state, reqwest::Method::GET, "/connections", None, None)?;
    let items = connections
        .get("connections")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    Ok(find_matching_connection(items, target_domain))
}

fn wait_for_matching_connection(
    state: &State<'_, CoreState>,
    target_domain: &str,
) -> Result<Option<Value>, String> {
    let deadline = Instant::now() + Duration::from_secs(2);

    loop {
        if let Some(item) = read_matching_connection(state, target_domain)? {
            return Ok(Some(item));
        }

        if Instant::now() >= deadline {
            return Ok(None);
        }

        thread::sleep(Duration::from_millis(100));
    }
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

    let response = client.get(target_url).send();

    let target_domain = extract_domain(domain).to_lowercase();
    let item = wait_for_matching_connection(state, &target_domain)?;
    drop(response);

    if let Some(item) = item {
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
