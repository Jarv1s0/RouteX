use crate::desktop::foundation::external_http_client;
use crate::desktop::*;

pub(crate) fn http_get_response(
    url: &str,
    timeout_ms: u64,
) -> Result<(reqwest::StatusCode, String, Value), String> {
    let started = Instant::now();
    let client = external_http_client()?;
    let timeout = Duration::from_millis(timeout_ms);
    let retry_delay = Duration::from_millis(150);
    let mut last_error = "HTTP 请求超时".to_string();

    // 对传输层发送失败（如连接池陈旧连接重置或网络瞬断）进行一次短暂退避重试
    for attempt in 0..2 {
        if attempt > 0 {
            if timeout.saturating_sub(started.elapsed()) <= retry_delay {
                break;
            }
            std::thread::sleep(retry_delay);
        }

        let remaining = timeout.saturating_sub(started.elapsed());
        if remaining.is_zero() {
            break;
        }
        let response = match client
            .get(url)
            .timeout(remaining)
            .header(reqwest::header::USER_AGENT, "Mozilla/5.0 RouteX-Tauri/1.0")
            .header(reqwest::header::ACCEPT, "*/*")
            .send()
        {
            Ok(resp) => resp,
            Err(error) => {
                last_error = error.to_string();
                continue;
            }
        };

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
        match limited.read_to_string(&mut data) {
            Ok(_) => return Ok((status, data, Value::Object(headers))),
            Err(error) => {
                last_error = error.to_string();
            }
        }
    }

    Err(last_error)
}

pub(crate) fn http_get_json(url: &str, timeout_ms: u64) -> Result<Value, String> {
    let (status, body, _) = http_get_response(url, timeout_ms)?;
    if !status.is_success() {
        return Err(format!("HTTP 请求失败: {}", status));
    }

    serde_json::from_str::<Value>(&body).map_err(|e| e.to_string())
}

pub(crate) fn http_post_json(url: &str, body: &Value, timeout_ms: u64) -> Result<Value, String> {
    let response = external_http_client()?
        .post(url)
        .timeout(Duration::from_millis(timeout_ms))
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;

    #[test]
    fn skips_retry_when_backoff_would_exceed_the_timeout() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind local HTTP test server");
        let url = format!("http://{}", listener.local_addr().unwrap());
        // Keep the listening socket open without sending a response.
        let result = http_get_response(&url, 100);
        listener.set_nonblocking(true).unwrap();
        let attempts = std::iter::from_fn(|| listener.accept().ok()).count();
        assert!(result.is_err());
        assert_eq!(attempts, 1);
    }
}
