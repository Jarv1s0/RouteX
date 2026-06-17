use crate::desktop::prelude::*;
use crate::desktop::*;

pub(crate) fn core_request(
    state: &State<'_, CoreState>,
    method: reqwest::Method,
    path: &str,
    query: Option<&[(&str, String)]>,
    body: Option<Value>,
) -> Result<Value, String> {
    let started_at = Instant::now();
    let method_for_log = method.clone();
    let controller_url = {
        let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
        runtime
            .controller_url
            .clone()
            .ok_or_else(|| "Mihomo controller is not available".to_string())?
    };

    let url = format!("{controller_url}{path}");
    let client = mihomo_http_client()?;

    let mut request = client.request(method, &url);

    if let Some(query) = query {
        request = request.query(query);
    }

    if let Some(body) = body {
        request = request.json(&body);
    }

    let response = request.send().map_err(|e| e.to_string())?;
    let status = response.status();
    if status == reqwest::StatusCode::NO_CONTENT {
        return Ok(Value::Null);
    }
    let body = response.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        let detail = serde_json::from_str::<Value>(&body)
            .ok()
            .and_then(|value| {
                value
                    .get("message")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
            .or_else(|| {
                let trimmed = body.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                }
            });
        return Err(match detail {
            Some(detail) => format!("Mihomo API request failed: {status}: {detail}"),
            None => format!("Mihomo API request failed: {status}"),
        });
    }
    if body.trim().is_empty() {
        return Ok(Value::Null);
    }
    let result = serde_json::from_str::<Value>(&body).map_err(|e| e.to_string());
    let elapsed_ms = started_at.elapsed().as_millis();
    if elapsed_ms >= 80 || path == "/rules" || path == "/providers/rules" || path == "/proxies" {
        eprintln!(
            "[desktop.core_request] {} {} {}ms",
            method_for_log, path, elapsed_ms
        );
    }
    result
}
