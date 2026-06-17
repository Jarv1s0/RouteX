use crate::desktop::*;

pub(crate) fn http_client_with_timeout(timeout_ms: u64) -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| e.to_string())
}

pub(crate) fn http_get_response(
    url: &str,
    timeout_ms: u64,
) -> Result<(reqwest::StatusCode, String, Value), String> {
    let client = http_client_with_timeout(timeout_ms)?;
    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0 RouteX-Tauri/1.0")
        .header(reqwest::header::ACCEPT, "*/*")
        .send()
        .map_err(|e| e.to_string())?;

    let status = response.status();
    let mut headers = serde_json::Map::new();
    for (key, value) in response.headers() {
        headers.insert(
            key.as_str().to_string(),
            Value::String(value.to_str().unwrap_or_default().to_string()),
        );
    }

    let mut limited = response.take(150_000);
    let mut data = String::new();
    limited
        .read_to_string(&mut data)
        .map_err(|e| e.to_string())?;

    Ok((status, data, Value::Object(headers)))
}

pub(crate) fn http_get_json(url: &str, timeout_ms: u64) -> Result<Value, String> {
    let (status, body, _) = http_get_response(url, timeout_ms)?;
    if !status.is_success() {
        return Err(format!("HTTP 请求失败: {}", status));
    }

    serde_json::from_str::<Value>(&body).map_err(|e| e.to_string())
}

pub(crate) fn http_post_json(url: &str, body: &Value, timeout_ms: u64) -> Result<Value, String> {
    let client = http_client_with_timeout(timeout_ms)?;
    let response = client
        .post(url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0 RouteX-Tauri/1.0")
        .json(body)
        .send()
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("HTTP 请求失败: {}", response.status()));
    }

    response.json::<Value>().map_err(|e| e.to_string())
}

pub(crate) fn http_get_value(url: &str, timeout_ms: u64) -> Result<Value, String> {
    let (status, data, headers) = http_get_response(url, timeout_ms)?;
    Ok(json!({
        "status": status.as_u16(),
        "data": data,
        "headers": headers,
    }))
}

pub(crate) fn test_connectivity_value(url: &str, timeout_ms: u64) -> Value {
    let start = std::time::Instant::now();
    match http_get_response(url, timeout_ms) {
        Ok((status, _, _)) => json!({
            "success": status.as_u16() < 400,
            "latency": start.elapsed().as_millis() as i64,
            "status": status.as_u16(),
        }),
        Err(error) => json!({
            "success": false,
            "latency": start.elapsed().as_millis() as i64,
            "error": error,
        }),
    }
}
