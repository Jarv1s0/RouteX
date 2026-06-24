use super::super::prelude::*;
use super::super::*;

pub(crate) const DEFAULT_SUBSCRIPTION_USER_AGENT: &str = "clash.meta/alpha-e89af72";
pub(crate) const DEFAULT_REMOTE_PROFILE_NAME: &str = "Subscribe";
pub(crate) const DEFAULT_LOCAL_PROFILE_NAME: &str = "本地配置";

#[derive(Default)]
pub(crate) struct RemoteFetchOptions<'a> {
    pub(crate) user_agent: Option<&'a str>,
    pub(crate) use_proxy: bool,
}

pub(crate) fn non_empty_trimmed(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

pub(crate) fn resolve_remote_user_agent(
    app: &tauri::AppHandle,
    user_agent: Option<&str>,
) -> Result<String, String> {
    if let Some(value) = non_empty_trimmed(user_agent) {
        return Ok(value.to_string());
    }

    let app_config = read_app_config_store(app)?;
    Ok(
        non_empty_trimmed(app_config.get("userAgent").and_then(Value::as_str))
            .unwrap_or(DEFAULT_SUBSCRIPTION_USER_AGENT)
            .to_string(),
    )
}

pub(crate) fn fetch_remote_text(
    app: &tauri::AppHandle,
    url: &str,
    options: RemoteFetchOptions<'_>,
) -> Result<String, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("远程地址不能为空".to_string());
    }
    if trimmed.starts_with('/') {
        return Err("Tauri 宿主暂不支持相对远程地址".to_string());
    }

    let mut client_builder = Client::builder().timeout(Duration::from_secs(30));
    if options.use_proxy {
        let controlled_config = read_controlled_config_store(app)?;
        let mixed_port = controlled_config
            .get("mixed-port")
            .and_then(Value::as_u64)
            .unwrap_or(7890);
        let proxy_url = format!("http://127.0.0.1:{mixed_port}");
        let proxy = reqwest::Proxy::all(&proxy_url).map_err(|e| e.to_string())?;
        client_builder = client_builder.proxy(proxy);
    }

    let client = client_builder.build().map_err(|e| e.to_string())?;

    let response = client
        .get(trimmed)
        .header(
            reqwest::header::USER_AGENT,
            resolve_remote_user_agent(app, options.user_agent)?,
        )
        .send()
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("请求失败: {}", response.status()));
    }

    response.text().map_err(|e| e.to_string())
}

pub(crate) fn guess_name_from_url(url: &str, fallback: &str) -> String {
    let parsed = reqwest::Url::parse(url).ok();
    let Some(parsed) = parsed else {
        return fallback.to_string();
    };

    let Some(name) = parsed
        .path_segments()
        .and_then(|mut segments| segments.rfind(|segment| !segment.is_empty()))
    else {
        return fallback.to_string();
    };

    urlencoding::decode(name)
        .map(|value| value.into_owned())
        .unwrap_or_else(|_| name.to_string())
}

pub(crate) fn is_generic_subscription_name(name: &str) -> bool {
    let normalized = name.trim().to_ascii_lowercase();
    let normalized = normalized
        .trim_end_matches(".yaml")
        .trim_end_matches(".yml")
        .trim_end_matches(".txt");

    matches!(normalized, "subscribe" | "subscription" | "sub")
}

pub(crate) fn default_remote_profile_name(url: Option<&str>) -> String {
    let Some(url) = url else {
        return DEFAULT_REMOTE_PROFILE_NAME.to_string();
    };

    let name = guess_name_from_url(url, DEFAULT_REMOTE_PROFILE_NAME);
    if name == DEFAULT_REMOTE_PROFILE_NAME || is_generic_subscription_name(&name) {
        DEFAULT_REMOTE_PROFILE_NAME.to_string()
    } else {
        name
    }
}
