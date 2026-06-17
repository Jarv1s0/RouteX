use crate::desktop::prelude::*;
use crate::desktop::*;
use super::http::{http_get_json, http_get_response, http_post_json};

pub(crate) fn value_string(value: &Value, keys: &[&str]) -> String {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_str))
        .unwrap_or_default()
        .to_string()
}

pub(crate) fn value_number(value: &Value, keys: &[&str]) -> Value {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_f64))
        .map(Value::from)
        .unwrap_or(Value::Null)
}

pub(crate) struct IpInfoResult {
    query: String,
    country: String,
    country_code: String,
    region_name: String,
    city: String,
    timezone: String,
    isp: String,
    org: String,
    asn: String,
    lat: Value,
    lon: Value,
}

pub(crate) fn ip_info_result(info: IpInfoResult) -> Value {
    json!({
        "status": "success",
        "query": info.query,
        "country": info.country,
        "countryCode": info.country_code,
        "region": "",
        "regionName": info.region_name,
        "city": info.city,
        "zip": "",
        "lat": info.lat,
        "lon": info.lon,
        "timezone": info.timezone,
        "isp": info.isp,
        "org": info.org,
        "as": info.asn,
    })
}

pub(crate) fn normalize_ipapi_info(value: Value) -> Option<Value> {
    let query = value_string(&value, &["ip"]);
    if query.is_empty() {
        return None;
    }

    let org = value_string(&value, &["org"]);
    let asn = value_string(&value, &["asn"]);

    Some(ip_info_result(IpInfoResult {
        query,
        country: value_string(&value, &["country_name", "country"]),
        country_code: value_string(&value, &["country_code"]),
        region_name: value_string(&value, &["region"]),
        city: value_string(&value, &["city"]),
        timezone: value_string(&value, &["timezone"]),
        isp: org.clone(),
        org,
        asn,
        lat: value_number(&value, &["latitude", "lat"]),
        lon: value_number(&value, &["longitude", "lon"]),
    }))
}

pub(crate) fn normalize_ipinfo_info(value: Value) -> Option<Value> {
    let query = value_string(&value, &["ip"]);
    if query.is_empty() {
        return None;
    }

    let (lat, lon) = value
        .get("loc")
        .and_then(Value::as_str)
        .and_then(|loc| {
            let mut parts = loc.split(',');
            let lat = parts.next()?.parse::<f64>().ok()?;
            let lon = parts.next()?.parse::<f64>().ok()?;
            Some((Value::from(lat), Value::from(lon)))
        })
        .unwrap_or((Value::Null, Value::Null));

    let org = value_string(&value, &["org"]);

    Some(ip_info_result(IpInfoResult {
        query,
        country: value_string(&value, &["country"]),
        country_code: value_string(&value, &["country"]),
        region_name: value_string(&value, &["region"]),
        city: value_string(&value, &["city"]),
        timezone: value_string(&value, &["timezone"]),
        isp: org.clone(),
        org: org.clone(),
        asn: org,
        lat,
        lon,
    }))
}

pub(crate) fn normalize_ipip_info(value: Value) -> Option<Value> {
    let data = value.get("data")?;
    let query = value_string(data, &["ip"]);
    if query.is_empty() {
        return None;
    }

    let location: Vec<String> = data
        .get("location")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .filter(|item| !item.is_empty())
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default();

    let country = location.first().cloned().unwrap_or_default();
    let region = location.get(1).cloned().unwrap_or_default();
    let city = location.get(2).cloned().unwrap_or_default();
    let isp = location.get(3).cloned().unwrap_or_default();

    Some(ip_info_result(IpInfoResult {
        query,
        country,
        country_code: String::new(),
        region_name: region,
        city,
        timezone: String::new(),
        isp: isp.clone(),
        org: isp.clone(),
        asn: isp,
        lat: Value::Null,
        lon: Value::Null,
    }))
}

pub(crate) fn normalize_cloudflare_trace(body: String) -> Option<Value> {
    let mut trace = serde_json::Map::new();
    for line in body.lines() {
        if let Some((key, value)) = line.split_once('=') {
            trace.insert(key.to_string(), Value::String(value.to_string()));
        }
    }

    let query = trace
        .get("ip")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    if query.is_empty() {
        return None;
    }

    Some(ip_info_result(IpInfoResult {
        query,
        country: trace
            .get("loc")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        country_code: trace
            .get("loc")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        region_name: trace
            .get("colo")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        city: String::new(),
        timezone: String::new(),
        isp: "Cloudflare".to_string(),
        org: value_string(&Value::Object(trace.clone()), &["colo"]),
        asn: value_string(&Value::Object(trace), &["fl"]),
        lat: Value::Null,
        lon: Value::Null,
    }))
}

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
    let (tx, rx) = std::sync::mpsc::channel();

    let tx1 = tx.clone();
    std::thread::spawn(move || {
        let res = http_get_json(
            "http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query",
            10_000,
        );
        match res {
            Ok(value)
                if value.get("status").and_then(Value::as_str) == Some("success")
                    && value.get("query").is_some() =>
            {
                let _ = tx1.send(Ok(value));
            }
            Ok(value) => {
                let _ = tx1.send(Err(format!(
                    "ip-api: {}",
                    value
                        .get("message")
                        .and_then(Value::as_str)
                        .unwrap_or("响应无有效 IP")
                )));
            }
            Err(error) => {
                let _ = tx1.send(Err(format!("ip-api: {error}")));
            }
        }
    });

    let tx2 = tx.clone();
    std::thread::spawn(move || {
        match http_get_json("https://ipapi.co/json/", 10_000)
            .ok()
            .and_then(normalize_ipapi_info)
        {
            Some(value) => {
                let _ = tx2.send(Ok(value));
            }
            None => {
                let _ = tx2.send(Err("ipapi.co: 响应无有效 IP".to_string()));
            }
        }
    });

    let tx3 = tx.clone();
    std::thread::spawn(move || {
        match http_get_json("https://ipinfo.io/json", 10_000)
            .ok()
            .and_then(normalize_ipinfo_info)
        {
            Some(value) => {
                let _ = tx3.send(Ok(value));
            }
            None => {
                let _ = tx3.send(Err("ipinfo.io: 响应无有效 IP".to_string()));
            }
        }
    });

    let tx4 = tx.clone();
    std::thread::spawn(move || {
        match http_get_json("https://myip.ipip.net/json", 10_000)
            .ok()
            .and_then(normalize_ipip_info)
        {
            Some(value) => {
                let _ = tx4.send(Ok(value));
            }
            None => {
                let _ = tx4.send(Err("IPIP.net: 响应无有效 IP".to_string()));
            }
        }
    });

    let tx5 = tx.clone();
    std::thread::spawn(
        move || match http_get_response("https://1.1.1.1/cdn-cgi/trace", 10_000) {
            Ok((status, body, _)) if status.is_success() => {
                if let Some(value) = normalize_cloudflare_trace(body) {
                    let _ = tx5.send(Ok(value));
                } else {
                    let _ = tx5.send(Err("Cloudflare: 响应无有效 IP".to_string()));
                }
            }
            Ok((status, _, _)) => {
                let _ = tx5.send(Err(format!("Cloudflare: HTTP 请求失败: {status}")));
            }
            Err(error) => {
                let _ = tx5.send(Err(format!("Cloudflare: {error}")));
            }
        },
    );

    drop(tx);

    let mut errors = Vec::new();
    for _ in 0..5 {
        if let Ok(result) = rx.recv() {
            match result {
                Ok(value) => return Ok(value),
                Err(e) => errors.push(e),
            }
        }
    }

    Ok(json!({
        "status": "fail",
        "message": format!("IP 信息获取失败: {}", errors.join("; ")),
    }))
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
