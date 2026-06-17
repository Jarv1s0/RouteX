use super::*;

pub(crate) fn error_mentions_geo_data(message: &str) -> bool {
    let lower_msg = message.to_lowercase();
    lower_msg.contains("geoip")
        || lower_msg.contains("geosite")
        || lower_msg.contains("geoip.dat")
        || lower_msg.contains("geosite.dat")
        || lower_msg.contains("mmdb")
        || lower_msg.contains("metadb")
}

pub(crate) fn rule_uses_geo_data(rule: &str) -> bool {
    let rule_type = rule
        .split(',')
        .next()
        .map(str::trim)
        .unwrap_or_default()
        .to_ascii_uppercase();
    matches!(rule_type.as_str(), "GEOIP" | "SRC-GEOIP" | "GEOSITE")
}

pub(crate) fn error_has_missing_file_signal(message: &str) -> bool {
    let lower_msg = message.to_lowercase();
    [
        "no such file",
        "cannot find",
        "file not found",
        "missing",
        "does not exist",
        "file doesn't exist",
        "the system cannot find",
    ]
    .iter()
    .any(|marker| lower_msg.contains(marker))
}

pub(crate) fn dns_array_uses_geo_data(value: Option<&Value>) -> bool {
    value
        .and_then(Value::as_array)
        .map(|items| {
            items.iter().filter_map(Value::as_str).any(|item| {
                let normalized = item.trim().to_ascii_lowercase();
                normalized.starts_with("geosite:") || normalized.starts_with("geoip:")
            })
        })
        .unwrap_or(false)
}

pub(crate) fn dns_map_uses_geo_data(value: Option<&Value>) -> bool {
    value
        .and_then(Value::as_object)
        .map(|map| {
            map.keys().any(|key| {
                let normalized = key.trim().to_ascii_lowercase();
                normalized.starts_with("geosite:") || normalized.starts_with("geoip:")
            })
        })
        .unwrap_or(false)
}

pub(crate) fn dns_config_uses_geo_data(runtime_config: &Value) -> bool {
    let Some(dns) = runtime_config.get("dns").and_then(Value::as_object) else {
        return false;
    };

    if let Some(fallback_filter) = dns.get("fallback-filter").and_then(Value::as_object) {
        if fallback_filter.get("geoip").and_then(Value::as_bool) == Some(true) {
            return true;
        }
        if fallback_filter
            .get("geosite")
            .and_then(Value::as_array)
            .map(|items| !items.is_empty())
            .unwrap_or(false)
        {
            return true;
        }
    }

    dns_map_uses_geo_data(dns.get("nameserver-policy"))
        || dns_array_uses_geo_data(dns.get("fake-ip-filter"))
}

pub(crate) fn runtime_config_uses_geo_data(runtime_config: &Value) -> bool {
    runtime_config
        .get("rules")
        .and_then(Value::as_array)
        .map(|rules| {
            rules
                .iter()
                .filter_map(Value::as_str)
                .any(rule_uses_geo_data)
        })
        .unwrap_or(false)
        || dns_config_uses_geo_data(runtime_config)
}

pub(crate) fn is_missing_geo_data_error(message: &str, runtime_config: &Value) -> bool {
    runtime_config_uses_geo_data(runtime_config)
        && error_mentions_geo_data(message)
        && error_has_missing_file_signal(message)
}
