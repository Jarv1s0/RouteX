use crate::desktop::*;
use super::http::http_get_response;

pub(crate) fn check_streaming_unlock(service: &str) -> Result<Value, String> {
    let timeout = 15_000;
    let result = match service {
        "netflix" => {
            let (status, body, _) =
                http_get_response("https://www.netflix.com/title/80018499", timeout)?;
            if status == reqwest::StatusCode::OK {
                let region = body
                    .split("\"countryCode\":\"")
                    .nth(1)
                    .and_then(|part| part.get(0..2))
                    .unwrap_or("Unknown");
                json!({ "status": "unlocked", "region": region })
            } else if status == reqwest::StatusCode::NOT_FOUND {
                let (second_status, _, _) =
                    http_get_response("https://www.netflix.com/title/70143836", timeout)?;
                if second_status == reqwest::StatusCode::OK {
                    json!({ "status": "unlocked", "region": "仅自制剧" })
                } else {
                    json!({ "status": "locked" })
                }
            } else {
                json!({ "status": "locked" })
            }
        }
        "youtube" => {
            let (status, body, _) = http_get_response("https://www.youtube.com/premium", timeout)?;
            if status == reqwest::StatusCode::OK {
                let region = body
                    .split("\"GL\":\"")
                    .nth(1)
                    .and_then(|part| part.get(0..2))
                    .unwrap_or("Unknown");
                json!({ "status": "unlocked", "region": region })
            } else {
                json!({ "status": "locked" })
            }
        }
        "spotify" => {
            let (status, _, _) = http_get_response("https://open.spotify.com/", timeout)?;
            if status == reqwest::StatusCode::OK {
                json!({ "status": "unlocked", "region": "Available" })
            } else {
                json!({ "status": "locked" })
            }
        }
        "chatgpt" => {
            let (status, body, _) = http_get_response("https://ios.chat.openai.com/", timeout)?;
            if status.is_success() || status.is_redirection() {
                json!({ "status": "unlocked", "region": "Available" })
            } else if status == reqwest::StatusCode::FORBIDDEN
                && (body.contains("blocked")
                    || body.contains("unavailable")
                    || body.contains("VPN"))
            {
                json!({ "status": "locked" })
            } else {
                let (model_status, _, _) =
                    http_get_response("https://api.openai.com/v1/models", timeout)?;
                if model_status == reqwest::StatusCode::FORBIDDEN {
                    json!({ "status": "locked" })
                } else {
                    json!({ "status": "unlocked", "region": "Available" })
                }
            }
        }
        "gemini" => {
            let (status, body, _) = http_get_response("https://gemini.google.com/", timeout)?;
            if status == reqwest::StatusCode::FORBIDDEN
                || body.contains("not available")
                || body.contains("unavailable")
                || body.contains("not supported")
            {
                json!({ "status": "locked" })
            } else {
                json!({ "status": "unlocked", "region": "Available" })
            }
        }
        "tiktok" => {
            let (status, body, _) = http_get_response("https://www.tiktok.com/", timeout)?;
            if status == reqwest::StatusCode::OK
                && !(body.contains("not available") || body.contains("unavailable"))
            {
                json!({ "status": "unlocked", "region": "Available" })
            } else {
                json!({ "status": "locked" })
            }
        }
        _ => json!({ "status": "error", "error": format!("未知服务: {service}") }),
    };

    Ok(result)
}
