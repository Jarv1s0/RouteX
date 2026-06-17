use crate::desktop::prelude::*;
use crate::desktop::*;
use std::collections::HashSet;

pub(crate) fn json_array_strings(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

pub(crate) fn dedupe_ids(ids: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();

    for id in ids {
        if id.trim().is_empty() {
            continue;
        }

        if seen.insert(id.clone()) {
            result.push(id);
        }
    }

    result
}

pub(crate) fn normalize_profile_config(mut config: ProfileConfigData) -> ProfileConfigData {
    let valid_ids = config
        .items
        .iter()
        .map(|item| item.id.clone())
        .collect::<HashSet<_>>();

    let current = config
        .current
        .as_ref()
        .filter(|id| valid_ids.contains(*id))
        .cloned();

    let mut actives = dedupe_ids(config.actives.unwrap_or_default())
        .into_iter()
        .filter(|id| valid_ids.contains(id))
        .collect::<Vec<_>>();

    let next_current = if let Some(current) = current {
        if !actives.contains(&current) {
            actives.insert(0, current.clone());
        }
        Some(current)
    } else if let Some(first_active) = actives.first().cloned() {
        Some(first_active)
    } else {
        config.items.first().map(|item| item.id.clone())
    };

    if let Some(current) = next_current.as_ref() {
        if !actives.contains(current) {
            actives.insert(0, current.clone());
        }
    }

    config.current = next_current;
    config.actives = if actives.is_empty() {
        None
    } else {
        Some(actives)
    };
    config
}

pub(crate) fn merge_json(base: &mut Value, patch: &Value) {
    match (base, patch) {
        (Value::Object(base_map), Value::Object(patch_map)) => {
            for (key, value) in patch_map {
                if value.is_null() {
                    base_map.remove(key);
                    continue;
                }

                if let Some(base_value) = base_map.get_mut(key) {
                    merge_json(base_value, value);
                } else {
                    base_map.insert(key.clone(), value.clone());
                }
            }
        }
        (base_value, patch_value) => {
            *base_value = patch_value.clone();
        }
    }
}

pub(crate) fn trim_wrapped_key(key: &str) -> &str {
    if key.starts_with('<') && key.ends_with('>') && key.len() > 2 {
        &key[1..key.len() - 1]
    } else {
        key
    }
}

pub(crate) fn merge_config_value(base: &mut Value, patch: &Value, is_override: bool) {
    match patch {
        Value::Object(patch_map) => {
            if !base.is_object() {
                *base = json!({});
            }

            let Some(base_map) = base.as_object_mut() else {
                *base = patch.clone();
                return;
            };

            for (raw_key, value) in patch_map {
                if is_override && value.is_object() && raw_key.ends_with('!') {
                    let key = trim_wrapped_key(&raw_key[..raw_key.len() - 1]).to_string();
                    base_map.insert(key, value.clone());
                    continue;
                }

                if is_override && value.is_array() && raw_key.starts_with('+') {
                    let key = trim_wrapped_key(&raw_key[1..]).to_string();
                    let mut merged = value.as_array().cloned().unwrap_or_default();
                    let existing = base_map
                        .get(&key)
                        .and_then(Value::as_array)
                        .cloned()
                        .unwrap_or_default();
                    merged.extend(existing);
                    base_map.insert(key, Value::Array(merged));
                    continue;
                }

                if is_override && value.is_array() && raw_key.ends_with('+') {
                    let key = trim_wrapped_key(&raw_key[..raw_key.len() - 1]).to_string();
                    let mut merged = base_map
                        .get(&key)
                        .and_then(Value::as_array)
                        .cloned()
                        .unwrap_or_default();
                    merged.extend(value.as_array().cloned().unwrap_or_default());
                    base_map.insert(key, Value::Array(merged));
                    continue;
                }

                let key = trim_wrapped_key(raw_key).to_string();
                if let Some(base_value) = base_map.get_mut(&key) {
                    merge_config_value(base_value, value, is_override);
                } else {
                    base_map.insert(key, value.clone());
                }
            }
        }
        _ => {
            *base = patch.clone();
        }
    }
}
