use crate::desktop::prelude::*;
use crate::desktop::*;

pub(crate) fn core_request(
    state: &CoreState,
    method: reqwest::Method,
    path: &str,
    query: Option<&[(&str, String)]>,
    body: Option<Value>,
) -> Result<Value, String> {
    let started_at = Instant::now();
    let method_for_log = method.clone();
    let (controller_url, controller_secret) = {
        let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
        let url = runtime
            .controller_url
            .clone()
            .ok_or_else(|| "Mihomo controller is not available".to_string())?;
        (url, runtime.controller_secret.clone())
    };

    let url = format!("{controller_url}{path}");
    let client = mihomo_http_client()?;

    let mut request = client.request(method, &url);
    if !controller_secret.is_empty() {
        request = request.bearer_auth(&controller_secret);
    }

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader, Write};
    use std::net::TcpListener;

    #[test]
    fn core_request_uses_running_controller_secret() {
        for (configured_secret, expected_header) in [
            (
                "test-controller-secret",
                Some("Bearer test-controller-secret"),
            ),
            ("", None),
        ] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let state = CoreState::default();
            {
                let mut runtime = state.runtime.lock().unwrap();
                runtime.controller_url = Some(format!("http://{}", listener.local_addr().unwrap()));
                runtime.controller_secret = configured_secret.to_string();
            }

            let result = std::thread::scope(|scope| {
                let server = scope.spawn(move || {
                    let (mut stream, _) = listener.accept().unwrap();
                    stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
                    let header = BufReader::new(&stream)
                        .lines()
                        .map_while(Result::ok)
                        .take_while(|line| !line.is_empty())
                        .find_map(|line| {
                            let (name, value) = line.split_once(':')?;
                            name.eq_ignore_ascii_case("authorization")
                                .then(|| value.trim().to_string())
                        });
                    let response = if header.as_deref() == expected_header {
                        "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}"
                    } else {
                        "HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                    };
                    stream.write_all(response.as_bytes()).unwrap();
                });
                let result = core_request(&state, reqwest::Method::GET, "/rules", None, None);
                server.join().unwrap();
                result
            });
            assert_eq!(result.unwrap(), json!({}));
        }
    }
}
