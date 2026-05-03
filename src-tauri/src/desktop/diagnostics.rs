fn http_client_with_timeout(timeout_ms: u64) -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| e.to_string())
}

fn http_get_response(
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

fn http_get_json(url: &str, timeout_ms: u64) -> Result<Value, String> {
    let (status, body, _) = http_get_response(url, timeout_ms)?;
    if !status.is_success() {
        return Err(format!("HTTP 请求失败: {}", status));
    }

    serde_json::from_str::<Value>(&body).map_err(|e| e.to_string())
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

fn ip_info_result(
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
) -> Value {
    json!({
        "status": "success",
        "query": query,
        "country": country,
        "countryCode": country_code,
        "region": "",
        "regionName": region_name,
        "city": city,
        "zip": "",
        "lat": lat,
        "lon": lon,
        "timezone": timezone,
        "isp": isp,
        "org": org,
        "as": asn,
    })
}

fn normalize_ipapi_info(value: Value) -> Option<Value> {
    let query = value_string(&value, &["ip"]);
    if query.is_empty() {
        return None;
    }

    let org = value_string(&value, &["org"]);
    let asn = value_string(&value, &["asn"]);

    Some(ip_info_result(
        query,
        value_string(&value, &["country_name", "country"]),
        value_string(&value, &["country_code"]),
        value_string(&value, &["region"]),
        value_string(&value, &["city"]),
        value_string(&value, &["timezone"]),
        org.clone(),
        org,
        asn,
        value_number(&value, &["latitude", "lat"]),
        value_number(&value, &["longitude", "lon"]),
    ))
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
            let lat = parts.next()?.parse::<f64>().ok()?;
            let lon = parts.next()?.parse::<f64>().ok()?;
            Some((Value::from(lat), Value::from(lon)))
        })
        .unwrap_or((Value::Null, Value::Null));

    let org = value_string(&value, &["org"]);

    Some(ip_info_result(
        query,
        value_string(&value, &["country"]),
        value_string(&value, &["country"]),
        value_string(&value, &["region"]),
        value_string(&value, &["city"]),
        value_string(&value, &["timezone"]),
        org.clone(),
        org.clone(),
        org,
        lat,
        lon,
    ))
}

fn normalize_ipip_info(value: Value) -> Option<Value> {
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

    Some(ip_info_result(
        query,
        country,
        String::new(),
        region,
        city,
        String::new(),
        isp.clone(),
        isp.clone(),
        isp,
        Value::Null,
        Value::Null,
    ))
}

fn normalize_cloudflare_trace(body: String) -> Option<Value> {
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

    Some(ip_info_result(
        query,
        trace
            .get("loc")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        trace
            .get("loc")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        trace
            .get("colo")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        String::new(),
        String::new(),
        "Cloudflare".to_string(),
        value_string(&Value::Object(trace.clone()), &["colo"]),
        value_string(&Value::Object(trace), &["fl"]),
        Value::Null,
        Value::Null,
    ))
}

fn http_post_json(url: &str, body: &Value, timeout_ms: u64) -> Result<Value, String> {
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

fn resolve_to_ip(query: &str) -> String {
    if query.parse::<std::net::IpAddr>().is_ok() {
        return query.to_string();
    }

    format!("{query}:80")
        .to_socket_addrs()
        .ok()
        .and_then(|mut addrs| addrs.next().map(|addr| addr.ip().to_string()))
        .unwrap_or_else(|| query.to_string())
}

fn fetch_ip_info_current() -> Result<Value, String> {
    let mut errors = Vec::new();

    match http_get_json(
        "http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query",
        10_000,
    ) {
        Ok(value)
            if value
                .get("status")
                .and_then(Value::as_str)
                .is_some_and(|status| status == "success")
                && value.get("query").and_then(Value::as_str).is_some() =>
        {
            return Ok(value);
        }
        Ok(value) => errors.push(format!(
            "ip-api: {}",
            value
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("响应无有效 IP")
        )),
        Err(error) => errors.push(format!("ip-api: {error}")),
    }

    match http_get_json("https://ipapi.co/json/", 10_000)
        .ok()
        .and_then(normalize_ipapi_info)
    {
        Some(value) => return Ok(value),
        None => errors.push("ipapi.co: 响应无有效 IP".to_string()),
    }

    match http_get_json("https://ipinfo.io/json", 10_000)
        .ok()
        .and_then(normalize_ipinfo_info)
    {
        Some(value) => return Ok(value),
        None => errors.push("ipinfo.io: 响应无有效 IP".to_string()),
    }

    match http_get_json("https://myip.ipip.net/json", 10_000)
        .ok()
        .and_then(normalize_ipip_info)
    {
        Some(value) => return Ok(value),
        None => errors.push("IPIP.net: 响应无有效 IP".to_string()),
    }

    match http_get_response("https://1.1.1.1/cdn-cgi/trace", 10_000) {
        Ok((status, body, _)) if status.is_success() => {
            if let Some(value) = normalize_cloudflare_trace(body) {
                return Ok(value);
            }
            errors.push("Cloudflare: 响应无有效 IP".to_string());
        }
        Ok((status, _, _)) => errors.push(format!("Cloudflare: HTTP 请求失败: {status}")),
        Err(error) => errors.push(format!("Cloudflare: {error}")),
    }

    Ok(json!({
        "status": "fail",
        "message": format!("IP 信息获取失败: {}", errors.join("; ")),
    }))
}

fn fetch_ip_info_query(query: &str) -> Result<Value, String> {
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

fn fetch_batch_ip_info(queries: &[IpInfoQueryInput]) -> Result<Value, String> {
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

fn http_get_value(url: &str, timeout_ms: u64) -> Result<Value, String> {
    let (status, data, headers) = http_get_response(url, timeout_ms)?;
    Ok(json!({
        "status": status.as_u16(),
        "data": data,
        "headers": headers,
    }))
}

fn test_connectivity_value(url: &str, timeout_ms: u64) -> Value {
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

fn build_group_children(
    proxies_map: &serde_json::Map<String, Value>,
    all_names: &[Value],
    icon_map: &serde_json::Map<String, Value>,
) -> Vec<Value> {
    all_names
        .iter()
        .filter_map(Value::as_str)
        .filter_map(|name| {
            proxies_map.get(name).map(|proxy| {
                let mut cloned = proxy.clone();
                if let Some(icon) = icon_map.get(name) {
                    if let Some(object) = cloned.as_object_mut() {
                        object.insert("icon".to_string(), icon.clone());
                    }
                }
                cloned
            })
        })
        .collect()
}

fn build_mihomo_groups_value(proxies: &Value, runtime: &Value) -> Value {
    let mode = runtime
        .get("mode")
        .and_then(Value::as_str)
        .unwrap_or("rule");
    if mode == "direct" {
        return Value::Array(vec![]);
    }

    let proxy_groups = runtime
        .get("proxy-groups")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let proxies_map = proxies
        .get("proxies")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let mut icon_map = serde_json::Map::new();
    for group in &proxy_groups {
        if let Some(name) = group.get("name").and_then(Value::as_str) {
            if let Some(icon) = group.get("icon") {
                icon_map.insert(name.to_string(), icon.clone());
            }
        }
    }

    let mut groups = Vec::new();
    for group in &proxy_groups {
        let Some(name) = group.get("name").and_then(Value::as_str) else {
            continue;
        };

        let Some(proxy_group) = proxies_map.get(name) else {
            continue;
        };
        let Some(proxy_object) = proxy_group.as_object() else {
            continue;
        };
        if proxy_object
            .get("hidden")
            .and_then(Value::as_bool)
            .unwrap_or(false)
        {
            continue;
        }
        let Some(all_names) = proxy_object.get("all").and_then(Value::as_array) else {
            continue;
        };

        let mut new_group = proxy_group.clone();
        if let Some(object) = new_group.as_object_mut() {
            if let Some(url) = group.get("url") {
                object.insert("testUrl".to_string(), url.clone());
            }
            if let Some(icon) = group.get("icon") {
                object.insert("icon".to_string(), icon.clone());
            }
            object.insert(
                "all".to_string(),
                Value::Array(build_group_children(&proxies_map, all_names, &icon_map)),
            );
        }

        groups.push(new_group);
    }

    if !groups
        .iter()
        .any(|group| group.get("name").and_then(Value::as_str) == Some("GLOBAL"))
    {
        if let Some(global) = proxies_map.get("GLOBAL").and_then(Value::as_object) {
            if !global
                .get("hidden")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                let mut value = Value::Object(global.clone());
                if let Some(all_names) = global.get("all").and_then(Value::as_array) {
                    if let Some(object) = value.as_object_mut() {
                        object.insert(
                            "all".to_string(),
                            Value::Array(build_group_children(&proxies_map, all_names, &icon_map)),
                        );
                    }
                }
                groups.push(value);
            }
        }
    }

    if mode == "global" {
        if let Some(index) = groups
            .iter()
            .position(|group| group.get("name").and_then(Value::as_str) == Some("GLOBAL"))
        {
            let global = groups.remove(index);
            groups.insert(0, global);
        }
    }

    Value::Array(groups)
}

fn extract_domain(input: &str) -> String {
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

fn test_rule_match_value(
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
    let _ = client.get(target_url).send();

    std::thread::sleep(Duration::from_millis(500));

    let target_domain = extract_domain(domain).to_lowercase();
    let connections = core_request(state, reqwest::Method::GET, "/connections", None, None)?;
    let items = connections
        .get("connections")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    for item in items {
        let host = item
            .get("metadata")
            .and_then(Value::as_object)
            .and_then(|meta| meta.get("host"))
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_lowercase();
        if host != target_domain && !host.ends_with(&format!(".{target_domain}")) {
            continue;
        }

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

fn check_streaming_unlock(service: &str) -> Result<Value, String> {
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
            if status == reqwest::StatusCode::FORBIDDEN {
                json!({ "status": "locked" })
            } else if body.contains("not available")
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

fn resolve_runtime_file_path(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw_path);
    if path.is_absolute() {
        return Ok(path);
    }

    let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    if let Some(work_dir) = runtime.work_dir.as_ref() {
        return Ok(work_dir.join(raw_path));
    }
    drop(runtime);

    Ok(storage_dir(app, RUNTIME_DIR_NAME)?.join(raw_path))
}

fn read_runtime_text(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
) -> Result<String, String> {
    let path = resolve_runtime_file_path(app, state, raw_path)?;
    if !path.exists() {
        return Ok(String::new());
    }

    fs::read_to_string(path).map_err(|e| e.to_string())
}

fn write_runtime_text(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
    content: &str,
) -> Result<(), String> {
    let path = resolve_runtime_file_path(app, state, raw_path)?;
    ensure_parent(&path)?;
    fs::write(path, content).map_err(|e| e.to_string())
}

