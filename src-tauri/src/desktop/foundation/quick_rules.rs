use crate::desktop::prelude::*;
use crate::desktop::*;
use std::collections::HashMap;

pub(crate) fn default_quick_rules_config() -> QuickRulesConfigData {
    QuickRulesConfigData {
        version: 1,
        migrated_profile_quick_rules_to_global: false,
        profiles: HashMap::new(),
    }
}

pub(crate) fn normalize_quick_rule(rule: QuickRule) -> Option<QuickRule> {
    if rule.id.trim().is_empty()
        || rule.rule_type.trim().is_empty()
        || rule.value.trim().is_empty()
        || rule.target.trim().is_empty()
    {
        return None;
    }

    Some(QuickRule {
        id: rule.id,
        rule_type: rule.rule_type,
        value: rule.value,
        target: rule.target,
        no_resolve: rule.no_resolve,
        enabled: rule.enabled,
        source: if rule.source == "connection" {
            "connection".to_string()
        } else {
            "manual".to_string()
        },
        created_at: rule.created_at,
        updated_at: rule.updated_at,
    })
}

pub(crate) fn normalize_quick_rules_config(
    mut config: QuickRulesConfigData,
) -> QuickRulesConfigData {
    config.version = 1;
    config.profiles = config
        .profiles
        .into_iter()
        .map(|(profile_id, profile)| {
            let rules = profile
                .rules
                .into_iter()
                .filter_map(normalize_quick_rule)
                .collect::<Vec<_>>();
            (
                profile_id,
                QuickRuleProfileConfig {
                    enabled: profile.enabled,
                    rules,
                },
            )
        })
        .collect();
    config
}

pub(crate) fn quick_rule_string(rule: &QuickRule) -> String {
    let mut text = format!("{},{},{}", rule.rule_type, rule.value, rule.target);
    if rule.no_resolve.unwrap_or(false) {
        text.push_str(",no-resolve");
    }
    text
}

pub(crate) fn quick_rule_dedupe_key(rule: &QuickRule) -> String {
    format!("{},{}", quick_rule_string(rule), rule.enabled)
}

pub(crate) fn ensure_quick_rule_profile_mut<'a>(
    config: &'a mut QuickRulesConfigData,
    profile_id: &str,
) -> &'a mut QuickRuleProfileConfig {
    config
        .profiles
        .entry(profile_id.to_string())
        .or_insert_with(|| QuickRuleProfileConfig {
            enabled: true,
            rules: Vec::new(),
        })
}

pub(crate) fn read_quick_rules_config_raw(
    app: &tauri::AppHandle,
) -> Result<QuickRulesConfigData, String> {
    let path = storage_file(app, QUICK_RULES_CONFIG_FILE)?;
    Ok(normalize_quick_rules_config(
        read_json_file(&path)?.unwrap_or_else(default_quick_rules_config),
    ))
}

pub(crate) fn write_quick_rules_config(
    app: &tauri::AppHandle,
    config: &QuickRulesConfigData,
) -> Result<(), String> {
    let path = storage_file(app, QUICK_RULES_CONFIG_FILE)?;
    let normalized = normalize_quick_rules_config(config.clone());
    invalidate_profile_runtime_config_cache_after(write_json_file(&path, &normalized))
}

pub(crate) fn quick_rule_from_input(
    input: QuickRuleInput,
    fallback_index: usize,
) -> Result<QuickRule, String> {
    let now = current_timestamp_ms();
    let rule_type = input
        .rule_type
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Quick rule type is required".to_string())?;
    let value = input
        .value
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Quick rule value is required".to_string())?;
    let target = input
        .target
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Quick rule target is required".to_string())?;

    Ok(QuickRule {
        id: input
            .id
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| format!("{:x}-{fallback_index:x}", now)),
        rule_type,
        value,
        target,
        no_resolve: Some(input.no_resolve.unwrap_or(false)),
        enabled: input.enabled.unwrap_or(true),
        source: input.source.unwrap_or_else(|| "manual".to_string()),
        created_at: now,
        updated_at: now,
        })
}

pub(crate) fn migrate_profile_quick_rules_to_global_if_needed(
    app: &tauri::AppHandle,
    config: &mut QuickRulesConfigData,
) -> Result<(), String> {
    if config.migrated_profile_quick_rules_to_global {
        return Ok(());
    }

    let mut migrated_rules = config
        .profiles
        .get(GLOBAL_QUICK_RULES_PROFILE_ID)
        .map(|profile| profile.rules.clone())
        .unwrap_or_default();
    let mut existing = migrated_rules
        .iter()
        .map(quick_rule_dedupe_key)
        .collect::<HashSet<_>>();

    for (profile_id, profile) in &config.profiles {
        if profile_id == GLOBAL_QUICK_RULES_PROFILE_ID || !profile.enabled {
            continue;
        }

        for rule in &profile.rules {
            if existing.insert(quick_rule_dedupe_key(rule)) {
                migrated_rules.push(rule.clone());
            }
        }
    }

    let global_profile = ensure_quick_rule_profile_mut(config, GLOBAL_QUICK_RULES_PROFILE_ID);
    global_profile.rules = migrated_rules;
    config.migrated_profile_quick_rules_to_global = true;
    write_quick_rules_config(app, config)
}

pub(crate) fn read_quick_rules_config(
    app: &tauri::AppHandle,
) -> Result<QuickRulesConfigData, String> {
    let mut config = read_quick_rules_config_raw(app)?;
    migrate_profile_quick_rules_to_global_if_needed(app, &mut config)?;
    Ok(config)
}

pub(crate) fn read_quick_rules(
    app: &tauri::AppHandle,
    profile_id: &str,
) -> Result<QuickRuleProfileConfig, String> {
    let mut config = read_quick_rules_config(app)?;
    Ok(ensure_quick_rule_profile_mut(&mut config, profile_id).clone())
}

pub(crate) fn add_quick_rule_store(
    app: &tauri::AppHandle,
    profile_id: &str,
    input: QuickRuleInput,
) -> Result<QuickRule, String> {
    let mut config = read_quick_rules_config(app)?;
    let profile = ensure_quick_rule_profile_mut(&mut config, profile_id);
    let rule = quick_rule_from_input(input, profile.rules.len())?;
    profile.rules.insert(0, rule.clone());
    write_quick_rules_config(app, &config)?;
    Ok(rule)
}

pub(crate) fn update_quick_rule_store(
    app: &tauri::AppHandle,
    profile_id: &str,
    rule_id: &str,
    patch: Value,
) -> Result<(), String> {
    let mut config = read_quick_rules_config(app)?;
    let profile = ensure_quick_rule_profile_mut(&mut config, profile_id);
    let rule = profile
        .rules
        .iter_mut()
        .find(|rule| rule.id == rule_id)
        .ok_or_else(|| "Quick rule not found".to_string())?;

    if let Some(value) = patch.get("type").and_then(Value::as_str) {
        rule.rule_type = value.to_string();
    }
    if let Some(value) = patch.get("value").and_then(Value::as_str) {
        rule.value = value.to_string();
    }
    if let Some(value) = patch.get("target").and_then(Value::as_str) {
        rule.target = value.to_string();
    }
    if let Some(value) = patch.get("noResolve").and_then(Value::as_bool) {
        rule.no_resolve = Some(value);
    }
    if let Some(value) = patch.get("enabled").and_then(Value::as_bool) {
        rule.enabled = value;
    }
    if let Some(value) = patch.get("source").and_then(Value::as_str) {
        rule.source = if value == "connection" {
            "connection".to_string()
        } else {
            "manual".to_string()
        };
    }
    rule.updated_at = current_timestamp_ms();
    write_quick_rules_config(app, &config)
}

pub(crate) fn remove_quick_rule_store(
    app: &tauri::AppHandle,
    profile_id: &str,
    rule_id: &str,
) -> Result<(), String> {
    let mut config = read_quick_rules_config(app)?;
    let profile = ensure_quick_rule_profile_mut(&mut config, profile_id);
    profile.rules.retain(|rule| rule.id != rule_id);
    write_quick_rules_config(app, &config)
}

pub(crate) fn set_quick_rules_enabled_store(
    app: &tauri::AppHandle,
    profile_id: &str,
    enabled: bool,
) -> Result<(), String> {
    let mut config = read_quick_rules_config(app)?;
    ensure_quick_rule_profile_mut(&mut config, profile_id).enabled = enabled;
    write_quick_rules_config(app, &config)
}

pub(crate) fn reorder_quick_rules_store(
    app: &tauri::AppHandle,
    profile_id: &str,
    rule_ids: &[String],
) -> Result<(), String> {
    let mut config = read_quick_rules_config(app)?;
    let profile = ensure_quick_rule_profile_mut(&mut config, profile_id);
    let mut rules_by_id = profile
        .rules
        .iter()
        .cloned()
        .map(|rule| (rule.id.clone(), rule))
        .collect::<HashMap<_, _>>();
    let mut ordered = Vec::new();
    for id in rule_ids {
        if let Some(rule) = rules_by_id.remove(id) {
            ordered.push(rule);
        }
    }
    ordered.extend(
        profile
            .rules
            .iter()
            .filter(|rule| rules_by_id.contains_key(&rule.id))
            .cloned(),
    );
    profile.rules = ordered;
    write_quick_rules_config(app, &config)
}

pub(crate) fn clear_quick_rules_store(
    app: &tauri::AppHandle,
    profile_id: &str,
) -> Result<(), String> {
    let mut config = read_quick_rules_config(app)?;
    ensure_quick_rule_profile_mut(&mut config, profile_id)
        .rules
        .clear();
    write_quick_rules_config(app, &config)
}

pub(crate) fn quick_rule_target_names(profile: &Value) -> HashSet<String> {
    let mut names = ["DIRECT", "REJECT", "REJECT-DROP", "PASS", "GLOBAL"]
        .iter()
        .map(|value| value.to_string())
        .collect::<HashSet<_>>();

    if let Some(object) = profile.as_object() {
        for key in ["proxies", "proxy-groups"] {
            if let Some(items) = object.get(key).and_then(Value::as_array) {
                for item in items {
                    if let Some(name) = value_name(item) {
                        names.insert(name);
                    }
                }
            }
        }
    }

    names
}

pub(crate) fn quick_rule_strings(
    app: &tauri::AppHandle,
    runtime_profile: &Value,
) -> Result<Vec<String>, String> {
    let quick_rules = read_quick_rules(app, GLOBAL_QUICK_RULES_PROFILE_ID)?;
    if !quick_rules.enabled {
        return Ok(Vec::new());
    }
    let valid_targets = quick_rule_target_names(runtime_profile);
    Ok(quick_rules
        .rules
        .iter()
        .filter(|rule| rule.enabled)
        .filter(|rule| valid_targets.contains(&rule.target))
        .map(quick_rule_string)
        .collect())
}

pub(crate) fn inject_quick_rules(
    app: &tauri::AppHandle,
    profile: &mut Value,
) -> Result<(), String> {
    if !profile.is_object() {
        *profile = json!({});
    }

    let rules = quick_rule_strings(app, profile)?;
    if rules.is_empty() {
        return Ok(());
    }

    let Some(object) = profile.as_object_mut() else {
        return Ok(());
    };

    let mut merged = rules.into_iter().map(Value::String).collect::<Vec<_>>();
    let existing = object
        .get("rules")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    merged.extend(existing);
    object.insert("rules".to_string(), Value::Array(merged));
    Ok(())
}
