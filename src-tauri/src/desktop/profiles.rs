const DEFAULT_SUBSCRIPTION_USER_AGENT: &str = "clash.meta/alpha-e89af72";
const DEFAULT_REMOTE_PROFILE_NAME: &str = "Subscribe";
const DEFAULT_LOCAL_PROFILE_NAME: &str = "本地配置";

fn non_empty_trimmed(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

fn resolve_remote_user_agent(
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

fn fetch_remote_text(
    app: &tauri::AppHandle,
    url: &str,
    user_agent: Option<&str>,
) -> Result<String, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("远程地址不能为空".to_string());
    }
    if trimmed.starts_with('/') {
        return Err("Tauri 宿主暂不支持相对远程地址".to_string());
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(trimmed)
        .header(
            reqwest::header::USER_AGENT,
            resolve_remote_user_agent(app, user_agent)?,
        )
        .send()
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("请求失败: {}", response.status()));
    }

    response.text().map_err(|e| e.to_string())
}

fn guess_name_from_url(url: &str, fallback: &str) -> String {
    let parsed = reqwest::Url::parse(url).ok();
    let Some(parsed) = parsed else {
        return fallback.to_string();
    };

    let Some(name) = parsed
        .path_segments()
        .and_then(|segments| segments.filter(|segment| !segment.is_empty()).last())
    else {
        return fallback.to_string();
    };

    urlencoding::decode(name)
        .map(|value| value.into_owned())
        .unwrap_or_else(|_| name.to_string())
}

fn is_generic_subscription_name(name: &str) -> bool {
    let normalized = name.trim().to_ascii_lowercase();
    let normalized = normalized
        .trim_end_matches(".yaml")
        .trim_end_matches(".yml")
        .trim_end_matches(".txt");

    matches!(normalized, "subscribe" | "subscription" | "sub")
}

fn default_remote_profile_name(url: Option<&str>) -> String {
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

fn get_profile_item_from_config(
    config: &ProfileConfigData,
    id: Option<&str>,
) -> Option<ProfileItemData> {
    id.and_then(|target| config.items.iter().find(|item| item.id == target).cloned())
}

fn current_profile_item(app: &tauri::AppHandle) -> Result<ProfileItemData, String> {
    let config = read_profile_config(app)?;
    Ok(
        get_profile_item_from_config(&config, config.current.as_deref())
            .unwrap_or_else(default_empty_profile_item),
    )
}

fn build_profile_item(
    item: ProfileItemInput,
    existing: Option<&ProfileItemData>,
    content_written: bool,
) -> ProfileItemData {
    let id = item
        .id
        .clone()
        .or_else(|| existing.map(|value| value.id.clone()))
        .unwrap_or_else(create_id);
    let item_type = item
        .item_type
        .clone()
        .or_else(|| existing.map(|value| value.item_type.clone()))
        .unwrap_or_else(|| "local".to_string());
    let default_name = if item_type == "remote" {
        DEFAULT_REMOTE_PROFILE_NAME
    } else {
        DEFAULT_LOCAL_PROFILE_NAME
    };

    ProfileItemData {
        id,
        item_type,
        name: item
            .name
            .clone()
            .or_else(|| existing.map(|value| value.name.clone()))
            .unwrap_or_else(|| default_name.to_string()),
        url: item
            .url
            .clone()
            .or_else(|| existing.and_then(|value| value.url.clone())),
        fingerprint: item
            .fingerprint
            .clone()
            .or_else(|| existing.and_then(|value| value.fingerprint.clone())),
        ua: item
            .ua
            .clone()
            .or_else(|| existing.and_then(|value| value.ua.clone())),
        file: if content_written {
            None
        } else {
            item.file
                .clone()
                .or_else(|| existing.and_then(|value| value.file.clone()))
        },
        verify: item
            .verify
            .or_else(|| existing.and_then(|value| value.verify)),
        interval: item
            .interval
            .or_else(|| existing.and_then(|value| value.interval)),
        home: item
            .home
            .clone()
            .or_else(|| existing.and_then(|value| value.home.clone())),
        updated: Some(if content_written {
            current_timestamp_ms()
        } else {
            item.updated.unwrap_or_else(current_timestamp_ms)
        }),
        override_ids: item
            .override_ids
            .clone()
            .or_else(|| existing.and_then(|value| value.override_ids.clone())),
        use_proxy: item
            .use_proxy
            .or_else(|| existing.and_then(|value| value.use_proxy)),
        extra: item
            .extra
            .clone()
            .or_else(|| existing.and_then(|value| value.extra.clone())),
        reset_day: item
            .reset_day
            .or_else(|| existing.and_then(|value| value.reset_day)),
        locked: item
            .locked
            .or_else(|| existing.and_then(|value| value.locked)),
        auto_update: item
            .auto_update
            .or_else(|| existing.and_then(|value| value.auto_update))
            .or(Some(true)),
    }
}

fn add_or_replace_profile_item(
    app: &tauri::AppHandle,
    item: ProfileItemInput,
) -> Result<(), String> {
    let mut config = read_profile_config(app)?;
    let existing_index = item
        .id
        .as_ref()
        .and_then(|id| config.items.iter().position(|value| value.id == *id));
    let existing = existing_index.and_then(|index| config.items.get(index).cloned());

    let id = item
        .id
        .clone()
        .or_else(|| existing.as_ref().map(|value| value.id.clone()))
        .unwrap_or_else(create_id);
    let item_type = item
        .item_type
        .clone()
        .or_else(|| existing.as_ref().map(|value| value.item_type.clone()))
        .unwrap_or_else(|| "local".to_string());

    let content = if item_type == "remote" {
        let url = item
            .url
            .clone()
            .or_else(|| existing.as_ref().and_then(|value| value.url.clone()))
            .ok_or_else(|| "远程配置缺少 URL".to_string())?;
        let content = fetch_remote_text(
            app,
            &url,
            item.ua
                .as_deref()
                .or_else(|| existing.as_ref().and_then(|value| value.ua.as_deref())),
        )?;
        Some(content)
    } else {
        item.file.clone()
    };

    if let Some(content) = content.as_deref() {
        write_profile_text(app, &id, content)?;
    }

    let mut next_item = build_profile_item(item.clone(), existing.as_ref(), content.is_some());
    next_item.id = id.clone();

    if next_item.name.is_empty() {
        next_item.name = if next_item.item_type == "remote" {
            default_remote_profile_name(next_item.url.as_deref())
        } else {
            DEFAULT_LOCAL_PROFILE_NAME.to_string()
        };
    }

    if let Some(index) = existing_index {
        config.items[index] = next_item;
    } else {
        config.items.push(next_item);
    }

    if config.current.is_none() {
        config.current = Some(id.clone());
        config.actives = Some(vec![id]);
    }

    write_profile_config(app, &config)
}

fn update_profile_item_store(app: &tauri::AppHandle, item: ProfileItemData) -> Result<(), String> {
    let mut config = read_profile_config(app)?;
    let Some(index) = config.items.iter().position(|value| value.id == item.id) else {
        return Err("Profile not found".to_string());
    };
    config.items[index] = item;
    write_profile_config(app, &config)
}

fn change_current_profile_store(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
    let config = read_profile_config(app)?;
    let mut next_actives = config.actives.unwrap_or_default();
    if !next_actives.iter().any(|value| value == id) {
        next_actives.insert(0, id.to_string());
    }

    let next = ProfileConfigData {
        current: Some(id.to_string()),
        actives: Some(next_actives),
        items: config.items,
    };
    write_profile_config(app, &next)
}

fn set_active_profiles_store(
    app: &tauri::AppHandle,
    ids: &[String],
    current: Option<&str>,
) -> Result<(), String> {
    let config = read_profile_config(app)?;
    let valid_ids = config
        .items
        .iter()
        .map(|item| item.id.clone())
        .collect::<HashSet<_>>();

    let mut actives = dedupe_ids(ids.iter().cloned())
        .into_iter()
        .filter(|id| valid_ids.contains(id))
        .collect::<Vec<_>>();

    if actives.is_empty() {
        if let Some(fallback) = current
            .filter(|value| valid_ids.contains(*value))
            .map(str::to_string)
            .or_else(|| {
                config
                    .current
                    .as_ref()
                    .filter(|value| valid_ids.contains(*value))
                    .cloned()
            })
            .or_else(|| config.items.first().map(|item| item.id.clone()))
        {
            actives.push(fallback);
        }
    }

    let next_current = current
        .filter(|value| valid_ids.contains(*value))
        .map(str::to_string)
        .or_else(|| actives.first().cloned());

    let next = ProfileConfigData {
        current: next_current,
        actives: Some(actives),
        items: config.items,
    };
    write_profile_config(app, &next)
}

fn remove_profile_item_store(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
    let mut config = read_profile_config(app)?;
    config.items.retain(|item| item.id != id);

    if config.current.as_deref() == Some(id) {
        config.current = config.items.first().map(|item| item.id.clone());
    }

    if let Some(actives) = config.actives.as_mut() {
        actives.retain(|active| active != id);
    }

    let path = profile_file_path(app, id)?;
    if path.exists() {
        let _ = fs::remove_file(path);
    }

    write_profile_config(app, &config)
}

fn remove_override_reference_store(app: &tauri::AppHandle, id: &str) -> Result<bool, String> {
    let mut config = read_profile_config(app)?;
    let active_ids = active_profile_ids(&config)
        .into_iter()
        .collect::<HashSet<_>>();
    let mut current_profile_modified = false;
    let mut any_profile_modified = false;

    for profile in &mut config.items {
        let Some(existing_override_ids) = profile.override_ids.take() else {
            continue;
        };

        let original_len = existing_override_ids.len();
        let filtered_override_ids = existing_override_ids
            .into_iter()
            .filter(|override_id| override_id != id)
            .collect::<Vec<_>>();

        if !filtered_override_ids.is_empty() {
            profile.override_ids = Some(filtered_override_ids);
        }

        let next_len = profile
            .override_ids
            .as_ref()
            .map(|override_ids| override_ids.len())
            .unwrap_or(0);

        if next_len != original_len {
            any_profile_modified = true;
            if active_ids.contains(&profile.id) {
                current_profile_modified = true;
            }
        }
    }

    if any_profile_modified {
        write_profile_config(app, &config)?;
    }

    Ok(current_profile_modified)
}

fn add_or_replace_override_item(
    app: &tauri::AppHandle,
    item: OverrideItemInput,
) -> Result<(), String> {
    let mut config = read_override_config(app)?;
    let existing_index = item
        .id
        .as_ref()
        .and_then(|id| config.items.iter().position(|value| value.id == *id));
    let existing = existing_index.and_then(|index| config.items.get(index).cloned());

    let id = item
        .id
        .clone()
        .or_else(|| existing.as_ref().map(|value| value.id.clone()))
        .unwrap_or_else(create_id);
    let item_type = item
        .item_type
        .clone()
        .or_else(|| existing.as_ref().map(|value| value.item_type.clone()))
        .unwrap_or_else(|| "local".to_string());
    let ext = item
        .ext
        .clone()
        .or_else(|| existing.as_ref().map(|value| value.ext.clone()))
        .unwrap_or_else(|| "yaml".to_string());

    let content = if item_type == "remote" {
        let url = item
            .url
            .clone()
            .or_else(|| existing.as_ref().and_then(|value| value.url.clone()))
            .ok_or_else(|| "远程覆写缺少 URL".to_string())?;
        Some(fetch_remote_text(app, &url, None)?)
    } else {
        item.file.clone()
    };

    if let Some(content) = content.as_deref() {
        write_override_text(app, &id, &ext, content)?;
    }

    let mut next_item = OverrideItemData {
        id: id.clone(),
        item_type,
        ext: ext.clone(),
        name: item
            .name
            .clone()
            .or_else(|| existing.as_ref().map(|value| value.name.clone()))
            .unwrap_or_else(|| {
                if item.item_type.as_deref() == Some("remote") {
                    item.url
                        .as_deref()
                        .map(|url| guess_name_from_url(url, "Remote File"))
                        .unwrap_or_else(|| "Remote File".to_string())
                } else {
                    "Local File".to_string()
                }
            }),
        updated: current_timestamp_ms(),
        global: item
            .global
            .or_else(|| existing.as_ref().and_then(|value| value.global)),
        url: item
            .url
            .clone()
            .or_else(|| existing.as_ref().and_then(|value| value.url.clone())),
        file: if content.is_some() {
            None
        } else {
            item.file
                .clone()
                .or_else(|| existing.as_ref().and_then(|value| value.file.clone()))
        },
        fingerprint: item.fingerprint.clone().or_else(|| {
            existing
                .as_ref()
                .and_then(|value| value.fingerprint.clone())
        }),
    };

    if next_item.name.is_empty() {
        next_item.name = "Local File".to_string();
    }

    if let Some(index) = existing_index {
        config.items[index] = next_item;
    } else {
        config.items.push(next_item);
    }

    write_override_config(app, &config)
}

fn update_override_item_store(
    app: &tauri::AppHandle,
    item: OverrideItemData,
) -> Result<(), String> {
    let mut config = read_override_config(app)?;
    let Some(index) = config.items.iter().position(|value| value.id == item.id) else {
        return Err("Override not found".to_string());
    };
    config.items[index] = item;
    write_override_config(app, &config)
}

fn remove_override_item_store(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
    let mut config = read_override_config(app)?;
    let removed = config.items.iter().find(|item| item.id == id).cloned();
    config.items.retain(|item| item.id != id);
    write_override_config(app, &config)?;

    if let Some(item) = removed {
        let path = override_file_path(app, id, &item.ext)?;
        if path.exists() {
            let _ = fs::remove_file(path);
        }

        let rollback_path = override_rollback_path(app, id, &item.ext)?;
        if rollback_path.exists() {
            let _ = fs::remove_file(rollback_path);
        }
    }

    Ok(())
}

fn restart_core_and_emit(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    let value = restart_core_process(app, state, None)?;
    emit_ipc_event(app, "core-started", value);
    emit_ipc_event(app, "groupsUpdated", Value::Null);
    emit_ipc_event(app, "rulesUpdated", Value::Null);
    Ok(())
}

fn add_chain_item_store(
    app: &tauri::AppHandle,
    item: ChainItemInput,
) -> Result<ChainItemData, String> {
    let mut config = read_chains_config(app)?;
    let id = item.id.clone().unwrap_or_else(create_id);
    let chain = ChainItemData {
        id: id.clone(),
        name: item.name.unwrap_or_else(|| "新建代理链".to_string()),
        dialer_proxy: item.dialer_proxy.unwrap_or_default(),
        target_proxy: item.target_proxy.unwrap_or_default(),
        target_groups: item.target_groups.unwrap_or_default(),
        enabled: item.enabled.or(Some(true)),
    };

    if let Some(index) = config.items.iter().position(|value| value.id == id) {
        config.items[index] = chain.clone();
    } else {
        config.items.push(chain.clone());
    }

    write_chains_config(app, &config)?;
    Ok(chain)
}

fn update_chain_item_store(app: &tauri::AppHandle, item: ChainItemData) -> Result<(), String> {
    let mut config = read_chains_config(app)?;
    let Some(index) = config.items.iter().position(|value| value.id == item.id) else {
        return Err("Chain not found".to_string());
    };
    config.items[index] = item;
    write_chains_config(app, &config)
}

fn remove_chain_item_store(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
    let mut config = read_chains_config(app)?;
    config.items.retain(|value| value.id != id);
    write_chains_config(app, &config)
}

fn current_override_profile_text(app: &tauri::AppHandle) -> Result<String, String> {
    let profile_config = read_profile_config(app)?;
    let override_config = read_override_config(app)?;
    let mut ids = override_config
        .items
        .iter()
        .filter(|item| item.global.unwrap_or(false))
        .map(|item| item.id.clone())
        .collect::<Vec<_>>();

    if let Some(current_profile) =
        get_profile_item_from_config(&profile_config, profile_config.current.as_deref())
    {
        if let Some(profile_override_ids) = current_profile.override_ids {
            for id in profile_override_ids {
                if !ids.contains(&id) {
                    ids.push(id);
                }
            }
        }
    }

    let mut blocks = Vec::new();
    for id in ids {
        if let Some(item) = override_config.items.iter().find(|item| item.id == id) {
            let text = read_override_text(app, &item.id, &item.ext)?;
            if !text.trim().is_empty() {
                blocks.push(text);
            }
        }
    }

    Ok(blocks.join("\n\n"))
}

fn value_name(value: &Value) -> Option<String> {
    value
        .as_object()
        .and_then(|object| object.get("name"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn array_string_values(value: Option<&Value>) -> Vec<String> {
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

fn escape_regex_text(input: &str) -> String {
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

fn can_reach(graph: &HashMap<String, HashSet<String>>, start: &str, end: &str) -> bool {
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

fn inject_chain_proxies(profile: &mut Value, app: &tauri::AppHandle) -> Result<(), String> {
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

fn active_profile_ids(config: &ProfileConfigData) -> Vec<String> {
    let mut ids = config.actives.clone().unwrap_or_default();
    ids.retain(|id| !id.trim().is_empty());
    ids.dedup();
    if ids.is_empty() {
        if let Some(current) = config
            .current
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            ids.push(current.clone());
        }
    }
    ids
}

fn primary_profile_id(config: &ProfileConfigData, active_ids: &[String]) -> Option<String> {
    if let Some(current) = config.current.as_ref() {
        if active_ids.iter().any(|id| id == current) {
            return Some(current.clone());
        }
    }
    active_ids.first().cloned()
}

fn build_merged_name(prefix: &str, name: &str) -> String {
    format!("[{prefix}] {name}")
}

fn create_unique_name(base: &str, taken: &mut HashSet<String>, prefix: &str) -> String {
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

fn is_absolute_config_path(config_path: &str) -> bool {
    let normalized = config_path.replace('\\', "/");
    normalized.starts_with('/')
        || normalized
            .chars()
            .nth(1)
            .map(|value| value == ':')
            .unwrap_or(false)
}

fn rewrite_provider_path(provider: &mut Value, profile_id: &str) {
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

fn map_named_reference(
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

fn merge_profile_nodes(
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


fn parse_profile_yaml_value(text: &str) -> Result<Value, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(json!({}));
    }

    serde_yaml::from_str::<Value>(trimmed).map_err(|e| e.to_string())
}

const JS_OVERRIDE_LOOP_ITERATION_LIMIT: u64 = 1_000_000;
const JS_OVERRIDE_RECURSION_LIMIT: usize = 128;

fn write_override_exec_log(app: &tauri::AppHandle, id: &str, message: &str) -> Result<(), String> {
    let path = override_file_path(app, id, "log")?;
    ensure_parent(&path)?;
    fs::write(path, message).map_err(|e| e.to_string())
}

fn run_override_script(script: &str, profile: &Value) -> Result<Value, String> {
    let profile_json = serde_json::to_string(profile).map_err(|e| e.to_string())?;
    let wrapped_script = format!(
        r#"
(function() {{
  const __ROUTEX_CONFIG__ = {profile_json};
{script}
  if (typeof main !== "function") {{
    throw new Error("JS 覆写必须定义 main(config) 函数");
  }}
  const __ROUTEX_RESULT__ = main(__ROUTEX_CONFIG__);
  if (__ROUTEX_RESULT__ === null || typeof __ROUTEX_RESULT__ !== "object" || Array.isArray(__ROUTEX_RESULT__)) {{
    throw new Error("JS 覆写 main(config) 必须返回对象");
  }}
  return JSON.stringify(__ROUTEX_RESULT__);
}})()
"#
    );

    let mut context = JsContext::default();
    context
        .runtime_limits_mut()
        .set_loop_iteration_limit(JS_OVERRIDE_LOOP_ITERATION_LIMIT);
    context
        .runtime_limits_mut()
        .set_recursion_limit(JS_OVERRIDE_RECURSION_LIMIT);
    let result = context
        .eval(JsSource::from_bytes(&wrapped_script))
        .map_err(|e| format!("JS 覆写执行失败: {e}"))?;
    let result_text = result
        .to_string(&mut context)
        .map_err(|e| format!("JS 覆写返回值转换失败: {e}"))?
        .to_std_string_escaped();
    let value = serde_json::from_str::<Value>(&result_text)
        .map_err(|e| format!("JS 覆写返回值不是有效 JSON: {e}"))?;
    if !value.is_object() {
        return Err("JS 覆写 main(config) 必须返回对象".to_string());
    }
    Ok(value)
}

fn apply_js_override(
    app: &tauri::AppHandle,
    item: &OverrideItemData,
    text: &str,
    profile: &mut Value,
) -> Result<(), String> {
    match run_override_script(text, profile) {
        Ok(next_profile) => {
            *profile = next_profile;
            let _ = write_override_exec_log(app, &item.id, "JS 覆写执行成功");
            Ok(())
        }
        Err(error) => {
            let message = format!("{}: {}", item.name, error);
            let _ = write_override_exec_log(app, &item.id, &message);
            Err(message)
        }
    }
}

fn apply_overrides_to_profile(
    app: &tauri::AppHandle,
    profile_id: Option<&str>,
    profile: &mut Value,
) -> Result<(), String> {
    let override_config = read_override_config(app)?;
    let mut ids = override_config
        .items
        .iter()
        .filter(|item| item.global.unwrap_or(false))
        .map(|item| item.id.clone())
        .collect::<Vec<_>>();

    if let Some(current_profile) =
        get_profile_item_from_config(&read_profile_config(app)?, profile_id)
    {
        if let Some(profile_override_ids) = current_profile.override_ids {
            for id in profile_override_ids {
                if !ids.contains(&id) {
                    ids.push(id);
                }
            }
        }
    }

    for id in ids {
        let Some(item) = override_config.items.iter().find(|item| item.id == id) else {
            continue;
        };
        let text = read_override_text(app, &item.id, &item.ext)?;
        if text.trim().is_empty() {
            continue;
        }

        match item.ext.as_str() {
            "yaml" => {
                let patch = parse_profile_yaml_value(&text)?;
                merge_config_value(profile, &patch, true);
            }
            "js" => apply_js_override(app, item, &text, profile)?,
            _ => return Err(format!("不支持的覆写文件类型: {}", item.ext)),
        }
    }

    Ok(())
}

fn current_profile_runtime_config(app: &tauri::AppHandle) -> Result<Value, String> {
    if let Some(cached) = read_cached_profile_runtime_config() {
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

    inject_quick_rules(app, current.as_deref(), &mut profile_value)?;
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
    write_cached_profile_runtime_config(&profile_value);

    Ok(profile_value)
}

fn strip_profile_managed_runtime_fields(profile: &mut Value) {
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

fn current_runtime_value(
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

fn current_runtime_value_for_renderer(
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

