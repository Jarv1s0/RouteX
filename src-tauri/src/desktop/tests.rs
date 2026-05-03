use super::*;
use std::collections::HashSet;

const RUST_IPC_HANDLER_SOURCES: [&str; 5] = [
    include_str!("ipc/config.rs"),
    include_str!("ipc/mihomo.rs"),
    include_str!("ipc/network.rs"),
    include_str!("ipc/shell.rs"),
    include_str!("ipc/system.rs"),
];

const TS_INVOKE_CHANNEL_SOURCES: [&str; 4] = [
    include_str!("../../../src/shared/ipc/invoke-config.ts"),
    include_str!("../../../src/shared/ipc/invoke-mihomo.ts"),
    include_str!("../../../src/shared/ipc/invoke-network.ts"),
    include_str!("../../../src/shared/ipc/invoke-system.ts"),
];

fn collect_rust_ipc_channels() -> HashSet<String> {
    RUST_IPC_HANDLER_SOURCES
        .iter()
        .flat_map(|source| source.lines())
        .filter_map(|line| {
            let trimmed = line.trim_start();
            if !trimmed.starts_with('"') || !trimmed.contains("=>") {
                return None;
            }
            trimmed.split('"').nth(1).map(str::to_string)
        })
        .collect()
}

fn collect_ts_invoke_channels() -> HashSet<String> {
    TS_INVOKE_CHANNEL_SOURCES
        .iter()
        .flat_map(|source| source.lines())
        .filter_map(|line| {
            let trimmed = line.trim();
            if !trimmed.contains(':') {
                return None;
            }
            trimmed.split('\'').nth(1).map(str::to_string)
        })
        .collect()
}

#[test]
fn desktop_invoke_channels_match_typescript_contract() {
    let rust_channels = collect_rust_ipc_channels();
    let ts_channels = collect_ts_invoke_channels();

    let missing_in_rust = ts_channels
        .difference(&rust_channels)
        .cloned()
        .collect::<Vec<_>>();
    assert!(
        missing_in_rust.is_empty(),
        "IPC invoke channels declared in TypeScript are missing Rust handlers: {missing_in_rust:?}"
    );
}

#[test]
fn merge_profile_nodes_keeps_secondary_groups_out_of_runtime_profile() {
    let mut target_profile = json!({
        "proxies": [
            { "name": "Primary Node" }
        ],
        "proxy-groups": [
            { "name": "ALL", "type": "Selector", "include-all": true },
            { "name": "Proxy", "type": "Selector", "proxies": ["Primary Node"] }
        ],
        "proxy-providers": {}
    });
    let source_profile = json!({
        "proxies": [
            { "name": "Merged Node" },
            { "name": "Relay By Shared Group", "dialer-proxy": "Proxy" },
            { "name": "Relay By Secondary Group", "dialer-proxy": "HK" }
        ],
        "proxy-groups": [
            { "name": "Proxy", "type": "Selector", "proxies": ["Merged Node"] },
            { "name": "HK", "type": "Selector", "proxies": ["Merged Node"] }
        ],
        "proxy-providers": {
            "subscription": { "path": "./providers/subscription.yaml" }
        }
    });

    merge_profile_nodes(
        &mut target_profile,
        &source_profile,
        "profile-secondary",
        "自建.yaml",
    );

    let merged_groups = target_profile
        .get("proxy-groups")
        .and_then(Value::as_array)
        .expect("proxy-groups should be present");
    let merged_group_names = merged_groups
        .iter()
        .filter_map(value_name)
        .collect::<Vec<_>>();
    assert_eq!(
        merged_group_names,
        vec!["ALL".to_string(), "Proxy".to_string()]
    );

    let merged_proxies = target_profile
        .get("proxies")
        .and_then(Value::as_array)
        .expect("proxies should be present");
    let merged_proxy_names = merged_proxies
        .iter()
        .filter_map(value_name)
        .collect::<Vec<_>>();
    assert_eq!(
        merged_proxy_names,
        vec![
            "Primary Node".to_string(),
            "Merged Node".to_string(),
            "Relay By Shared Group".to_string()
        ]
    );

    let relay_proxy = merged_proxies
        .iter()
        .find(|proxy| value_name(proxy).as_deref() == Some("Relay By Shared Group"))
        .and_then(Value::as_object)
        .expect("relay proxy should be merged");
    assert_eq!(
        relay_proxy.get("dialer-proxy").and_then(Value::as_str),
        Some("Proxy")
    );

    let merged_provider = target_profile
        .get("proxy-providers")
        .and_then(Value::as_object)
        .and_then(|providers| providers.get("subscription"))
        .and_then(Value::as_object)
        .expect("provider should be preserved");
    assert_eq!(
        merged_provider.get("path").and_then(Value::as_str),
        Some("merged-profiles/profile-secondary/providers/subscription.yaml")
    );
}

#[test]
fn theme_display_label_reads_first_line_comment() {
    assert_eq!(
        theme_display_label("anime.css", "/* 二刺螈 */\n:root { --x: 1; }"),
        "二刺螈"
    );
    assert_eq!(
        theme_display_label("anime.css", "\u{feff}/* 二刺螈 */\n:root { --x: 1; }"),
        "二刺螈"
    );
    assert_eq!(
        theme_display_label("plain.css", ":root { --x: 1; }"),
        "plain.css"
    );
}

#[test]
fn default_remote_profile_name_ignores_generic_subscribe_path() {
    assert_eq!(
        default_remote_profile_name(Some("https://example.com/api/Subscribe?token=abc")),
        "Subscribe"
    );
    assert_eq!(
        default_remote_profile_name(Some("https://example.com/subscription.yaml")),
        "Subscribe"
    );
    assert_eq!(
        default_remote_profile_name(Some("https://example.com/MyAirport.yaml")),
        "MyAirport.yaml"
    );
    assert_eq!(default_remote_profile_name(None), "Subscribe");
}

#[test]
fn run_override_script_returns_modified_profile() {
    let profile = json!({
        "mode": "rule",
        "proxies": [
            { "name": "Node A" }
        ]
    });
    let script = r#"
function main(config) {
  config.mode = "global";
  config["proxy-groups"] = [{ name: "Auto", proxies: config.proxies.map((proxy) => proxy.name) }];
  return config;
}
"#;

    let result = run_override_script(script, &profile).expect("script should run");

    assert_eq!(result.get("mode").and_then(Value::as_str), Some("global"));
    assert_eq!(
        result
            .get("proxy-groups")
            .and_then(Value::as_array)
            .and_then(|groups| groups.first())
            .and_then(|group| group.get("name"))
            .and_then(Value::as_str),
        Some("Auto")
    );
}

#[test]
fn run_override_script_requires_main_to_return_object() {
    let profile = json!({ "mode": "rule" });
    let script = r#"
function main(config) {
  return "invalid";
}
"#;

    let error = run_override_script(script, &profile).expect_err("script should fail");

    assert!(error.contains("必须返回对象"), "unexpected error: {error}");
}

#[test]
fn run_override_script_rejects_unbounded_loop() {
    let profile = json!({ "mode": "rule" });
    let script = r#"
function main(config) {
  while (true) {}
  return config;
}
"#;

    let error = run_override_script(script, &profile).expect_err("script should fail");

    assert!(
        error.contains("Maximum loop iteration limit") || error.contains("执行失败"),
        "unexpected error: {error}"
    );
}
