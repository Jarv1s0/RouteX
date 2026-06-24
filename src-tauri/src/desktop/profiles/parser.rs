use super::super::prelude::*;
use super::super::*;

pub(crate) fn value_name(value: &Value) -> Option<String> {
    value
        .as_object()
        .and_then(|object| object.get("name"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

pub(crate) fn array_string_values(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .filter(|item| !item.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

pub(crate) fn escape_regex_text(input: &str) -> String {
    let mut escaped = String::with_capacity(input.len());
    for ch in input.chars() {
        if matches!(
            ch,
            '\\' | '.' | '+' | '*' | '?' | '^' | '$' | '(' | ')' | '[' | ']' | '{' | '}' | '|'
        ) {
            escaped.push('\\');
        }
        escaped.push(ch);
    }
    escaped
}

pub(crate) fn can_reach(graph: &HashMap<String, HashSet<String>>, start: &str, end: &str) -> bool {
    if start == end {
        return true;
    }

    let mut queue = VecDeque::from([start.to_string()]);
    let mut visited = HashSet::from([start.to_string()]);

    while let Some(node) = queue.pop_front() {
        if node == end {
            return true;
        }

        if let Some(neighbors) = graph.get(&node) {
            for next in neighbors {
                if visited.insert(next.clone()) {
                    queue.push_back(next.clone());
                }
            }
        }
    }

    false
}

pub(crate) fn inject_chain_proxies(
    profile: &mut Value,
    app: &tauri::AppHandle,
) -> Result<(), String> {
    let chains_config = read_chains_config(app)?;
    if chains_config.items.is_empty() {
        return Ok(());
    }

    let Some(profile_object) = profile.as_object_mut() else {
        return Ok(());
    };

    let mut proxies = profile_object
        .get("proxies")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut proxy_groups = profile_object
        .get("proxy-groups")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut dependency_graph = HashMap::<String, HashSet<String>>::new();

    for group in &proxy_groups {
        let Some(group_name) = value_name(group) else {
            continue;
        };

        let neighbors = dependency_graph.entry(group_name).or_default();
        if let Some(group_object) = group.as_object() {
            for proxy_name in array_string_values(group_object.get("proxies")) {
                neighbors.insert(proxy_name);
            }
        }
    }

    for proxy in &proxies {
        let Some(proxy_object) = proxy.as_object() else {
            continue;
        };
        let Some(proxy_name) = proxy_object.get("name").and_then(Value::as_str) else {
            continue;
        };
        let Some(dialer_proxy) = proxy_object.get("dialer-proxy").and_then(Value::as_str) else {
            continue;
        };

        dependency_graph
            .entry(proxy_name.to_string())
            .or_default()
            .insert(dialer_proxy.to_string());
    }

    let mut active_chains = chains_config
        .items
        .into_iter()
        .filter(|chain| chain.enabled.unwrap_or(true))
        .filter(|chain| {
            !chain.name.trim().is_empty()
                && !chain.target_proxy.trim().is_empty()
                && !chain.dialer_proxy.trim().is_empty()
        })
        .collect::<Vec<_>>();

    if !active_chains.is_empty() {
        let chain_names = active_chains
            .iter()
            .map(|chain| escape_regex_text(&chain.name))
            .collect::<Vec<_>>()
            .join("|");

        for group in &mut proxy_groups {
            let Some(group_object) = group.as_object_mut() else {
                continue;
            };

            let has_filter = group_object
                .get("filter")
                .and_then(Value::as_str)
                .map(|value| !value.is_empty())
                .unwrap_or(false)
                || group_object
                    .get("_filter")
                    .and_then(Value::as_str)
                    .map(|value| !value.is_empty())
                    .unwrap_or(false);

            if !has_filter {
                continue;
            }

            let current_exclude = group_object
                .get("exclude-filter")
                .and_then(Value::as_str)
                .unwrap_or("");

            let next_exclude = if current_exclude.is_empty() {
                chain_names.clone()
            } else {
                format!("{current_exclude}|{chain_names}")
            };

            group_object.insert("exclude-filter".to_string(), Value::String(next_exclude));
        }
    }

    for chain in &active_chains {
        let dependencies = dependency_graph.entry(chain.name.clone()).or_default();
        dependencies.insert(chain.dialer_proxy.clone());
        dependencies.insert(chain.target_proxy.clone());
    }

    let mut safe_chains = Vec::new();
    for mut chain in active_chains.drain(..) {
        let neighbors = dependency_graph
            .get(&chain.name)
            .cloned()
            .unwrap_or_default();

        let is_self_loop = neighbors
            .iter()
            .any(|neighbor| can_reach(&dependency_graph, neighbor, &chain.name));
        if is_self_loop {
            continue;
        }

        if !chain.target_groups.is_empty() {
            let mut safe_target_groups = Vec::new();
            for group_name in &chain.target_groups {
                if can_reach(&dependency_graph, &chain.name, group_name) {
                    continue;
                }

                safe_target_groups.push(group_name.clone());
                dependency_graph
                    .entry(group_name.clone())
                    .or_default()
                    .insert(chain.name.clone());
            }
            chain.target_groups = safe_target_groups;
        }

        safe_chains.push(chain);
    }

    let builtin_names = HashSet::from([
        "DIRECT".to_string(),
        "REJECT".to_string(),
        "COMPATIBLE".to_string(),
    ]);

    for chain in safe_chains {
        proxies.retain(|proxy| value_name(proxy).as_deref() != Some(chain.name.as_str()));

        let target_proxy_config = proxies
            .iter()
            .find(|proxy| value_name(proxy).as_deref() == Some(chain.target_proxy.as_str()))
            .cloned();
        let Some(mut chain_proxy) = target_proxy_config else {
            continue;
        };

        let target_exists = proxies
            .iter()
            .any(|proxy| value_name(proxy).as_deref() == Some(chain.target_proxy.as_str()))
            || proxy_groups
                .iter()
                .any(|group| value_name(group).as_deref() == Some(chain.target_proxy.as_str()));
        if !target_exists {
            continue;
        }

        let dialer_exists = builtin_names.contains(&chain.dialer_proxy)
            || proxies
                .iter()
                .any(|proxy| value_name(proxy).as_deref() == Some(chain.dialer_proxy.as_str()))
            || proxy_groups
                .iter()
                .any(|group| value_name(group).as_deref() == Some(chain.dialer_proxy.as_str()));
        if !dialer_exists {
            continue;
        }

        if let Some(chain_proxy_object) = chain_proxy.as_object_mut() {
            chain_proxy_object.insert("name".to_string(), Value::String(chain.name.clone()));
            chain_proxy_object.insert(
                "dialer-proxy".to_string(),
                Value::String(chain.dialer_proxy.clone()),
            );
        }

        proxies.push(chain_proxy);

        for group_name in &chain.target_groups {
            let Some(target_group) = proxy_groups
                .iter_mut()
                .find(|group| value_name(group).as_deref() == Some(group_name.as_str()))
            else {
                continue;
            };

            let Some(target_group_object) = target_group.as_object_mut() else {
                continue;
            };

            let proxies_entry = target_group_object
                .entry("proxies".to_string())
                .or_insert_with(|| Value::Array(Vec::new()));
            if !proxies_entry.is_array() {
                *proxies_entry = Value::Array(Vec::new());
            }

            let Some(group_proxy_array) = proxies_entry.as_array_mut() else {
                continue;
            };

            let already_exists = group_proxy_array
                .iter()
                .any(|value| value.as_str() == Some(chain.name.as_str()));
            if !already_exists {
                group_proxy_array.push(Value::String(chain.name.clone()));
            }
        }
    }

    profile_object.insert("proxies".to_string(), Value::Array(proxies));
    profile_object.insert("proxy-groups".to_string(), Value::Array(proxy_groups));
    Ok(())
}

pub(crate) fn build_merged_name(prefix: &str, name: &str) -> String {
    format!("[{prefix}] {name}")
}

pub(crate) fn create_unique_name(base: &str, taken: &mut HashSet<String>, prefix: &str) -> String {
    if taken.insert(base.to_string()) {
        return base.to_string();
    }

    let mut index = 1;
    let mut candidate = build_merged_name(prefix, base);
    while taken.contains(&candidate) {
        index += 1;
        candidate = format!("{} ({index})", build_merged_name(prefix, base));
    }
    taken.insert(candidate.clone());
    candidate
}

pub(crate) fn is_absolute_config_path(config_path: &str) -> bool {
    let normalized = config_path.replace('\\', "/");
    normalized.starts_with('/')
        || normalized
            .chars()
            .nth(1)
            .map(|value| value == ':')
            .unwrap_or(false)
}

pub(crate) fn rewrite_provider_path(provider: &mut Value, profile_id: &str) {
    let Some(provider_object) = provider.as_object_mut() else {
        return;
    };
    let Some(path_value) = provider_object.get("path").and_then(Value::as_str) else {
        return;
    };
    if path_value.is_empty() || is_absolute_config_path(path_value) {
        return;
    }

    let normalized = path_value
        .replace('\\', "/")
        .trim_start_matches("./")
        .to_string();
    provider_object.insert(
        "path".to_string(),
        Value::String(format!("merged-profiles/{profile_id}/{normalized}")),
    );
}

pub(crate) fn map_named_reference(
    name: &str,
    proxy_name_map: &HashMap<String, String>,
    group_name_map: &HashMap<String, String>,
) -> String {
    proxy_name_map
        .get(name)
        .or_else(|| group_name_map.get(name))
        .cloned()
        .unwrap_or_else(|| name.to_string())
}

pub(crate) fn merge_profile_nodes(
    target_profile: &mut Value,
    source_profile: &Value,
    profile_id: &str,
    profile_name: &str,
) {
    let Some(target_object) = target_profile.as_object_mut() else {
        return;
    };
    let Some(source_object) = source_profile.as_object() else {
        return;
    };

    let mut target_proxies = target_object
        .get("proxies")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let target_groups = target_object
        .get("proxy-groups")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut target_proxy_providers = target_object
        .get("proxy-providers")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();

    let source_proxies = source_object
        .get("proxies")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let source_groups = source_object
        .get("proxy-groups")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let source_proxy_providers = source_object
        .get("proxy-providers")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();

    let mut proxy_names = target_proxies
        .iter()
        .filter_map(value_name)
        .collect::<HashSet<_>>();
    let group_names = target_groups
        .iter()
        .filter_map(value_name)
        .collect::<HashSet<_>>();
    let mut provider_names = target_proxy_providers
        .keys()
        .cloned()
        .collect::<HashSet<_>>();
    let builtin_names = ["DIRECT", "REJECT", "COMPATIBLE", "PASS"]
        .into_iter()
        .map(str::to_string)
        .collect::<HashSet<_>>();

    for (provider_name, provider_value) in source_proxy_providers {
        let next_provider_name =
            create_unique_name(&provider_name, &mut provider_names, profile_name);
        let mut cloned_provider = provider_value.clone();
        rewrite_provider_path(&mut cloned_provider, profile_id);
        target_proxy_providers.insert(next_provider_name, cloned_provider);
    }

    let mut group_name_map = HashMap::new();
    for group in &source_groups {
        if let Some(group_name) = value_name(group) {
            if group_names.contains(&group_name) {
                group_name_map.insert(group_name.clone(), group_name);
            }
        }
    }

    let mut proxy_name_map = HashMap::new();
    for proxy in &source_proxies {
        if let Some(proxy_name) = value_name(proxy) {
            let next_proxy_name = create_unique_name(&proxy_name, &mut proxy_names, profile_name);
            proxy_name_map.insert(proxy_name, next_proxy_name);
        }
    }

    for proxy in source_proxies {
        let mut cloned_proxy = proxy;
        let Some(proxy_object) = cloned_proxy.as_object_mut() else {
            continue;
        };

        if let Some(proxy_name) = proxy_object.get("name").and_then(Value::as_str) {
            if let Some(mapped_name) = proxy_name_map.get(proxy_name) {
                proxy_object.insert("name".to_string(), Value::String(mapped_name.clone()));
            }
        }

        if let Some(dialer_proxy) = proxy_object.get("dialer-proxy").and_then(Value::as_str) {
            let resolved = map_named_reference(dialer_proxy, &proxy_name_map, &group_name_map);
            if !builtin_names.contains(&resolved)
                && !proxy_names.contains(&resolved)
                && !group_names.contains(&resolved)
            {
                continue;
            }
            proxy_object.insert("dialer-proxy".to_string(), Value::String(resolved));
        }

        target_proxies.push(cloned_proxy);
    }

    target_object.insert("proxies".to_string(), Value::Array(target_proxies));
    target_object.insert("proxy-groups".to_string(), Value::Array(target_groups));
    target_object.insert(
        "proxy-providers".to_string(),
        Value::Object(target_proxy_providers),
    );
}

pub(crate) fn parse_profile_yaml_value(text: &str) -> Result<Value, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(json!({}));
    }

    match serde_yaml::from_str::<Value>(trimmed) {
        Ok(value) if value.as_object().is_some() => Ok(value),
        Ok(value) => Ok(subscription_text_to_profile_value(trimmed).unwrap_or(value)),
        Err(error) => subscription_text_to_profile_value(trimmed).ok_or_else(|| error.to_string()),
    }
}

fn subscription_text_to_profile_value(text: &str) -> Option<Value> {
    let lines = subscription_uri_lines(text)?;
    let mut taken_names = HashSet::new();
    let mut proxies = Vec::new();

    for line in lines {
        let Some(mut proxy) = parse_subscription_proxy_uri(&line) else {
            continue;
        };
        let Some(proxy_object) = proxy.as_object_mut() else {
            continue;
        };
        let Some(name) = proxy_object.get("name").and_then(Value::as_str) else {
            continue;
        };
        let unique_name = create_unique_name(name, &mut taken_names, "订阅");
        if unique_name != name {
            proxy_object.insert("name".to_string(), Value::String(unique_name));
        }
        proxies.push(proxy);
    }

    if proxies.is_empty() {
        return None;
    }

    let mut group_proxies = proxies.iter().filter_map(value_name).collect::<Vec<_>>();
    group_proxies.push("DIRECT".to_string());

    Some(json!({
        "proxies": proxies,
        "proxy-groups": [{
            "name": "Proxy",
            "type": "select",
            "proxies": group_proxies
        }],
        "rules": ["MATCH,Proxy"]
    }))
}

fn subscription_uri_lines(text: &str) -> Option<Vec<String>> {
    let direct = collect_subscription_uri_lines(text);
    if !direct.is_empty() {
        return Some(direct);
    }

    decode_subscription_base64(text)
        .map(|decoded| collect_subscription_uri_lines(&decoded))
        .filter(|lines| !lines.is_empty())
}

fn collect_subscription_uri_lines(text: &str) -> Vec<String> {
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .filter(|line| is_subscription_proxy_uri(line))
        .map(str::to_string)
        .collect()
}

fn decode_subscription_base64(text: &str) -> Option<String> {
    let compact = text.split_whitespace().collect::<String>();
    if compact.is_empty() {
        return None;
    }

    for decoded in [
        base64::engine::general_purpose::STANDARD.decode(compact.as_bytes()),
        base64::engine::general_purpose::STANDARD_NO_PAD.decode(compact.as_bytes()),
        base64::engine::general_purpose::URL_SAFE.decode(compact.as_bytes()),
        base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(compact.as_bytes()),
    ] {
        if let Ok(bytes) = decoded {
            if let Ok(text) = String::from_utf8(bytes) {
                return Some(text);
            }
        }
    }

    None
}

fn is_subscription_proxy_uri(line: &str) -> bool {
    matches!(
        line.split_once("://").map(|(scheme, _)| scheme),
        Some("vless" | "vmess" | "trojan" | "ss" | "ssr" | "hysteria" | "hysteria2" | "hy2")
    )
}

fn parse_subscription_proxy_uri(line: &str) -> Option<Value> {
    let (scheme, _) = line.split_once("://")?;
    match scheme {
        "vless" => parse_vless_uri(line),
        _ => None,
    }
}

fn parse_vless_uri(line: &str) -> Option<Value> {
    let url = reqwest::Url::parse(line).ok()?;
    let server = url.host_str()?.to_string();
    let query = url
        .query_pairs()
        .map(|(key, value)| (key.to_string(), value.to_string()))
        .collect::<HashMap<_, _>>();
    let security = query.get("security").map(String::as_str).unwrap_or("");
    let port = url
        .port()
        .unwrap_or(if matches!(security, "tls" | "reality") {
            443
        } else {
            80
        });
    let name = url
        .fragment()
        .and_then(|fragment| {
            urlencoding::decode(fragment)
                .ok()
                .map(|value| value.into_owned())
        })
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("{server}:{port}"));

    let mut proxy = serde_json::Map::new();
    proxy.insert("name".to_string(), Value::String(name));
    proxy.insert("type".to_string(), Value::String("vless".to_string()));
    proxy.insert("server".to_string(), Value::String(server));
    proxy.insert("port".to_string(), Value::Number(port.into()));
    proxy.insert(
        "uuid".to_string(),
        Value::String(url.username().to_string()),
    );
    proxy.insert("udp".to_string(), Value::Bool(true));

    insert_query_string(&mut proxy, &query, "type", "network");
    insert_query_string(&mut proxy, &query, "flow", "flow");
    insert_query_string(&mut proxy, &query, "sni", "servername");
    insert_query_string(&mut proxy, &query, "servername", "servername");
    insert_query_string(&mut proxy, &query, "fp", "client-fingerprint");
    insert_query_bool(&mut proxy, &query, "allowInsecure", "skip-cert-verify");
    insert_query_bool(&mut proxy, &query, "allow-insecure", "skip-cert-verify");

    if matches!(security, "tls" | "reality") || query.get("tls").is_some_and(|value| value == "1") {
        proxy.insert("tls".to_string(), Value::Bool(true));
    }

    if security == "reality" || query.contains_key("pbk") {
        let mut reality_opts = serde_json::Map::new();
        insert_query_string(&mut reality_opts, &query, "pbk", "public-key");
        insert_query_string(&mut reality_opts, &query, "sid", "short-id");
        insert_query_string(&mut reality_opts, &query, "spx", "spider-x");
        if !reality_opts.is_empty() {
            proxy.insert("reality-opts".to_string(), Value::Object(reality_opts));
        }
    }

    Some(Value::Object(proxy))
}

fn insert_query_string(
    target: &mut serde_json::Map<String, Value>,
    query: &HashMap<String, String>,
    source_key: &str,
    target_key: &str,
) {
    if let Some(value) = query
        .get(source_key)
        .filter(|value| !value.trim().is_empty())
    {
        target.insert(target_key.to_string(), Value::String(value.to_string()));
    }
}

fn insert_query_bool(
    target: &mut serde_json::Map<String, Value>,
    query: &HashMap<String, String>,
    source_key: &str,
    target_key: &str,
) {
    if let Some(value) = query
        .get(source_key)
        .and_then(|value| parse_uri_bool(value))
    {
        target.insert(target_key.to_string(), Value::Bool(value));
    }
}

fn parse_uri_bool(value: &str) -> Option<bool> {
    match value.to_ascii_lowercase().as_str() {
        "1" | "true" => Some(true),
        "0" | "false" => Some(false),
        _ => None,
    }
}

pub(crate) const JS_OVERRIDE_LOOP_ITERATION_LIMIT: u64 = 1_000_000;
pub(crate) const JS_OVERRIDE_RECURSION_LIMIT: usize = 128;

pub(crate) fn current_profile_runtime_config(app: &tauri::AppHandle) -> Result<Value, String> {
    let cache_revision = current_profile_runtime_config_revision();
    if let Some(cached) = read_cached_profile_runtime_config(cache_revision) {
        return Ok(cached);
    }

    let profile_config = read_profile_config(app)?;
    let active_ids = active_profile_ids(&profile_config);
    let current = primary_profile_id(&profile_config, &active_ids);
    let app_config = read_app_config_store(app)?;
    let control_dns = app_config
        .get("controlDns")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let control_sniff = app_config
        .get("controlSniff")
        .and_then(Value::as_bool)
        .unwrap_or(true);

    let mut profile_value = if active_ids.len() > 1 {
        let mut loaded_profiles = Vec::new();
        for profile_id in &active_ids {
            let Some(item) = get_profile_item_from_config(&profile_config, Some(profile_id)) else {
                continue;
            };
            let raw_profile = parse_profile_yaml_value(&read_profile_text(app, profile_id)?)?;
            let mut overridden_profile = raw_profile.clone();
            apply_overrides_to_profile(app, Some(profile_id), &mut overridden_profile)?;
            loaded_profiles.push((
                profile_id.clone(),
                if item.name.trim().is_empty() {
                    profile_id.clone()
                } else {
                    item.name.clone()
                },
                overridden_profile,
            ));
        }

        let primary_id = current.as_deref().unwrap_or_default();
        let primary_profile = loaded_profiles
            .iter()
            .find(|(profile_id, _, _)| profile_id == primary_id)
            .or_else(|| loaded_profiles.first())
            .map(|(_, _, profile)| profile.clone())
            .unwrap_or_else(|| json!({}));

        let mut merged_profile = primary_profile;
        for (profile_id, profile_name, profile_value) in loaded_profiles {
            if profile_id == primary_id {
                continue;
            }
            merge_profile_nodes(
                &mut merged_profile,
                &profile_value,
                &profile_id,
                &profile_name,
            );
        }
        merged_profile
    } else if let Some(profile_id) = current.as_deref() {
        let mut profile = parse_profile_yaml_value(&read_profile_text(app, profile_id)?)?;
        apply_overrides_to_profile(app, current.as_deref(), &mut profile)?;
        profile
    } else {
        json!({})
    };

    strip_profile_managed_runtime_fields(&mut profile_value);

    let mut controlled_config = read_controlled_config_store(app)?;
    if let Some(controlled_object) = controlled_config.as_object_mut() {
        if !control_dns {
            controlled_object.remove("dns");
            controlled_object.remove("hosts");
        }
        if !control_sniff {
            controlled_object.remove("sniffer");
        }
    }

    merge_json(&mut profile_value, &controlled_config);
    inject_chain_proxies(&mut profile_value, app)?;
    sanitize_runtime_profile_value(&mut profile_value, control_dns, control_sniff);
    inject_quick_rules(app, &mut profile_value)?;
    write_cached_profile_runtime_config(cache_revision, &profile_value);

    Ok(profile_value)
}

pub(crate) fn strip_profile_managed_runtime_fields(profile: &mut Value) {
    let Some(config) = profile.as_object_mut() else {
        return;
    };

    for key in [
        "port",
        "socks-port",
        "redir-port",
        "tproxy-port",
        "mixed-port",
        "external-controller",
        "external-controller-pipe",
        "external-controller-unix",
        "external-controller-cors",
        "external-ui",
        "external-ui-url",
        "authentication",
        "skip-auth-prefixes",
    ] {
        config.remove(key);
    }
}

pub(crate) fn current_runtime_value(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<Value, String> {
    let config_path = {
        let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
        runtime.config_path.clone()
    };

    if let Some(config_path) = config_path {
        let modified_at_ms = runtime_config_modified_at_ms(&config_path);
        if let Some(runtime) = state
            .runtime
            .lock()
            .map_err(|e| e.to_string())?
            .cached_runtime_config
            .clone()
        {
            if runtime.path == config_path && runtime.modified_at_ms == modified_at_ms {
                return Ok(runtime.value);
            }
        }

        if config_path.exists() {
            let text = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
            let yaml = serde_yaml::from_str::<Value>(&text).map_err(|e| e.to_string())?;

            let mut runtime = state.runtime.lock().map_err(|e| e.to_string())?;
            if runtime.config_path.as_ref() == Some(&config_path) {
                runtime.cached_runtime_config = Some(CachedRuntimeConfig {
                    path: config_path,
                    modified_at_ms,
                    value: yaml.clone(),
                });
            }

            return Ok(yaml);
        }
    }

    current_profile_runtime_config(app)
}

pub(crate) fn current_runtime_value_for_renderer(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<Value, String> {
    let mut value = current_runtime_value(app, state)?;

    let Some(object) = value.as_object_mut() else {
        return Ok(value);
    };

    match configured_external_controller_address(Some(&read_controlled_config_store(app)?)) {
        Some(external_controller) => {
            object.insert(
                "external-controller".to_string(),
                Value::String(external_controller),
            );
        }
        None => {
            object.remove("external-controller");
        }
    }

    Ok(value)
}
