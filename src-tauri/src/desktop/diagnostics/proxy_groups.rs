use crate::desktop::*;
use std::collections::HashSet;

pub(crate) fn build_group_children(
    proxies_map: &serde_json::Map<String, Value>,
    all_names: &[Value],
    runtime_group_map: &serde_json::Map<String, Value>,
    icon_map: &serde_json::Map<String, Value>,
    seen: &mut HashSet<String>,
) -> Vec<Value> {
    all_names
        .iter()
        .filter_map(Value::as_str)
        .filter_map(|name| {
            proxies_map.get(name).map(|proxy| {
                let mut cloned = proxy.clone();

                if let Some(object) = cloned.as_object_mut() {
                    if let Some(group_config) = runtime_group_map.get(name) {
                        if let Some(url) = group_config.get("url") {
                            object.insert("testUrl".to_string(), url.clone());
                        }
                        if let Some(icon) = group_config.get("icon") {
                            object.insert("icon".to_string(), icon.clone());
                        }
                    } else if let Some(icon) = icon_map.get(name) {
                        object.insert("icon".to_string(), icon.clone());
                    }

                    if let Some(child_names) = object.get("all").and_then(Value::as_array).cloned()
                    {
                        if seen.insert(name.to_string()) {
                            object.insert(
                                "all".to_string(),
                                Value::Array(build_group_children(
                                    proxies_map,
                                    &child_names,
                                    runtime_group_map,
                                    icon_map,
                                    seen,
                                )),
                            );
                            seen.remove(name);
                        } else {
                            object.insert("all".to_string(), Value::Array(vec![]));
                        }
                    }
                }

                cloned
            })
        })
        .collect()
}

pub(crate) fn build_mihomo_groups_value(proxies: &Value, runtime: &Value) -> Value {
    let mode = runtime
        .get("mode")
        .and_then(Value::as_str)
        .unwrap_or("rule");
    if mode == "direct" {
        return Value::Array(vec![]);
    }

    let empty_array = Vec::new();
    let proxy_groups = runtime
        .get("proxy-groups")
        .and_then(Value::as_array)
        .unwrap_or(&empty_array);
    let empty_map = serde_json::Map::new();
    let proxies_map = proxies
        .get("proxies")
        .and_then(Value::as_object)
        .unwrap_or(&empty_map);
    let mut icon_map = serde_json::Map::new();
    let mut runtime_group_map = serde_json::Map::new();
    for group in proxy_groups {
        if let Some(name) = group.get("name").and_then(Value::as_str) {
            runtime_group_map.insert(name.to_string(), group.clone());
            if let Some(icon) = group.get("icon") {
                icon_map.insert(name.to_string(), icon.clone());
            }
        }
    }

    let mut groups = Vec::new();
    for group in proxy_groups {
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
                Value::Array(build_group_children(
                    proxies_map,
                    all_names,
                    &runtime_group_map,
                    &icon_map,
                    &mut HashSet::from([name.to_string()]),
                )),
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
                            Value::Array(build_group_children(
                                proxies_map,
                                all_names,
                                &runtime_group_map,
                                &icon_map,
                                &mut HashSet::from(["GLOBAL".to_string()]),
                            )),
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
