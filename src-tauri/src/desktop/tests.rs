use super::prelude::*;
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

const TAURI_SEND_FORWARD_CHANNELS: [&str; 6] = [
    "closeTrayMenuWindow",
    "quitConfirmResult",
    "trayIconUpdate",
    "updateFloatingWindow",
    "updateTaskbarIcon",
    "updateTrayMenu",
];

fn collect_rust_ipc_channels() -> HashSet<String> {
    RUST_IPC_HANDLER_SOURCES
        .iter()
        .flat_map(|source| source.lines())
        .filter_map(|line| {
            line.trim_start()
                .strip_prefix("map.insert(\"")
                .and_then(|rest| rest.split('"').next())
                .map(str::to_string)
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
fn desktop_invoke_handlers_match_typescript_contract() {
    let rust_channels = collect_rust_ipc_channels();
    let mut ts_channels = collect_ts_invoke_channels();
    ts_channels.extend(
        TAURI_SEND_FORWARD_CHANNELS
            .iter()
            .map(|value| value.to_string()),
    );

    let missing_in_typescript = rust_channels
        .difference(&ts_channels)
        .cloned()
        .collect::<Vec<_>>();
    assert!(
        missing_in_typescript.is_empty(),
        "Rust IPC handlers are missing TypeScript invoke declarations: {missing_in_typescript:?}"
    );
}

#[test]
fn profile_config_normalization_repairs_current_and_dedupes_actives() {
    let config = ProfileConfigData {
        current: Some("missing".to_string()),
        actives: Some(vec![
            "beta".to_string(),
            "beta".to_string(),
            "missing".to_string(),
            "alpha".to_string(),
        ]),
        items: vec![
            ProfileItemData {
                id: "alpha".to_string(),
                item_type: "local".to_string(),
                name: "Alpha".to_string(),
                url: None,
                fingerprint: None,
                ua: None,
                file: None,
                verify: None,
                interval: None,
                home: None,
                updated: None,
                override_ids: None,
                use_proxy: None,
                extra: None,
                reset_day: None,
                locked: None,
                auto_update: Some(true),
            },
            ProfileItemData {
                id: "beta".to_string(),
                item_type: "local".to_string(),
                name: "Beta".to_string(),
                url: None,
                fingerprint: None,
                ua: None,
                file: None,
                verify: None,
                interval: None,
                home: None,
                updated: None,
                override_ids: None,
                use_proxy: None,
                extra: None,
                reset_day: None,
                locked: None,
                auto_update: Some(true),
            },
        ],
    };

    let normalized = normalize_profile_config(config);

    assert_eq!(normalized.current.as_deref(), Some("beta"));
    assert_eq!(
        normalized.actives,
        Some(vec!["beta".to_string(), "alpha".to_string()])
    );
}

#[test]
fn quick_rules_normalization_drops_invalid_rules_and_forces_version() {
    let valid_rule = QuickRule {
        id: "rule-1".to_string(),
        rule_type: "DOMAIN-SUFFIX".to_string(),
        value: "example.com".to_string(),
        target: "DIRECT".to_string(),
        no_resolve: Some(false),
        enabled: true,
        source: "external".to_string(),
        created_at: 1,
        updated_at: 2,
    };
    let invalid_rule = QuickRule {
        id: "rule-2".to_string(),
        rule_type: String::new(),
        value: "invalid.example".to_string(),
        target: "DIRECT".to_string(),
        no_resolve: None,
        enabled: true,
        source: "manual".to_string(),
        created_at: 1,
        updated_at: 2,
    };
    let mut profiles = HashMap::new();
    profiles.insert(
        "profile-a".to_string(),
        QuickRuleProfileConfig {
            enabled: true,
            rules: vec![valid_rule, invalid_rule],
        },
    );

    let normalized = normalize_quick_rules_config(QuickRulesConfigData {
        version: 9,
        migrated_profile_quick_rules_to_global: false,
        profiles,
    });
    let rules = &normalized.profiles["profile-a"].rules;

    assert_eq!(normalized.version, 1);
    assert_eq!(rules.len(), 1);
    assert_eq!(rules[0].id, "rule-1");
    assert_eq!(rules[0].source, "manual");
}

#[test]
fn webdav_backup_sanitizes_local_machine_state_from_app_config() {
    let app_config = br#"{
  "webdavUrl": "https://example.com/dav",
  "webdavUsername": "alice",
  "webdavPassword": "secret",
  "webdavDir": "routex",
  "serviceAuthKey": "old-machine-key",
  "corePermissionMode": "service"
}"#;

    let sanitized = sanitize_webdav_backup_entry(Path::new(APP_CONFIG_FILE), app_config.to_vec())
        .expect("app config should sanitize");
    let value = serde_json::from_slice::<Value>(&sanitized).expect("sanitized JSON should parse");

    assert_eq!(
        value.get("webdavUrl").and_then(Value::as_str),
        Some("https://example.com/dav")
    );
    assert_eq!(
        value.get("webdavUsername").and_then(Value::as_str),
        Some("alice")
    );
    assert!(value.get("webdavPassword").is_none());
    assert!(value.get("serviceAuthKey").is_none());
    assert!(value.get("corePermissionMode").is_none());
}

#[test]
fn webdav_backup_keeps_non_app_config_entries_unchanged() {
    let bytes = b"webdavPassword=not-an-app-config".to_vec();

    assert_eq!(
        sanitize_webdav_backup_entry(Path::new("profiles/default.yaml"), bytes.clone())
            .expect("non app config should pass through"),
        bytes
    );
}

#[test]
fn dialog_extensions_are_normalized_for_native_filters() {
    assert_eq!(
        normalize_dialog_extensions(&[
            " .YAML ".to_string(),
            ".json".to_string(),
            "  ".to_string()
        ]),
        vec!["yaml".to_string(), "json".to_string()]
    );
}

#[test]
fn save_file_name_appends_missing_extension_once() {
    assert_eq!(
        normalize_save_file_name("config", ".YAML"),
        ("config.yaml".to_string(), "yaml".to_string())
    );
    assert_eq!(
        normalize_save_file_name("config.YAML", "yaml"),
        ("config.YAML".to_string(), "yaml".to_string())
    );
}

#[test]
fn save_path_extension_is_enforced_after_dialog_selection() {
    assert_eq!(
        ensure_save_path_extension(PathBuf::from(r"C:\tmp\config"), "yaml"),
        PathBuf::from(r"C:\tmp\config.yaml")
    );
    assert_eq!(
        ensure_save_path_extension(PathBuf::from(r"C:\tmp\config.YAML"), "yaml"),
        PathBuf::from(r"C:\tmp\config.YAML")
    );
    assert_eq!(
        ensure_save_path_extension(PathBuf::from(r"C:\tmp\config"), ""),
        PathBuf::from(r"C:\tmp\config")
    );
}

#[cfg(target_os = "windows")]
#[test]
fn bgra_icon_pixels_fallback_to_opaque_when_alpha_is_empty() {
    let bgra = [10, 20, 30, 0, 40, 50, 60, 0];
    assert_eq!(
        bgra_to_rgba_with_alpha_fallback(&bgra),
        vec![30, 20, 10, 255, 60, 50, 40, 255]
    );
}

#[cfg(target_os = "windows")]
#[test]
fn bgra_icon_pixels_preserve_existing_alpha() {
    let bgra = [10, 20, 30, 0, 40, 50, 60, 128];
    assert_eq!(
        bgra_to_rgba_with_alpha_fallback(&bgra),
        vec![30, 20, 10, 0, 60, 50, 40, 128]
    );
}

#[test]
fn geo_dat_validation_rejects_common_text_downloads() {
    let html = b"<html><body>not found</body></html>";

    assert!(ipc::validate_geo_data_bytes("geoip", html).is_err());
    assert!(ipc::validate_geo_data_bytes("geosite", html).is_err());
}

#[test]
fn geo_data_validation_accepts_expected_binary_markers() {
    let dat_with_one_entry = [0x0a, 0x01, 0x00];
    let mut mmdb = b"metadata".to_vec();
    mmdb.extend_from_slice(b"\xAB\xCD\xEFMaxMind.com");

    assert!(ipc::validate_geo_data_bytes("geoip", &dat_with_one_entry).is_ok());
    assert!(ipc::validate_geo_data_bytes("mmdb", &mmdb).is_ok());
}

#[test]
fn mmdb_validation_rejects_missing_metadata_marker() {
    assert!(ipc::validate_geo_data_bytes("asn", b"not an mmdb").is_err());
}

#[test]
fn missing_geo_data_error_requires_missing_file_signal() {
    let no_geo_runtime = json!({
        "rules": ["MATCH,DIRECT"]
    });
    let geo_runtime = json!({
        "rules": ["GEOIP,CN,DIRECT", "MATCH,Proxy"]
    });
    let dns_geo_runtime = json!({
        "dns": {
            "fallback-filter": {
                "geoip": true,
                "geoip-code": "CN"
            }
        },
        "rules": ["MATCH,DIRECT"]
    });

    assert!(is_missing_geo_data_error(
        "can't initial GeoIP: open geoip.dat: no such file or directory",
        &geo_runtime
    ));
    assert!(is_missing_geo_data_error(
        "can't load geosite: The system cannot find the file specified",
        &json!({ "rules": ["GEOSITE,cn,DIRECT"] })
    ));
    assert!(is_missing_geo_data_error(
        "can't load geosite.dat: file not found",
        &json!({ "rules": ["GEOSITE,cn,DIRECT"] })
    ));
    assert!(is_missing_geo_data_error(
        "can't load GeoIP mmdb: no such file or directory",
        &dns_geo_runtime
    ));
    assert!(!is_missing_geo_data_error(
        "can't initial GeoIP: open geoip.dat: no such file or directory",
        &no_geo_runtime
    ));
    assert!(!is_missing_geo_data_error(
        "parse rule failed: unsupported geoip option in rule",
        &geo_runtime
    ));
    assert!(!is_missing_geo_data_error(
        "geosite category geolocation-unknown not found",
        &json!({ "rules": ["GEOSITE,geolocation-unknown,DIRECT"] })
    ));
    assert!(!is_missing_geo_data_error(
        "proxy group Selector is empty",
        &geo_runtime
    ));
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
fn runtime_tray_icons_are_embedded() {
    for file_name in [
        "icon_tun.ico",
        "icon_tun_tray.ico",
        "icon_proxy.ico",
        "icon_proxy_tray.ico",
        "icon.ico",
        "icon_tray.ico",
        "icon.png",
        "iconTemplate.png",
    ] {
        let bytes = embedded_app_icon_bytes(file_name)
            .unwrap_or_else(|| panic!("expected embedded icon bytes for {file_name}"));
        assert!(!bytes.is_empty(), "embedded icon should not be empty: {file_name}");
    }
}

#[test]
fn elevated_startup_requests_admin_when_unelevated_task_is_missing() {
    assert_eq!(
        choose_windows_unelevated_startup_action(false),
        WindowsUnelevatedStartupAction::RequestAdminRegistration
    );
}

#[cfg(target_os = "windows")]
#[test]
fn shell_execute_parameters_quote_only_when_needed() {
    assert_eq!(shell_execute_parameters(Vec::<String>::new()), "");
    assert_eq!(
        shell_execute_parameters(vec![
            "plain".to_string(),
            "has space".to_string(),
            "has\"quote".to_string(),
            String::new()
        ]),
        r#"plain "has space" "has\"quote" """#
    );
}

#[cfg(target_os = "windows")]
#[test]
fn admin_relaunch_args_replace_stale_parent_pid() {
    assert_eq!(
        admin_relaunch_args(
            vec![
                "first".to_string(),
                ROUTEX_ADMIN_RELAUNCH_PARENT_ARG.to_string(),
                "111".to_string(),
                "second".to_string()
            ],
            222
        ),
        vec![
            ROUTEX_ADMIN_RELAUNCH_PARENT_ARG.to_string(),
            "222".to_string(),
            "first".to_string(),
            "second".to_string()
        ]
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
fn default_theme_sorts_before_downloaded_themes() {
    assert!(theme_sort_rank(DEFAULT_THEME_FILE_NAME) < theme_sort_rank("anime.css"));
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
