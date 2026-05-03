fn read_core_name(app: &tauri::AppHandle) -> Result<String, String> {
    Ok(
        match read_app_config_store(app)?
            .get("core")
            .and_then(Value::as_str)
            .unwrap_or("mihomo")
        {
            "mihomo-alpha" => "mihomo-alpha".to_string(),
            _ => "mihomo".to_string(),
        },
    )
}

fn read_diff_work_dir(app: &tauri::AppHandle) -> Result<bool, String> {
    Ok(read_app_config_store(app)?
        .get("diffWorkDir")
        .and_then(Value::as_bool)
        .unwrap_or(false))
}

fn read_safe_paths(app: &tauri::AppHandle) -> Result<Vec<String>, String> {
    Ok(json_array_strings(
        read_app_config_store(app)?.get("safePaths"),
    ))
}

fn read_control_flags(app: &tauri::AppHandle) -> Result<(bool, bool), String> {
    let app_config = read_app_config_store(app)?;
    let control_dns = app_config
        .get("controlDns")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let control_sniff = app_config
        .get("controlSniff")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    Ok((control_dns, control_sniff))
}

fn read_auto_set_dns_mode(app: &tauri::AppHandle) -> Result<String, String> {
    Ok(read_app_config_store(app)?
        .get("autoSetDNSMode")
        .and_then(Value::as_str)
        .unwrap_or("exec")
        .to_string())
}

fn normalize_delay_test_timeout(value: Option<i64>) -> i64 {
    let parsed = value.unwrap_or(5000);
    parsed.clamp(1000, 15000)
}

fn resolve_delay_test_options(
    app: &tauri::AppHandle,
    input_url: Option<&str>,
) -> Result<(String, String), String> {
    let app_config = read_app_config_store(app)?;
    let delay_test_url = app_config
        .get("delayTestUrl")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .unwrap_or("http://cp.cloudflare.com/generate_204");
    let final_url = input_url
        .filter(|value| !value.is_empty())
        .unwrap_or(delay_test_url)
        .to_string();
    let timeout =
        normalize_delay_test_timeout(app_config.get("delayTestTimeout").and_then(Value::as_i64))
            .to_string();

    Ok((final_url, timeout))
}

fn current_runtime_profile_id(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    let profile_config = read_profile_config(app)?;
    let active_ids = active_profile_ids(&profile_config);
    Ok(primary_profile_id(&profile_config, &active_ids))
}

fn path_delimiter() -> &'static str {
    if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    }
}

fn cleanup_boolean_configs(config: &mut serde_json::Map<String, Value>) {
    if config.get("ipv6").and_then(Value::as_bool) != Some(false) {
        config.remove("ipv6");
    }

    for key in [
        "unified-delay",
        "tcp-concurrent",
        "geodata-mode",
        "geo-auto-update",
        "disable-keep-alive",
    ] {
        if config.get(key).and_then(Value::as_bool) != Some(true) {
            config.remove(key);
        }
    }

    let should_remove_profile =
        if let Some(profile) = config.get_mut("profile").and_then(Value::as_object_mut) {
            let has_store_selected = profile
                .get("store-selected")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let has_store_fake_ip = profile
                .get("store-fake-ip")
                .and_then(Value::as_bool)
                .unwrap_or(false);

            if !has_store_selected {
                profile.remove("store-selected");
            }
            if !has_store_fake_ip {
                profile.remove("store-fake-ip");
            }

            profile.is_empty()
        } else {
            false
        };

    if should_remove_profile {
        config.remove("profile");
    }
}

fn cleanup_number_configs(config: &mut serde_json::Map<String, Value>) {
    for key in [
        "port",
        "socks-port",
        "redir-port",
        "tproxy-port",
        "mixed-port",
        "keep-alive-idle",
        "keep-alive-interval",
    ] {
        if config.get(key).and_then(Value::as_i64) == Some(0) {
            config.remove(key);
        }
    }
}

fn cleanup_string_configs(config: &mut serde_json::Map<String, Value>) {
    if config.get("mode").and_then(Value::as_str) == Some("rule") {
        config.remove("mode");
    }

    for key in ["interface-name", "secret"] {
        if config
            .get(key)
            .and_then(Value::as_str)
            .map(|value| value.is_empty())
            .unwrap_or(false)
        {
            config.remove(key);
        }
    }

    if config
        .get("external-controller")
        .and_then(Value::as_str)
        .map(|value| value.is_empty())
        .unwrap_or(false)
    {
        config.remove("external-controller");
        config.remove("external-ui");
        config.remove("external-ui-url");
        config.remove("external-controller-cors");
        return;
    }

    if config
        .get("external-ui")
        .and_then(Value::as_str)
        .map(|value| value.is_empty())
        .unwrap_or(false)
    {
        config.remove("external-ui");
        config.remove("external-ui-url");
    }
}

fn cleanup_lan_settings(config: &mut serde_json::Map<String, Value>) {
    match config.get("allow-lan").and_then(Value::as_bool) {
        Some(false) => {
            config.remove("lan-allowed-ips");
            config.remove("lan-disallowed-ips");
        }
        Some(true) => {
            let mut should_remove_allowed = false;
            if let Some(allowed_ips) = config
                .get_mut("lan-allowed-ips")
                .and_then(Value::as_array_mut)
            {
                if allowed_ips.is_empty() {
                    should_remove_allowed = true;
                } else if !allowed_ips.iter().any(|value| {
                    value
                        .as_str()
                        .map(|item| item.starts_with("127.0.0.1/"))
                        .unwrap_or(false)
                }) {
                    allowed_ips.push(Value::String("127.0.0.1/8".to_string()));
                }
            }
            if should_remove_allowed {
                config.remove("lan-allowed-ips");
            }

            if config
                .get("lan-disallowed-ips")
                .and_then(Value::as_array)
                .map(|values| values.is_empty())
                .unwrap_or(false)
            {
                config.remove("lan-disallowed-ips");
            }
        }
        _ => {
            config.remove("allow-lan");
            config.remove("lan-allowed-ips");
            config.remove("lan-disallowed-ips");
        }
    }
}

fn cleanup_authentication_config(config: &mut serde_json::Map<String, Value>) {
    if config
        .get("authentication")
        .and_then(Value::as_array)
        .map(|items| items.is_empty())
        .unwrap_or(false)
    {
        config.remove("authentication");
        config.remove("skip-auth-prefixes");
    }
}

fn cleanup_tun_config(config: &mut serde_json::Map<String, Value>) {
    let mut should_remove_tun = false;
    if let Some(tun) = config.get_mut("tun").and_then(Value::as_object_mut) {
        if tun.get("enable").and_then(Value::as_bool) != Some(true) {
            should_remove_tun = true;
        } else {
            if tun.get("auto-route").and_then(Value::as_bool) != Some(false) {
                tun.remove("auto-route");
            }
            if tun.get("auto-detect-interface").and_then(Value::as_bool) != Some(false) {
                tun.remove("auto-detect-interface");
            }

            for key in ["auto-redirect", "strict-route", "disable-icmp-forwarding"] {
                if tun.get(key).and_then(Value::as_bool) != Some(true) {
                    tun.remove(key);
                }
            }

            match tun.get("device").and_then(Value::as_str) {
                Some("") => {
                    tun.remove("device");
                }
                Some(value) if cfg!(target_os = "macos") && !value.starts_with("utun") => {
                    tun.remove("device");
                }
                _ => {}
            }

            for key in ["dns-hijack", "route-exclude-address"] {
                if tun
                    .get(key)
                    .and_then(Value::as_array)
                    .map(|items| items.is_empty())
                    .unwrap_or(false)
                {
                    tun.remove(key);
                }
            }
        }
    }

    if should_remove_tun {
        config.remove("tun");
    }
}

fn cleanup_dns_config(config: &mut serde_json::Map<String, Value>, control_dns: bool) {
    if !control_dns {
        return;
    }

    let mut should_remove_dns = false;
    if let Some(dns) = config.get_mut("dns").and_then(Value::as_object_mut) {
        if dns.get("enable").and_then(Value::as_bool) != Some(true) {
            should_remove_dns = true;
        } else {
            for key in [
                "fake-ip-range",
                "fake-ip-range6",
                "fake-ip-filter",
                "proxy-server-nameserver",
                "direct-nameserver",
                "nameserver",
            ] {
                if dns
                    .get(key)
                    .and_then(Value::as_array)
                    .map(|items| items.is_empty())
                    .unwrap_or(false)
                {
                    dns.remove(key);
                }
            }

            let proxy_server_nameserver_empty = dns
                .get("proxy-server-nameserver")
                .and_then(Value::as_array)
                .map(|items| items.is_empty())
                .unwrap_or(true);
            if dns.get("respect-rules").and_then(Value::as_bool) != Some(true)
                || proxy_server_nameserver_empty
            {
                dns.remove("respect-rules");
            }

            if dns
                .get("nameserver-policy")
                .and_then(Value::as_object)
                .map(|items| items.is_empty())
                .unwrap_or(false)
            {
                dns.remove("nameserver-policy");
            }

            dns.remove("fallback");
            dns.remove("fallback-filter");
        }
    }

    if should_remove_dns {
        config.remove("dns");
    }
}

fn cleanup_sniffer_config(config: &mut serde_json::Map<String, Value>, control_sniff: bool) {
    if !control_sniff {
        return;
    }

    if config
        .get("sniffer")
        .and_then(Value::as_object)
        .and_then(|sniffer| sniffer.get("enable"))
        .and_then(Value::as_bool)
        != Some(true)
    {
        config.remove("sniffer");
    }
}

fn cleanup_proxy_configs(config: &mut serde_json::Map<String, Value>) {
    for key in ["proxies", "proxy-groups", "rules"] {
        if config
            .get(key)
            .and_then(Value::as_array)
            .map(|items| items.is_empty())
            .unwrap_or(false)
        {
            config.remove(key);
        }
    }

    for key in ["proxy-providers", "rule-providers"] {
        if config
            .get(key)
            .and_then(Value::as_object)
            .map(|items| items.is_empty())
            .unwrap_or(false)
        {
            config.remove(key);
        }
    }
}

fn sanitize_runtime_profile_value(profile: &mut Value, control_dns: bool, control_sniff: bool) {
    let Some(config) = profile.as_object_mut() else {
        return;
    };

    cleanup_lan_settings(config);
    cleanup_boolean_configs(config);
    cleanup_number_configs(config);
    cleanup_string_configs(config);
    cleanup_authentication_config(config);
    cleanup_tun_config(config);
    cleanup_dns_config(config, control_dns);
    cleanup_sniffer_config(config, control_sniff);
    cleanup_proxy_configs(config);
}

