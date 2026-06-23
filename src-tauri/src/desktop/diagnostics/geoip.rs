use super::http::{http_get_json, http_post_json};
use crate::desktop::prelude::*;
use crate::desktop::*;

pub(crate) fn resolve_to_ip(query: &str) -> String {
    if query.parse::<std::net::IpAddr>().is_ok() {
        return query.to_string();
    }

    format!("{query}:80")
        .to_socket_addrs()
        .ok()
        .and_then(|mut addrs| addrs.next().map(|addr| addr.ip().to_string()))
        .unwrap_or_else(|| query.to_string())
}

pub(crate) fn fetch_ip_info_current() -> Result<Value, String> {
    match http_get_json(
        "http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query",
        10_000,
    ) {
        Ok(value)
            if value.get("status").and_then(Value::as_str) == Some("success")
                && value.get("query").is_some() =>
        {
            Ok(value)
        }
        Ok(value) => Ok(json!({
            "status": "fail",
            "message": format!(
                "IP 信息获取失败: ip-api: {}",
                value
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("响应无有效 IP")
            ),
        })),
        Err(error) => Ok(json!({
            "status": "fail",
            "message": format!("IP 信息获取失败: ip-api: {error}"),
        })),
    }
}

pub(crate) fn fetch_ip_info_query(query: &str) -> Result<Value, String> {
    let ip = resolve_to_ip(query);
    let mut result = http_get_json(
        &format!("http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query"),
        10_000,
    )?;
    if let Some(map) = result.as_object_mut() {
        map.insert("query".to_string(), Value::String(query.to_string()));
    }
    Ok(result)
}

pub(crate) fn fetch_batch_ip_info(queries: &[IpInfoQueryInput]) -> Result<Value, String> {
    let request_body = Value::Array(
        queries
            .iter()
            .map(|item| {
                json!({
                    "query": resolve_to_ip(&item.query),
                    "lang": item.lang.clone().unwrap_or_else(|| "zh-CN".to_string())
                })
            })
            .collect(),
    );

    let mut result = http_post_json("http://ip-api.com/batch", &request_body, 15_000)?;
    if let Some(items) = result.as_array_mut() {
        for (index, item) in items.iter_mut().enumerate() {
            if let Some(map) = item.as_object_mut() {
                if let Some(original) = queries.get(index) {
                    map.insert("query".to_string(), Value::String(original.query.clone()));
                }
            }
        }
    }
    Ok(result)
}
