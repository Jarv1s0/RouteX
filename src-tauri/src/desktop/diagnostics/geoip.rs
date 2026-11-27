use super::http::{http_get_json, http_post_json};
use crate::desktop::prelude::*;
use crate::desktop::*;

const IP_API_FIELDS: &str =
    "status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query";
const IP_INFO_TIMEOUT_MS: u64 = 10_000;
const IP_INFO_PROVIDER_TIMEOUT_MS: u64 = IP_INFO_TIMEOUT_MS / 4;

struct NormalizedIpInfo {
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

fn value_string(value: &Value, keys: &[&str]) -> String {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_str))
        .unwrap_or_default()
        .to_string()
}

fn value_number(value: &Value, keys: &[&str]) -> Value {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_f64))
        .map(Value::from)
        .unwrap_or(Value::Null)
}

fn ip_info_result(info: NormalizedIpInfo) -> Value {
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

fn normalize_ip_api_result(res: Result<Value, String>) -> Result<Value, String> {
    match res {
        Ok(value)
            if value.get("status").and_then(Value::as_str) == Some("success")
                && value.get("query").is_some() =>
        {
            Ok(value)
        }
        Ok(value) => Err(format!(
            "ip-api: {}",
            value
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("响应无有效 IP")
        )),
        Err(error) => Err(format!("ip-api: {error}")),
    }
}

fn normalize_ipapi_co_info(value: Value) -> Option<Value> {
    if value.get("error").and_then(Value::as_bool) == Some(true) {
        return None;
    }

    let query = value_string(&value, &["ip"]);
    if query.is_empty() {
        return None;
    }

    let org = value_string(&value, &["org"]);
    let asn = value_string(&value, &["asn"]);

    Some(ip_info_result(NormalizedIpInfo {
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

fn normalize_ipinfo_info(value: Value) -> Option<Value> {
    let query = value_string(&value, &["ip"]);
    if query.is_empty() {
        return None;
    }

    let (lat, lon) = value
        .get("loc")
        .and_then(Value::as_str)
        .and_then(|loc| {
            let mut parts = loc.split(',');
            let lat = parts.next()?.trim().parse::<f64>().ok()?;
            let lon = parts.next()?.trim().parse::<f64>().ok()?;
            Some((Value::from(lat), Value::from(lon)))
        })
        .unwrap_or((Value::Null, Value::Null));

    let org = value_string(&value, &["org"]);

    Some(ip_info_result(NormalizedIpInfo {
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

fn normalize_ipsb_info(value: Value) -> Option<Value> {
    let query = value_string(&value, &["ip"]);
    if query.is_empty() {
        return None;
    }

    let isp = value_string(&value, &["isp", "organization"]);
    let org = value_string(&value, &["organization", "isp"]);
    let asn = value
        .get("asn")
        .and_then(Value::as_u64)
        .map(|num| format!("AS{num}"))
        .unwrap_or_else(|| value_string(&value, &["asn_organization"]));

    Some(ip_info_result(NormalizedIpInfo {
        query,
        country: value_string(&value, &["country"]),
        country_code: value_string(&value, &["country_code"]),
        region_name: value_string(&value, &["region"]),
        city: value_string(&value, &["city"]),
        timezone: value_string(&value, &["timezone"]),
        isp,
        org,
        asn,
        lat: value_number(&value, &["latitude"]),
        lon: value_number(&value, &["longitude"]),
    }))
}

fn fetch_normalized_source(
    name: &str,
    url: &str,
    timeout_ms: u64,
    normalizer: fn(Value) -> Option<Value>,
) -> Result<Value, String> {
    let value = http_get_json(url, timeout_ms).map_err(|e| format!("{name}: {e}"))?;
    normalizer(value).ok_or_else(|| format!("{name}: 响应无有效 IP"))
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
        let url = format!("http://ip-api.com/json/?fields={IP_API_FIELDS}");
        let _ = tx1.send(normalize_ip_api_result(http_get_json(
            &url,
            IP_INFO_TIMEOUT_MS,
        )));
    });

    let tx2 = tx.clone();
    std::thread::spawn(move || {
        let _ = tx2.send(fetch_normalized_source(
            "ipinfo.io",
            "https://ipinfo.io/json",
            IP_INFO_TIMEOUT_MS,
            normalize_ipinfo_info,
        ));
    });

    let tx3 = tx.clone();
    std::thread::spawn(move || {
        let _ = tx3.send(fetch_normalized_source(
            "ipapi.co",
            "https://ipapi.co/json/",
            IP_INFO_TIMEOUT_MS,
            normalize_ipapi_co_info,
        ));
    });

    let tx4 = tx.clone();
    std::thread::spawn(move || {
        let _ = tx4.send(fetch_normalized_source(
            "ip.sb",
            "https://api.ip.sb/geoip",
            IP_INFO_TIMEOUT_MS,
            normalize_ipsb_info,
        ));
    });

    drop(tx);

    let mut errors = Vec::new();
    for result in rx {
        match result {
            Ok(value) => return Ok(value),
            Err(error) => errors.push(error),
        }
    }

    Ok(json!({
        "status": "fail",
        "message": format!("IP 信息获取失败: {}", errors.join("; ")),
    }))
}

pub(crate) fn fetch_ip_info_query(query: &str) -> Result<Value, String> {
    let ip = resolve_to_ip(query);
    let started = Instant::now();
    let ip_api_url = format!("http://ip-api.com/json/{ip}?fields={IP_API_FIELDS}");

    let mut result =
        match normalize_ip_api_result(http_get_json(&ip_api_url, IP_INFO_PROVIDER_TIMEOUT_MS)) {
            Ok(value) => value,
            Err(primary_err) => {
                let mut errors = vec![primary_err];
                let fallbacks: [(&str, String, fn(Value) -> Option<Value>); 3] = [
                    (
                        "ipinfo.io",
                        format!("https://ipinfo.io/{ip}/json"),
                        normalize_ipinfo_info,
                    ),
                    (
                        "ip.sb",
                        format!("https://api.ip.sb/geoip/{ip}"),
                        normalize_ipsb_info,
                    ),
                    (
                        "ipapi.co",
                        format!("https://ipapi.co/{ip}/json/"),
                        normalize_ipapi_co_info,
                    ),
                ];

                let mut resolved = None;
                let fallback_count = fallbacks.len();
                for (index, (name, url, normalizer)) in fallbacks.into_iter().enumerate() {
                    let remaining_ms =
                        IP_INFO_TIMEOUT_MS.saturating_sub(started.elapsed().as_millis() as u64);
                    if remaining_ms == 0 {
                        break;
                    }
                    let timeout_ms = if index + 1 == fallback_count {
                        remaining_ms
                    } else {
                        remaining_ms.min(IP_INFO_PROVIDER_TIMEOUT_MS)
                    };
                    match fetch_normalized_source(name, &url, timeout_ms, normalizer) {
                        Ok(value) => {
                            resolved = Some(value);
                            break;
                        }
                        Err(err) => errors.push(err),
                    }
                }

                match resolved {
                    Some(value) => value,
                    None => return Err(errors.join("; ")),
                }
            }
        };

    if let Some(map) = result.as_object_mut() {
        map.insert("resolvedIp".to_string(), Value::String(ip));
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_ip_directly_without_dns() {
        assert_eq!(resolve_to_ip("1.1.1.1"), "1.1.1.1");
        assert_eq!(
            resolve_to_ip("2606:4700:4700::1111"),
            "2606:4700:4700::1111"
        );
    }

    #[test]
    fn normalizes_ipinfo_response() {
        let raw = json!({
            "ip": "8.8.8.8",
            "city": "Mountain View",
            "region": "California",
            "country": "US",
            "loc": "37.4056,-122.0775",
            "org": "AS15169 Google LLC",
            "timezone": "America/Los_Angeles"
        });
        let normalized = normalize_ipinfo_info(raw).expect("valid ipinfo payload");
        assert_eq!(normalized["status"], "success");
        assert_eq!(normalized["query"], "8.8.8.8");
        assert_eq!(normalized["countryCode"], "US");
        assert_eq!(normalized["regionName"], "California");
        assert_eq!(normalized["lat"], 37.4056);
        assert_eq!(normalized["lon"], -122.0775);
    }

    #[test]
    fn normalizes_ipapi_co_and_ipsb_responses() {
        let ipapi_raw = json!({
            "ip": "1.1.1.1",
            "country_name": "Australia",
            "country_code": "AU",
            "region": "Queensland",
            "city": "Brisbane",
            "org": "Cloudflare, Inc.",
            "asn": "AS13335",
            "latitude": -27.4698,
            "longitude": 153.0251
        });
        let ipapi = normalize_ipapi_co_info(ipapi_raw).expect("valid ipapi.co payload");
        assert_eq!(ipapi["country"], "Australia");
        assert_eq!(ipapi["as"], "AS13335");

        assert!(normalize_ipapi_co_info(json!({
            "ip": "127.0.0.1",
            "error": true,
            "reason": "Reserved IP Address"
        }))
        .is_none());

        let ipsb_raw = json!({
            "ip": "9.9.9.9",
            "country": "United States",
            "country_code": "US",
            "region": "California",
            "city": "Berkeley",
            "isp": "Quad9",
            "organization": "Quad9",
            "asn": 19281,
            "latitude": 37.8716,
            "longitude": -122.2727
        });
        let ipsb = normalize_ipsb_info(ipsb_raw).expect("valid ip.sb payload");
        assert_eq!(ipsb["query"], "9.9.9.9");
        assert_eq!(ipsb["as"], "AS19281");
        assert_eq!(ipsb["isp"], "Quad9");
    }
}
