use super::super::prelude::*;
use super::super::*;

pub(crate) fn get_profile_item_from_config(
    config: &ProfileConfigData,
    id: Option<&str>,
) -> Option<ProfileItemData> {
    id.and_then(|target| config.items.iter().find(|item| item.id == target).cloned())
}

fn profile_affects_runtime(config: &ProfileConfigData, id: &str) -> bool {
    let active_ids = active_profile_ids(config);
    active_ids.is_empty() || active_ids.iter().any(|active_id| active_id == id)
}

fn active_profiles_reference_override(config: &ProfileConfigData, override_id: &str) -> bool {
    let active_ids = active_profile_ids(config)
        .into_iter()
        .collect::<HashSet<_>>();

    config.items.iter().any(|profile| {
        active_ids.contains(&profile.id)
            && profile
                .override_ids
                .as_ref()
                .is_some_and(|override_ids| override_ids.iter().any(|id| id == override_id))
    })
}

pub(crate) fn current_profile_item(app: &tauri::AppHandle) -> Result<ProfileItemData, String> {
    let config = read_profile_config(app)?;
    Ok(
        get_profile_item_from_config(&config, config.current.as_deref())
            .unwrap_or_else(default_empty_profile_item),
    )
}

pub(crate) fn build_profile_item(
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

pub(crate) fn add_or_replace_profile_item(
    app: &tauri::AppHandle,
    item: ProfileItemInput,
) -> Result<bool, String> {
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
    let runtime_profile_affected = profile_affects_runtime(&config, &id);
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

    write_profile_config(app, &config)?;
    Ok(runtime_profile_affected)
}

pub(crate) fn update_profile_item_store(
    app: &tauri::AppHandle,
    item: ProfileItemData,
) -> Result<bool, String> {
    let mut config = read_profile_config(app)?;
    let Some(index) = config.items.iter().position(|value| value.id == item.id) else {
        return Err("Profile not found".to_string());
    };
    let runtime_profile_affected = profile_affects_runtime(&config, &item.id);
    config.items[index] = item;
    write_profile_config(app, &config)?;
    Ok(runtime_profile_affected)
}

pub(crate) fn change_current_profile_store(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
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

pub(crate) fn set_active_profiles_store(
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

pub(crate) fn remove_profile_item_store(app: &tauri::AppHandle, id: &str) -> Result<bool, String> {
    let mut config = read_profile_config(app)?;
    let runtime_profile_affected = active_profile_ids(&config)
        .iter()
        .any(|active| active == id);
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

    write_profile_config(app, &config)?;
    Ok(runtime_profile_affected)
}

pub(crate) fn remove_override_reference_store(
    app: &tauri::AppHandle,
    id: &str,
) -> Result<bool, String> {
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

pub(crate) fn add_or_replace_override_item(
    app: &tauri::AppHandle,
    item: OverrideItemInput,
) -> Result<bool, String> {
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

    let profile_config = read_profile_config(app)?;
    let runtime_override_affected = active_profiles_reference_override(&profile_config, &id)
        || existing
            .as_ref()
            .and_then(|value| value.global)
            .unwrap_or(false)
        || config
            .items
            .iter()
            .find(|value| value.id == id)
            .and_then(|value| value.global)
            .unwrap_or(false);

    write_override_config(app, &config)?;
    Ok(runtime_override_affected)
}

pub(crate) fn update_override_item_store(
    app: &tauri::AppHandle,
    item: OverrideItemData,
) -> Result<bool, String> {
    let mut config = read_override_config(app)?;
    let Some(index) = config.items.iter().position(|value| value.id == item.id) else {
        return Err("Override not found".to_string());
    };
    let previous = config.items[index].clone();
    let profile_config = read_profile_config(app)?;
    let runtime_override_affected = active_profiles_reference_override(&profile_config, &item.id)
        || previous.global.unwrap_or(false)
        || item.global.unwrap_or(false);
    config.items[index] = item;
    write_override_config(app, &config)?;
    Ok(runtime_override_affected)
}

pub(crate) fn remove_override_item_store(app: &tauri::AppHandle, id: &str) -> Result<bool, String> {
    let mut config = read_override_config(app)?;
    let removed = config.items.iter().find(|item| item.id == id).cloned();
    let profile_config = read_profile_config(app)?;
    let runtime_override_affected = active_profiles_reference_override(&profile_config, id)
        || removed
            .as_ref()
            .and_then(|item| item.global)
            .unwrap_or(false);
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

    Ok(runtime_override_affected)
}

pub(crate) fn restart_core_and_emit(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    let value = restart_core_process(app, state, None)?;
    emit_ipc_event(app, "core-started", value);
    emit_ipc_event(app, "groupsUpdated", Value::Null);
    emit_ipc_event(app, "rulesUpdated", Value::Null);
    Ok(())
}

pub(crate) fn add_chain_item_store(
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

pub(crate) fn update_chain_item_store(
    app: &tauri::AppHandle,
    item: ChainItemData,
) -> Result<(), String> {
    let mut config = read_chains_config(app)?;
    let Some(index) = config.items.iter().position(|value| value.id == item.id) else {
        return Err("Chain not found".to_string());
    };
    config.items[index] = item;
    write_chains_config(app, &config)
}

pub(crate) fn remove_chain_item_store(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
    let mut config = read_chains_config(app)?;
    config.items.retain(|value| value.id != id);
    write_chains_config(app, &config)
}

pub(crate) fn active_profile_ids(config: &ProfileConfigData) -> Vec<String> {
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

pub(crate) fn primary_profile_id(
    config: &ProfileConfigData,
    active_ids: &[String],
) -> Option<String> {
    if let Some(current) = config.current.as_ref() {
        if active_ids.iter().any(|id| id == current) {
            return Some(current.clone());
        }
    }
    active_ids.first().cloned()
}
