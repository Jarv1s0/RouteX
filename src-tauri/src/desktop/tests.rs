use super::*;
use std::collections::HashSet;
use std::path::Path;

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
fn mihomo_groups_expand_nested_group_children() {
    let proxies = json!({
        "proxies": {
            "ALL": {
                "name": "ALL",
                "type": "Selector",
                "now": "HK",
                "all": ["HK"],
                "history": [],
                "extra": {}
            },
            "HK": {
                "name": "HK",
                "type": "Selector",
                "now": "HK 01",
                "all": ["HK 01", "HK 02"],
                "history": [],
                "extra": {}
            },
            "HK 01": {
                "name": "HK 01",
                "type": "Shadowsocks",
                "history": [{ "time": "2026-05-12T07:00:00.000Z", "delay": 120 }]
            },
            "HK 02": {
                "name": "HK 02",
                "type": "Shadowsocks",
                "history": [{ "time": "2026-05-12T07:00:00.000Z", "delay": 180 }]
            }
        }
    });
    let runtime = json!({
        "mode": "rule",
        "proxy-groups": [
            { "name": "ALL", "type": "Selector", "proxies": ["HK"], "url": "http://all.test/generate_204" },
            { "name": "HK", "type": "Selector", "proxies": ["HK 01", "HK 02"], "url": "http://hk.test/generate_204", "icon": "hk-icon" }
        ]
    });

    let groups = build_mihomo_groups_value(&proxies, &runtime);
    let all_group = groups
        .as_array()
        .and_then(|items| {
            items
                .iter()
                .find(|group| group.get("name").and_then(Value::as_str) == Some("ALL"))
        })
        .expect("ALL group should exist");
    let hk_group = all_group
        .get("all")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .expect("ALL should contain HK group");

    assert_eq!(hk_group.get("name").and_then(Value::as_str), Some("HK"));
    assert_eq!(
        hk_group.get("testUrl").and_then(Value::as_str),
        Some("http://hk.test/generate_204")
    );
    assert_eq!(
        hk_group.get("icon").and_then(Value::as_str),
        Some("hk-icon")
    );

    let nested_names = hk_group
        .get("all")
        .and_then(Value::as_array)
        .expect("HK children should be expanded")
        .iter()
        .filter_map(value_name)
        .collect::<Vec<_>>();

    assert_eq!(nested_names, vec!["HK 01".to_string(), "HK 02".to_string()]);
}

#[test]
fn sysproxy_service_commands_use_nested_command_group() {
    let args = service_command_args(false, "disable", Vec::new());
    let args = args.iter().map(String::as_str).collect::<Vec<_>>();
    let expected = if cfg!(target_os = "windows") {
        vec!["--use-registry", "sysproxy", "disable"]
    } else {
        vec!["sysproxy", "disable"]
    };
    assert_eq!(args, expected);
}

#[test]
fn service_status_parser_does_not_treat_not_running_as_running() {
    let output = r#"{"status":{"state":"not-running","success":false}}"#;
    assert_eq!(classify_service_status_text(output), Some("stopped"));

    let output = "service is not running";
    assert_eq!(classify_service_status_text(output), Some("stopped"));
}

#[test]
fn generated_service_auth_key_matches_service_parser_format() {
    let auth_key = generate_service_auth_key().expect("service auth key should be generated");
    let (public_key, private_key) =
        parse_service_auth_key(&auth_key).expect("generated key should parse");

    assert!(!public_key.trim().is_empty());
    assert!(private_key.starts_with("-----BEGIN PRIVATE KEY-----"));
    assert!(private_key.ends_with("-----END PRIVATE KEY-----\n"));
}

#[test]
fn windows_task_xml_uses_unquoted_command_path() {
    let runner = Path::new(r"C:\Users\RouteX Tasks\routex-run.exe");
    let app = Path::new(r"C:\Program Files\RouteX\routex.exe");

    let xml = build_routex_run_task_xml_for_paths(runner, app);

    assert!(xml.contains(r"<Command>C:\Users\RouteX Tasks\routex-run.exe</Command>"));
    assert!(xml.contains(r#"<Arguments>"C:\Program Files\RouteX\routex.exe"</Arguments>"#));
    assert!(
        !xml.contains(r#"<Command>"C:\Users\RouteX Tasks\routex-run.exe"</Command>"#),
        "Task Scheduler Exec.Command should not include shell quotes"
    );
}

#[test]
fn windows_autorun_task_xml_uses_unquoted_command_path() {
    let runner = Path::new(r"C:\Users\RouteX Tasks\routex-run.exe");
    let app = Path::new(r"C:\Program Files\RouteX\routex.exe");

    let xml = build_routex_autorun_task_xml_for_paths(runner, app);

    assert!(xml.contains(r"<Command>C:\Users\RouteX Tasks\routex-run.exe</Command>"));
    assert!(xml.contains(
        r#"<Arguments>"C:\Program Files\RouteX\routex.exe" --routex-startup</Arguments>"#
    ));
}

#[test]
fn windows_task_match_rejects_quoted_command_path() {
    let runner = Path::new(r"C:\Users\RouteX Tasks\routex-run.exe");
    let app = Path::new(r"C:\Program Files\RouteX\routex.exe");
    let stale_xml = r#"
<Task>
  <Actions>
    <Exec>
      <Command>"C:\Users\RouteX Tasks\routex-run.exe"</Command>
      <Arguments>"C:\Program Files\RouteX\routex.exe"</Arguments>
    </Exec>
  </Actions>
</Task>
"#;

    assert!(!task_xml_matches_current_exec(stale_xml, runner, app, None));
}

#[test]
fn windows_task_match_accepts_unquoted_command_path() {
    let runner = Path::new(r"C:\Users\RouteX Tasks\routex-run.exe");
    let app = Path::new(r"C:\Program Files\RouteX\routex.exe");
    let xml = build_routex_autorun_task_xml_for_paths(runner, app);

    assert!(task_xml_matches_current_exec(
        &xml,
        runner,
        app,
        Some("--routex-startup")
    ));
}

#[test]
fn elevated_startup_runs_task_when_unelevated_task_matches() {
    assert_eq!(
        choose_windows_unelevated_startup_action(true),
        WindowsUnelevatedStartupAction::RunElevateTask
    );
}

#[test]
fn elevated_startup_requests_admin_when_unelevated_task_is_missing() {
    assert_eq!(
        choose_windows_unelevated_startup_action(false),
        WindowsUnelevatedStartupAction::RequestAdminRegistration
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

#[test]
fn stale_profile_runtime_config_cache_write_is_ignored() {
    invalidate_profile_runtime_config_cache();
    let stale_revision = current_profile_runtime_config_revision();
    let stale_value = json!({ "mode": "rule" });
    let fresh_value = json!({ "mode": "global" });

    invalidate_profile_runtime_config_cache();
    let fresh_revision = current_profile_runtime_config_revision();
    write_cached_profile_runtime_config(fresh_revision, &fresh_value);
    write_cached_profile_runtime_config(stale_revision, &stale_value);

    let cached = read_cached_profile_runtime_config(fresh_revision)
        .expect("fresh cache entry should remain available");
    assert_eq!(cached.get("mode").and_then(Value::as_str), Some("global"));
    assert!(read_cached_profile_runtime_config(stale_revision).is_none());
}
