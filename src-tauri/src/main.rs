#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    collections::{HashMap, HashSet, VecDeque},
    fs::{self, OpenOptions},
    io::{Cursor, Read, Seek, SeekFrom, Write},
    net::{TcpListener, ToSocketAddrs},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering as AtomicOrdering},
        mpsc, Arc, Mutex, OnceLock,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use quick_xml::{events::Event, Reader};
use reqwest::blocking::Client;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha512};
use tauri::{
    image::Image,
    menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, PhysicalPosition, Position, State, WebviewUrl, WebviewWindowBuilder,
    WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};
use time::{macros::format_description, OffsetDateTime};
use walkdir::WalkDir;
use zip::{write::FileOptions, CompressionMethod, ZipArchive, ZipWriter};

const STORAGE_DIR_NAME: &str = "tauri-store";
const APP_CONFIG_FILE: &str = "app-config.json";
const CHAINS_CONFIG_FILE: &str = "chains-config.json";
const CONTROLLED_CONFIG_FILE: &str = "controlled-mihomo-config.json";
const PROFILE_CONFIG_FILE: &str = "profile-config.json";
const OVERRIDE_CONFIG_FILE: &str = "override-config.json";
const PROVIDER_STATS_FILE: &str = "provider-stats.json";
const TRAFFIC_STATS_FILE: &str = "traffic-stats.json";
const PROFILE_DIR_NAME: &str = "profiles";
const OVERRIDE_DIR_NAME: &str = "overrides";
const THEME_DIR_NAME: &str = "themes";
const RUNTIME_DIR_NAME: &str = "runtime-files";
const TAURI_CORE_DIR_NAME: &str = "tauri-core";
const UPDATES_DIR_NAME: &str = "updates";
const TASKS_DIR_NAME: &str = "tasks";
const RUNTIME_ASSETS_DIR_NAME: &str = "runtime-assets";
#[cfg(target_os = "windows")]
const WINDOWS_APP_DATA_DIR_NAME: &str = "routex.app";
const DEFAULT_PROFILE_TEXT: &str = "proxies: []\nproxy-groups: []\nrules: []\n";
const FLOATING_WINDOW_LABEL: &str = "floating";
const FLOATING_WINDOW_STATE_FILE: &str = "floating-window-state.json";
const TRAYMENU_WINDOW_LABEL: &str = "traymenu";
const TRAY_ICON_ID: &str = "main";
const TRAY_MENU_SHOW_WINDOW_ID: &str = "tray.show-window";
const TRAY_MENU_TOGGLE_FLOATING_ID: &str = "tray.toggle-floating";
const TRAY_MENU_TOGGLE_SYS_PROXY_ID: &str = "tray.toggle-sysproxy";
const TRAY_MENU_TOGGLE_TUN_ID: &str = "tray.toggle-tun";
const TRAY_MENU_MODE_RULE_ID: &str = "tray.mode.rule";
const TRAY_MENU_MODE_GLOBAL_ID: &str = "tray.mode.global";
const TRAY_MENU_MODE_DIRECT_ID: &str = "tray.mode.direct";
const TRAY_MENU_QUIT_ID: &str = "tray.quit";
const SHORTCUT_ACTION_KEYS: [&str; 9] = [
    "showWindowShortcut",
    "showFloatingWindowShortcut",
    "triggerSysProxyShortcut",
    "triggerTunShortcut",
    "ruleModeShortcut",
    "globalModeShortcut",
    "directModeShortcut",
    "quitWithoutCoreShortcut",
    "restartAppShortcut",
];
const ROUTEX_RUN_TASK_NAME: &str = "routex-run";
const ROUTEX_RUN_BINARY: &str = "routex-run.exe";
const ROUTEX_RUN_XML: &str = "routex-run.xml";
const ROUTEX_AUTORUN_TASK_NAME: &str = "routex";
const ROUTEX_AUTORUN_XML: &str = "routex-autorun.xml";
#[cfg(target_os = "linux")]
const ROUTEX_DESKTOP_NAME: &str = "routex.desktop";
const ENABLE_LOOPBACK_URL: &str =
    "https://github.com/Kuingsmile/uwp-tool/releases/download/latest/enableLoopback.exe";
const THEME_ZIP_URL: &str =
    "https://github.com/Jarv1s0/theme-hub/releases/download/latest/themes.zip";
const NETWORK_CONNECTIVITY_CHECK_URL: &str = "http://cp.cloudflare.com/generate_204";
const NETWORK_HEALTH_TEST_INTERVAL: Duration = Duration::from_secs(15);
const NETWORK_HEALTH_TIMEOUT: Duration = Duration::from_secs(5);
const NETWORK_HEALTH_MAX_HISTORY: usize = 60;
const MIN_CONNECTION_INTERVAL_MS: u64 = 250;
const MAX_TRAFFIC_HOURLY_RECORDS: usize = 24 * 7;
const MAX_TRAFFIC_DAILY_RECORDS: usize = 30;

static APP_STARTED_AT: OnceLock<Instant> = OnceLock::new();
static ICON_DATA_URL_CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

#[derive(Default)]
struct CoreRuntime {
    child: Option<Child>,
    binary_path: Option<PathBuf>,
    work_dir: Option<PathBuf>,
    log_path: Option<PathBuf>,
    controller_url: Option<String>,
    config_path: Option<PathBuf>,
}

struct PacServerHandle {
    shutdown: mpsc::Sender<()>,
}

struct NetworkDetectionHandle {
    shutdown: mpsc::Sender<()>,
}

struct NetworkHealthMonitorHandle {
    shutdown: mpsc::Sender<()>,
}

struct CoreEventsMonitorHandle {
    shutdown: mpsc::Sender<()>,
}

#[derive(Debug, Clone)]
struct NetworkHealthState {
    latency_history: Vec<i64>,
    dns_latency_history: Vec<i64>,
    test_count: u64,
    fail_count: u64,
}

impl Default for NetworkHealthState {
    fn default() -> Self {
        Self {
            latency_history: Vec::new(),
            dns_latency_history: Vec::new(),
            test_count: 0,
            fail_count: 0,
        }
    }
}

#[derive(Default)]
struct CoreState {
    runtime: Mutex<CoreRuntime>,
    last_sysproxy_signature: Mutex<Option<String>>,
    pac_server: Mutex<Option<PacServerHandle>>,
    network_detection: Mutex<Option<NetworkDetectionHandle>>,
    core_events_monitor: Mutex<Option<CoreEventsMonitorHandle>>,
    network_health_monitor: Mutex<Option<NetworkHealthMonitorHandle>>,
    network_health_state: Mutex<NetworkHealthState>,
    network_down_handled: Mutex<bool>,
    update_download_cancel: Mutex<Option<Arc<AtomicBool>>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct ProfileConfigData {
    #[serde(skip_serializing_if = "Option::is_none")]
    current: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    actives: Option<Vec<String>>,
    #[serde(default)]
    items: Vec<ProfileItemData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ProfileItemData {
    id: String,
    #[serde(rename = "type")]
    item_type: String,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    fingerprint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ua: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    verify: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    interval: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    home: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    updated: Option<u64>,
    #[serde(rename = "override", skip_serializing_if = "Option::is_none")]
    override_ids: Option<Vec<String>>,
    #[serde(rename = "useProxy", skip_serializing_if = "Option::is_none")]
    use_proxy: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    extra: Option<Value>,
    #[serde(rename = "resetDay", skip_serializing_if = "Option::is_none")]
    reset_day: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    substore: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    locked: Option<bool>,
    #[serde(rename = "autoUpdate", skip_serializing_if = "Option::is_none")]
    auto_update: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct ProfileItemInput {
    id: Option<String>,
    #[serde(rename = "type")]
    item_type: Option<String>,
    name: Option<String>,
    url: Option<String>,
    fingerprint: Option<String>,
    ua: Option<String>,
    file: Option<String>,
    verify: Option<bool>,
    interval: Option<u64>,
    home: Option<String>,
    updated: Option<u64>,
    #[serde(rename = "override")]
    override_ids: Option<Vec<String>>,
    #[serde(rename = "useProxy")]
    use_proxy: Option<bool>,
    extra: Option<Value>,
    #[serde(rename = "resetDay")]
    reset_day: Option<u64>,
    substore: Option<bool>,
    locked: Option<bool>,
    #[serde(rename = "autoUpdate")]
    auto_update: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct OverrideConfigData {
    #[serde(default)]
    items: Vec<OverrideItemData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OverrideItemData {
    id: String,
    #[serde(rename = "type")]
    item_type: String,
    ext: String,
    name: String,
    updated: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    global: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    fingerprint: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct OverrideItemInput {
    id: Option<String>,
    #[serde(rename = "type")]
    item_type: Option<String>,
    ext: Option<String>,
    name: Option<String>,
    global: Option<bool>,
    url: Option<String>,
    file: Option<String>,
    fingerprint: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct WebdavConfig {
    url: String,
    username: String,
    password: String,
    dir: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct IpInfoQueryInput {
    query: String,
    lang: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct ReleaseManifestFile {
    url: Option<String>,
    sha512: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct ReleaseManifest {
    version: String,
    path: Option<String>,
    sha512: Option<String>,
    files: Option<Vec<ReleaseManifestFile>>,
    #[serde(rename = "releaseNotes")]
    release_notes: Option<serde_yaml::Value>,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct GistInfo {
    html_url: String,
    description: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct ProviderSnapshotData {
    date: String,
    provider: String,
    used: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct ProviderStatsData {
    #[serde(default)]
    snapshots: Vec<ProviderSnapshotData>,
    #[serde(rename = "lastUpdate")]
    last_update: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct TrafficHourlyStats {
    hour: String,
    upload: u64,
    download: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct TrafficDailyStats {
    date: String,
    upload: u64,
    download: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TrafficStatsStore {
    #[serde(default)]
    hourly: Vec<TrafficHourlyStats>,
    #[serde(default)]
    daily: Vec<TrafficDailyStats>,
    #[serde(rename = "lastUpdate")]
    last_update: u64,
    #[serde(rename = "sessionUpload")]
    session_upload: u64,
    #[serde(rename = "sessionDownload")]
    session_download: u64,
}

impl Default for TrafficStatsStore {
    fn default() -> Self {
        Self {
            hourly: Vec::new(),
            daily: Vec::new(),
            last_update: current_timestamp_ms(),
            session_upload: 0,
            session_download: 0,
        }
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
struct TrafficSampleInput {
    up: Option<u64>,
    down: Option<u64>,
    hour: Option<String>,
    date: Option<String>,
    timestamp: Option<u64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct ChainsConfigData {
    #[serde(default)]
    items: Vec<ChainItemData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChainItemData {
    id: String,
    name: String,
    #[serde(rename = "dialerProxy")]
    dialer_proxy: String,
    #[serde(rename = "targetProxy")]
    target_proxy: String,
    #[serde(rename = "targetGroups", default)]
    target_groups: Vec<String>,
    enabled: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct ChainItemInput {
    id: Option<String>,
    name: Option<String>,
    #[serde(rename = "dialerProxy")]
    dialer_proxy: Option<String>,
    #[serde(rename = "targetProxy")]
    target_proxy: Option<String>,
    #[serde(rename = "targetGroups")]
    target_groups: Option<Vec<String>>,
    enabled: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct FloatingWindowState {
    x: i32,
    y: i32,
}

fn platform_name() -> &'static str {
    match std::env::consts::OS {
        "windows" => "win32",
        "macos" => "darwin",
        other => other,
    }
}

fn apply_window_theme(_window: &tauri::WebviewWindow, theme: Option<&str>) {
    let _ = theme;
}

fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn current_local_date_string() -> String {
    OffsetDateTime::now_local()
        .unwrap_or_else(|_| OffsetDateTime::now_utc())
        .format(&format_description!("[year]-[month]-[day]"))
        .unwrap_or_else(|_| "1970-01-01".to_string())
}

fn get_app_memory_value() -> u64 {
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!("(Get-Process -Id {}).WorkingSet64", std::process::id()),
            ])
            .output()
        {
            if output.status.success() {
                if let Ok(value) = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .parse::<u64>()
                {
                    return value;
                }
            }
        }
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        if let Ok(output) = Command::new("ps")
            .args(["-o", "rss=", "-p", &std::process::id().to_string()])
            .output()
        {
            if output.status.success() {
                if let Ok(value) = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .parse::<u64>()
                {
                    return value.saturating_mul(1024);
                }
            }
        }
    }

    0
}

fn default_sysproxy_bypass() -> Vec<String> {
    if cfg!(target_os = "linux") {
        return vec![
            "localhost".to_string(),
            ".local".to_string(),
            "127.0.0.1/8".to_string(),
            "192.168.0.0/16".to_string(),
            "10.0.0.0/8".to_string(),
            "172.16.0.0/12".to_string(),
            "::1".to_string(),
        ];
    }

    if cfg!(target_os = "macos") {
        return vec![
            "127.0.0.1/8".to_string(),
            "192.168.0.0/16".to_string(),
            "10.0.0.0/8".to_string(),
            "172.16.0.0/12".to_string(),
            "localhost".to_string(),
            "*.local".to_string(),
            "*.crashlytics.com".to_string(),
            "<local>".to_string(),
        ];
    }

    vec![
        "localhost".to_string(),
        "127.*".to_string(),
        "192.168.*".to_string(),
        "10.*".to_string(),
        "172.16.*".to_string(),
        "172.17.*".to_string(),
        "172.18.*".to_string(),
        "172.19.*".to_string(),
        "172.20.*".to_string(),
        "172.21.*".to_string(),
        "172.22.*".to_string(),
        "172.23.*".to_string(),
        "172.24.*".to_string(),
        "172.25.*".to_string(),
        "172.26.*".to_string(),
        "172.27.*".to_string(),
        "172.28.*".to_string(),
        "172.29.*".to_string(),
        "172.30.*".to_string(),
        "172.31.*".to_string(),
        "<local>".to_string(),
    ]
}

fn json_array_strings(value: Option<&Value>) -> Vec<String> {
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

fn create_id() -> String {
    format!("{:x}", current_timestamp_ms())
}

fn default_empty_profile_item() -> ProfileItemData {
    ProfileItemData {
        id: "default".to_string(),
        item_type: "local".to_string(),
        name: "空白订阅".to_string(),
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
        substore: None,
        locked: None,
        auto_update: Some(true),
    }
}

fn dedupe_ids(ids: impl IntoIterator<Item = String>) -> Vec<String> {
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

fn normalize_profile_config(mut config: ProfileConfigData) -> ProfileConfigData {
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

    let mut actives = dedupe_ids(config.actives.unwrap_or_default().into_iter())
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

fn default_app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

fn copy_path_if_missing(source: &Path, target: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }

    if source.is_dir() {
        fs::create_dir_all(target).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            copy_path_if_missing(&entry.path(), &target.join(entry.file_name()))?;
        }
        return Ok(());
    }

    if target.exists() {
        return Ok(());
    }

    ensure_parent(target)?;
    fs::copy(source, target)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn migrate_tauri_app_data_root_if_needed(
    source_root: &Path,
    target_root: &Path,
) -> Result<(), String> {
    if source_root == target_root || !source_root.exists() {
        return Ok(());
    }

    let target_store = target_root.join(STORAGE_DIR_NAME);
    let target_core = target_root.join(TAURI_CORE_DIR_NAME);
    if target_store.exists() && target_core.exists() {
        return Ok(());
    }

    fs::create_dir_all(target_root).map_err(|e| e.to_string())?;

    for entry_name in [
        STORAGE_DIR_NAME,
        TAURI_CORE_DIR_NAME,
        UPDATES_DIR_NAME,
        TASKS_DIR_NAME,
        RUNTIME_ASSETS_DIR_NAME,
    ] {
        copy_path_if_missing(&source_root.join(entry_name), &target_root.join(entry_name))?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let default_root = default_app_data_root(app)?;
    let target_root = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|base| base.join(WINDOWS_APP_DATA_DIR_NAME))
        .or_else(|| default_root.parent().map(|parent| parent.join(WINDOWS_APP_DATA_DIR_NAME)))
        .unwrap_or_else(|| default_root.clone());

    migrate_tauri_app_data_root_if_needed(&default_root, &target_root)?;
    fs::create_dir_all(&target_root).map_err(|e| e.to_string())?;
    Ok(target_root)
}

#[cfg(not(target_os = "windows"))]
fn app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = default_app_data_root(app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn app_storage_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_root(app)?.join(STORAGE_DIR_NAME);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn storage_file(app: &tauri::AppHandle, file_name: &str) -> Result<PathBuf, String> {
    Ok(app_storage_root(app)?.join(file_name))
}

fn storage_dir(app: &tauri::AppHandle, dir_name: &str) -> Result<PathBuf, String> {
    let dir = app_storage_root(app)?.join(dir_name);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[cfg(target_os = "windows")]
fn legacy_electron_data_dir_candidates(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Some(app_data) = std::env::var_os("APPDATA") {
        let base = PathBuf::from(app_data);
        candidates.push(base.join("RouteX"));
        candidates.push(base.join("routex"));
        candidates.push(base.join(WINDOWS_APP_DATA_DIR_NAME));
    }

    if let Ok(app_data_dir) = default_app_data_root(app) {
        if let Some(parent) = app_data_dir.parent() {
            candidates.push(parent.join("RouteX"));
            candidates.push(parent.join("routex"));
            candidates.push(parent.join(WINDOWS_APP_DATA_DIR_NAME));
        }
    }

    let mut deduped = Vec::new();
    for candidate in candidates {
        if !deduped.contains(&candidate) {
            deduped.push(candidate);
        }
    }

    deduped
}

#[cfg(not(target_os = "windows"))]
fn legacy_electron_data_dir_candidates(_app: &tauri::AppHandle) -> Vec<PathBuf> {
    Vec::new()
}

fn migrate_legacy_app_config_if_needed(app: &tauri::AppHandle) -> Result<(), String> {
    let target = storage_file(app, APP_CONFIG_FILE)?;
    if target.exists() {
        return Ok(());
    }

    for candidate in legacy_electron_data_dir_candidates(app) {
        let legacy_path = candidate.join("config.yaml");
        if !legacy_path.exists() {
            continue;
        }

        let text = match fs::read_to_string(&legacy_path) {
            Ok(text) if !text.trim().is_empty() => text,
            _ => continue,
        };

        let yaml = match serde_yaml::from_str::<serde_yaml::Value>(&text) {
            Ok(value) => value,
            Err(_) => continue,
        };

        let json_value = serde_json::to_value(yaml).map_err(|e| e.to_string())?;
        if json_value.is_object() {
            write_value_store(app, APP_CONFIG_FILE, &json_value)?;
            return Ok(());
        }
    }

    Ok(())
}

fn read_legacy_app_config(app: &tauri::AppHandle) -> Result<Option<Value>, String> {
    for candidate in legacy_electron_data_dir_candidates(app) {
        let legacy_path = candidate.join("config.yaml");
        if !legacy_path.exists() {
            continue;
        }

        let text = match fs::read_to_string(&legacy_path) {
            Ok(text) if !text.trim().is_empty() => text,
            _ => continue,
        };

        let yaml = match serde_yaml::from_str::<serde_yaml::Value>(&text) {
            Ok(value) => value,
            Err(_) => continue,
        };

        let json_value = serde_json::to_value(yaml).map_err(|e| e.to_string())?;
        if json_value.is_object() {
            return Ok(Some(json_value));
        }
    }

    Ok(None)
}

fn should_replace_with_legacy_app_config(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return true;
    };

    object.len() <= 8
        || !object.contains_key("customTheme")
        || !object.contains_key("siderWidth")
        || !object.contains_key("collapseSidebar")
        || !object.contains_key("showFloatingWindow")
}

fn migrate_legacy_themes_if_needed(app: &tauri::AppHandle) -> Result<(), String> {
    let target_dir = storage_dir(app, THEME_DIR_NAME)?;
    let mut target_iter = fs::read_dir(&target_dir).map_err(|e| e.to_string())?;
    if target_iter.next().is_some() {
        return Ok(());
    }

    for candidate in legacy_electron_data_dir_candidates(app) {
        let legacy_dir = candidate.join(THEME_DIR_NAME);
        if !legacy_dir.is_dir() {
            continue;
        }

        let mut copied_any = false;
        for entry in fs::read_dir(&legacy_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let source = entry.path();
            if !source.is_file() {
                continue;
            }

            let Some(file_name) = source.file_name().and_then(|name| name.to_str()) else {
                continue;
            };

            if !file_name.ends_with(".css") {
                continue;
            }

            let target = target_dir.join(file_name);
            fs::copy(&source, &target).map_err(|e| e.to_string())?;
            copied_any = true;
        }

        if copied_any {
            return Ok(());
        }
    }

    Ok(())
}

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn read_json_file<T: DeserializeOwned>(path: &Path) -> Result<Option<T>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if text.trim().is_empty() {
        return Ok(None);
    }

    serde_json::from_str::<T>(&text)
        .map(Some)
        .map_err(|e| e.to_string())
}

fn write_json_file<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    ensure_parent(path)?;
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

fn read_floating_window_state(
    app: &tauri::AppHandle,
) -> Result<Option<FloatingWindowState>, String> {
    let path = storage_file(app, FLOATING_WINDOW_STATE_FILE)?;
    read_json_file(&path)
}

fn write_floating_window_state(
    app: &tauri::AppHandle,
    state: &FloatingWindowState,
) -> Result<(), String> {
    let path = storage_file(app, FLOATING_WINDOW_STATE_FILE)?;
    write_json_file(&path, state)
}

fn merge_json(base: &mut Value, patch: &Value) {
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

fn trim_wrapped_key(key: &str) -> &str {
    if key.starts_with('<') && key.ends_with('>') && key.len() > 2 {
        &key[1..key.len() - 1]
    } else {
        key
    }
}

fn merge_config_value(base: &mut Value, patch: &Value, is_override: bool) {
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

fn read_value_store(
    app: &tauri::AppHandle,
    file_name: &str,
    default: Value,
) -> Result<Value, String> {
    let path = storage_file(app, file_name)?;
    Ok(read_json_file(&path)?.unwrap_or(default))
}

fn write_value_store(app: &tauri::AppHandle, file_name: &str, value: &Value) -> Result<(), String> {
    let path = storage_file(app, file_name)?;
    write_json_file(&path, value)
}

fn read_traffic_stats_store(app: &tauri::AppHandle) -> Result<TrafficStatsStore, String> {
    let path = storage_file(app, TRAFFIC_STATS_FILE)?;
    Ok(read_json_file(&path)?.unwrap_or_default())
}

fn write_traffic_stats_store(
    app: &tauri::AppHandle,
    stats: &TrafficStatsStore,
) -> Result<(), String> {
    let path = storage_file(app, TRAFFIC_STATS_FILE)?;
    write_json_file(&path, stats)
}

fn initialize_traffic_stats_store(app: &tauri::AppHandle) -> Result<(), String> {
    let mut stats = read_traffic_stats_store(app)?;
    stats.session_upload = 0;
    stats.session_download = 0;
    stats.last_update = current_timestamp_ms();
    write_traffic_stats_store(app, &stats)
}

fn trim_recent_records<T>(records: &mut Vec<T>, max_len: usize) {
    if records.len() > max_len {
        let keep_from = records.len().saturating_sub(max_len);
        records.drain(0..keep_from);
    }
}

fn accumulate_hourly_traffic_record(
    records: &mut Vec<TrafficHourlyStats>,
    hour_key: &str,
    upload: u64,
    download: u64,
) {
    if let Some(record) = records.iter_mut().find(|item| item.hour == hour_key) {
        record.upload += upload;
        record.download += download;
        return;
    }

    records.push(TrafficHourlyStats {
        hour: hour_key.to_string(),
        upload,
        download,
    });
    trim_recent_records(records, MAX_TRAFFIC_HOURLY_RECORDS);
}

fn accumulate_daily_traffic_record(
    records: &mut Vec<TrafficDailyStats>,
    date_key: &str,
    upload: u64,
    download: u64,
) {
    if let Some(record) = records.iter_mut().find(|item| item.date == date_key) {
        record.upload += upload;
        record.download += download;
        return;
    }

    records.push(TrafficDailyStats {
        date: date_key.to_string(),
        upload,
        download,
    });
    trim_recent_records(records, MAX_TRAFFIC_DAILY_RECORDS);
}

fn record_traffic_sample(
    app: &tauri::AppHandle,
    sample: TrafficSampleInput,
) -> Result<TrafficStatsStore, String> {
    let Some(hour_key) = sample.hour.filter(|value| !value.trim().is_empty()) else {
        return Ok(read_traffic_stats_store(app)?);
    };
    let Some(date_key) = sample.date.filter(|value| !value.trim().is_empty()) else {
        return Ok(read_traffic_stats_store(app)?);
    };

    let upload = sample.up.unwrap_or(0);
    let download = sample.down.unwrap_or(0);
    let mut stats = read_traffic_stats_store(app)?;

    accumulate_hourly_traffic_record(&mut stats.hourly, &hour_key, upload, download);
    accumulate_daily_traffic_record(&mut stats.daily, &date_key, upload, download);

    stats.session_upload += upload;
    stats.session_download += download;
    stats.last_update = sample.timestamp.unwrap_or_else(current_timestamp_ms);

    write_traffic_stats_store(app, &stats)?;
    Ok(stats)
}

fn clear_traffic_stats_store(app: &tauri::AppHandle) -> Result<(), String> {
    write_traffic_stats_store(app, &TrafficStatsStore::default())
}

fn read_app_config_store(app: &tauri::AppHandle) -> Result<Value, String> {
    migrate_legacy_app_config_if_needed(app)?;
    let current = read_value_store(app, APP_CONFIG_FILE, json!({}))?;

    if should_replace_with_legacy_app_config(&current) {
        if let Some(legacy) = read_legacy_app_config(app)? {
            write_value_store(app, APP_CONFIG_FILE, &legacy)?;
            return Ok(legacy);
        }
    }

    Ok(current)
}

fn patch_app_config_store(app: &tauri::AppHandle, patch: &Value) -> Result<Value, String> {
    let mut value = read_app_config_store(app)?;
    merge_json(&mut value, patch);
    write_value_store(app, APP_CONFIG_FILE, &value)?;
    Ok(value)
}

fn read_connection_interval_ms(app: &tauri::AppHandle) -> u64 {
    read_app_config_store(app)
        .ok()
        .and_then(|config| config.get("connectionInterval").and_then(Value::as_u64))
        .map(|value| value.max(MIN_CONNECTION_INTERVAL_MS))
        .unwrap_or(MIN_CONNECTION_INTERVAL_MS)
}

fn read_controlled_config_store(app: &tauri::AppHandle) -> Result<Value, String> {
    read_value_store(app, CONTROLLED_CONFIG_FILE, json!({}))
}

fn patch_controlled_config_store(app: &tauri::AppHandle, patch: &Value) -> Result<Value, String> {
    let mut value = read_controlled_config_store(app)?;
    let app_config = read_app_config_store(app)?;
    let control_dns = app_config
        .get("controlDns")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let control_sniff = app_config
        .get("controlSniff")
        .and_then(Value::as_bool)
        .unwrap_or(true);

    if let Some(object) = value.as_object_mut() {
        if !control_dns {
            object.remove("dns");
            object.remove("hosts");
        }
        if !control_sniff {
            object.remove("sniffer");
        }
    }

    merge_json(&mut value, patch);

    if let Some(object) = value.as_object_mut() {
        if !control_dns {
            object.remove("dns");
            object.remove("hosts");
        }
        if !control_sniff {
            object.remove("sniffer");
        }
    }

    write_value_store(app, CONTROLLED_CONFIG_FILE, &value)?;
    Ok(value)
}

fn read_profile_config(app: &tauri::AppHandle) -> Result<ProfileConfigData, String> {
    let path = storage_file(app, PROFILE_CONFIG_FILE)?;
    Ok(normalize_profile_config(
        read_json_file(&path)?.unwrap_or_default(),
    ))
}

fn write_profile_config(app: &tauri::AppHandle, config: &ProfileConfigData) -> Result<(), String> {
    let path = storage_file(app, PROFILE_CONFIG_FILE)?;
    let normalized = normalize_profile_config(config.clone());
    write_json_file(&path, &normalized)
}

fn read_override_config(app: &tauri::AppHandle) -> Result<OverrideConfigData, String> {
    let path = storage_file(app, OVERRIDE_CONFIG_FILE)?;
    Ok(read_json_file(&path)?.unwrap_or_default())
}

fn write_override_config(
    app: &tauri::AppHandle,
    config: &OverrideConfigData,
) -> Result<(), String> {
    let path = storage_file(app, OVERRIDE_CONFIG_FILE)?;
    write_json_file(&path, config)
}

fn read_chains_config(app: &tauri::AppHandle) -> Result<ChainsConfigData, String> {
    let path = storage_file(app, CHAINS_CONFIG_FILE)?;
    Ok(read_json_file(&path)?.unwrap_or_default())
}

fn write_chains_config(app: &tauri::AppHandle, config: &ChainsConfigData) -> Result<(), String> {
    let path = storage_file(app, CHAINS_CONFIG_FILE)?;
    write_json_file(&path, config)
}

fn read_provider_stats(app: &tauri::AppHandle) -> Result<ProviderStatsData, String> {
    let path = storage_file(app, PROVIDER_STATS_FILE)?;
    Ok(read_json_file(&path)?.unwrap_or_default())
}

fn write_provider_stats(app: &tauri::AppHandle, stats: &ProviderStatsData) -> Result<(), String> {
    let path = storage_file(app, PROVIDER_STATS_FILE)?;
    write_json_file(&path, stats)
}

fn profile_file_path(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
    Ok(storage_dir(app, PROFILE_DIR_NAME)?.join(format!("{id}.yaml")))
}

fn read_profile_text(app: &tauri::AppHandle, id: &str) -> Result<String, String> {
    let path = profile_file_path(app, id)?;
    if path.exists() {
        return fs::read_to_string(path).map_err(|e| e.to_string());
    }

    Ok(DEFAULT_PROFILE_TEXT.to_string())
}

fn write_profile_text(app: &tauri::AppHandle, id: &str, content: &str) -> Result<(), String> {
    let path = profile_file_path(app, id)?;
    ensure_parent(&path)?;
    fs::write(path, content).map_err(|e| e.to_string())
}

fn override_file_path(app: &tauri::AppHandle, id: &str, ext: &str) -> Result<PathBuf, String> {
    Ok(storage_dir(app, OVERRIDE_DIR_NAME)?.join(format!("{id}.{ext}")))
}

fn override_rollback_path(app: &tauri::AppHandle, id: &str, ext: &str) -> Result<PathBuf, String> {
    Ok(storage_dir(app, OVERRIDE_DIR_NAME)?.join(format!("{id}.{ext}.rollback")))
}

fn read_override_text(app: &tauri::AppHandle, id: &str, ext: &str) -> Result<String, String> {
    let path = override_file_path(app, id, ext)?;
    if path.exists() {
        return fs::read_to_string(path).map_err(|e| e.to_string());
    }

    Ok(String::new())
}

fn write_override_text(
    app: &tauri::AppHandle,
    id: &str,
    ext: &str,
    content: &str,
) -> Result<(), String> {
    let path = override_file_path(app, id, ext)?;
    let rollback_path = override_rollback_path(app, id, ext)?;

    if path.exists() {
        let previous = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        if previous != content {
            ensure_parent(&rollback_path)?;
            fs::write(&rollback_path, previous).map_err(|e| e.to_string())?;
        }
    }

    ensure_parent(&path)?;
    fs::write(path, content).map_err(|e| e.to_string())
}

fn rollback_override_text(app: &tauri::AppHandle, id: &str, ext: &str) -> Result<(), String> {
    let target_path = override_file_path(app, id, ext)?;
    let rollback_path = override_rollback_path(app, id, ext)?;

    if !rollback_path.exists() {
        return Err("当前覆写没有可回滚的上次内容".to_string());
    }

    let rollback_content = fs::read_to_string(&rollback_path).map_err(|e| e.to_string())?;
    if target_path.exists() {
        let current = fs::read_to_string(&target_path).map_err(|e| e.to_string())?;
        fs::write(&rollback_path, current).map_err(|e| e.to_string())?;
    }
    fs::write(target_path, rollback_content).map_err(|e| e.to_string())
}

fn theme_file_path(app: &tauri::AppHandle, theme: &str) -> Result<PathBuf, String> {
    Ok(storage_dir(app, THEME_DIR_NAME)?.join(theme))
}

fn read_theme_text(app: &tauri::AppHandle, theme: &str) -> Result<String, String> {
    migrate_legacy_themes_if_needed(app)?;
    let path = theme_file_path(app, theme)?;
    if path.exists() {
        return fs::read_to_string(path).map_err(|e| e.to_string());
    }

    Ok(String::new())
}

fn write_theme_text(app: &tauri::AppHandle, theme: &str, css: &str) -> Result<(), String> {
    let path = theme_file_path(app, theme)?;
    ensure_parent(&path)?;
    fs::write(path, css).map_err(|e| e.to_string())
}

fn import_theme_files(app: &tauri::AppHandle, files: &[String]) -> Result<(), String> {
    let themes_dir = storage_dir(app, THEME_DIR_NAME)?;

    for (index, file) in files.iter().enumerate() {
        let source = PathBuf::from(file);
        if !source.exists() || !source.is_file() {
            continue;
        }

        let Some(file_name) = source.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !file_name.to_ascii_lowercase().ends_with(".css") {
            continue;
        }

        let target = themes_dir.join(format!(
            "{}-{}-{}",
            current_timestamp_ms(),
            index,
            file_name
        ));
        fs::copy(&source, target).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn resolve_theme_entries(app: &tauri::AppHandle) -> Result<Vec<Value>, String> {
    migrate_legacy_themes_if_needed(app)?;
    let themes_dir = storage_dir(app, THEME_DIR_NAME)?;
    let mut entries = Vec::new();

    if !themes_dir.exists() {
        fs::create_dir_all(&themes_dir).map_err(|e| e.to_string())?;
    }

    for entry in fs::read_dir(&themes_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };

        if !name.ends_with(".css") {
            continue;
        }

        let content = fs::read_to_string(&path).unwrap_or_default();
        entries.push(json!({
            "key": name,
            "label": name,
            "content": content,
        }));
    }

    if !entries.iter().any(|entry| {
        entry
            .get("key")
            .and_then(Value::as_str)
            .map(|key| key == "CoolApk.css")
            .unwrap_or(false)
    }) {
        entries.push(json!({
            "key": "CoolApk.css",
            "label": "CoolApk.css",
            "content": "",
        }));
    }

    entries.sort_by(|left, right| {
        left.get("key")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .cmp(right.get("key").and_then(Value::as_str).unwrap_or_default())
    });

    Ok(entries)
}

fn fetch_theme_archive(app: &tauri::AppHandle) -> Result<(), String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(THEME_ZIP_URL)
        .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
        .send()
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("主题下载失败: {}", response.status()));
    }

    let bytes = response.bytes().map_err(|e| e.to_string())?;
    let reader = Cursor::new(bytes);
    let mut archive = ZipArchive::new(reader).map_err(|e| e.to_string())?;
    let themes_dir = storage_dir(app, THEME_DIR_NAME)?;

    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|e| e.to_string())?;
        if file.is_dir() {
            continue;
        }

        let name = file.name().replace('\\', "/");
        let file_name = Path::new(&name)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        if !file_name.ends_with(".css") {
            continue;
        }

        let path = themes_dir.join(file_name);
        let mut contents = Vec::new();
        file.read_to_end(&mut contents).map_err(|e| e.to_string())?;
        fs::write(path, contents).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn fetch_image_data_url(url: &str) -> Result<String, String> {
    if url.starts_with("data:") {
        return Ok(url.to_string());
    }
    if url.trim_start().starts_with("<svg") {
        return Ok(format!("data:image/svg+xml;utf8,{url}"));
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
        .send()
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("图片请求失败: {}", response.status()));
    }
    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = response.bytes().map_err(|e| e.to_string())?;
    Ok(to_data_url(&mime, &bytes))
}

fn read_local_icon_data_url(app_path: &str) -> Option<String> {
    let path = PathBuf::from(app_path);
    if !path.exists() || !path.is_file() {
        return None;
    }

    let mime = guess_mime_from_path(&path);
    let bytes = fs::read(path).ok()?;
    Some(to_data_url(mime, &bytes))
}

fn icon_data_url_cache() -> &'static Mutex<HashMap<String, String>> {
    ICON_DATA_URL_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn is_icon_remote_or_data_resource(app_path: &str) -> bool {
    app_path.starts_with("data:")
        || app_path.starts_with("http://")
        || app_path.starts_with("https://")
}

fn normalize_icon_request_path(app_path: &str) -> String {
    if app_path == "mihomo" {
        std::env::current_exe()
            .ok()
            .and_then(|path| path.to_str().map(str::to_string))
            .unwrap_or_else(|| app_path.to_string())
    } else {
        app_path.to_string()
    }
}

fn read_cached_icon_data_url(app_path: &str) -> Option<String> {
    icon_data_url_cache()
        .lock()
        .ok()
        .and_then(|cache| cache.get(app_path).cloned())
}

fn write_cached_icon_data_url(app_path: &str, data_url: String) {
    if let Ok(mut cache) = icon_data_url_cache().lock() {
        cache.insert(app_path.to_string(), data_url);
    }
}

fn is_image_file_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "svg" | "webp" | "ico" | "bmp" | "icns" | "xpm"
    )
}

#[cfg(target_os = "windows")]
fn is_windows_icon_extractable_path(path: &Path) -> bool {
    path.exists()
        && path.is_file()
        && matches!(
            path.extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase()
                .as_str(),
            "exe" | "dll"
        )
}

#[cfg(target_os = "windows")]
fn extract_windows_icon_data_url(app_path: &str) -> Option<String> {
    let path = Path::new(app_path);
    if !is_windows_icon_extractable_path(path) {
        return None;
    }

    let quoted_path = powershell_single_quoted(app_path);
    let script = format!(
        r#"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class RouteXIconExtractor
{{
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern uint PrivateExtractIcons(
        string szFileName,
        int nIconIndex,
        int cxIcon,
        int cyIcon,
        IntPtr[] phicon,
        uint[] piconid,
        uint nIcons,
        uint flags
    );

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool DestroyIcon(IntPtr hIcon);
}}
"@
$path = {quoted_path}
if (-not (Test-Path -LiteralPath $path)) {{
  exit 0
}}
$size = 256
$iconHandle = [IntPtr]::Zero
$handles = New-Object IntPtr[] 1
$iconIds = New-Object UInt32[] 1
$extracted = [RouteXIconExtractor]::PrivateExtractIcons($path, 0, $size, $size, $handles, $iconIds, 1, 0)
if ($extracted -gt 0 -and $handles[0] -ne [IntPtr]::Zero) {{
  $iconHandle = $handles[0]
}}

if ($iconHandle -ne [IntPtr]::Zero) {{
  $icon = [System.Drawing.Icon]::FromHandle($iconHandle).Clone()
  [RouteXIconExtractor]::DestroyIcon($iconHandle) | Out-Null
}} else {{
  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($path)
}}

if ($null -eq $icon) {{
  exit 0
}}
$bitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.DrawIcon($icon, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)))
$stream = New-Object System.IO.MemoryStream
$bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
$icon.Dispose()
[Convert]::ToBase64String($stream.ToArray())
"#
    );

    let output = run_powershell_script(&script).ok()?;
    let base64 = output.trim();
    if base64.is_empty() {
        None
    } else {
        Some(format!("data:image/png;base64,{base64}"))
    }
}

#[cfg(target_os = "windows")]
fn extract_windows_icon_data_urls_batch(app_paths: &[String]) -> HashMap<String, String> {
    if app_paths.is_empty() {
        return HashMap::new();
    }

    let encoded_paths = serde_json::to_vec(app_paths)
        .ok()
        .map(|bytes| BASE64_STANDARD.encode(bytes))
        .unwrap_or_default();
    if encoded_paths.is_empty() {
        return HashMap::new();
    }

    let script = format!(
        r#"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class RouteXIconExtractor
{{
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern uint PrivateExtractIcons(
        string szFileName,
        int nIconIndex,
        int cxIcon,
        int cyIcon,
        IntPtr[] phicon,
        uint[] piconid,
        uint nIcons,
        uint flags
    );

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool DestroyIcon(IntPtr hIcon);
}}
"@
$encodedPaths = '{encoded_paths}'
$json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encodedPaths))
$paths = $json | ConvertFrom-Json
if ($paths -isnot [System.Array]) {{
  $paths = @($paths)
}}

$size = 64
$result = @{{}}
foreach ($path in $paths) {{
  if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path -LiteralPath $path)) {{
    continue
  }}

  $icon = $null
  $iconHandle = [IntPtr]::Zero
  $handles = New-Object IntPtr[] 1
  $iconIds = New-Object UInt32[] 1
  $extracted = [RouteXIconExtractor]::PrivateExtractIcons($path, 0, $size, $size, $handles, $iconIds, 1, 0)
  if ($extracted -gt 0 -and $handles[0] -ne [IntPtr]::Zero) {{
    try {{
      $icon = [System.Drawing.Icon]::FromHandle($handles[0]).Clone()
    }} finally {{
      [RouteXIconExtractor]::DestroyIcon($handles[0]) | Out-Null
    }}
  }} else {{
    try {{
      $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($path)
    }} catch {{
      $icon = $null
    }}
  }}

  if ($null -eq $icon) {{
    continue
  }}

  $bitmap = $null
  $graphics = $null
  $stream = $null
  try {{
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawIcon($icon, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)))
    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $result[$path] = [Convert]::ToBase64String($stream.ToArray())
  }} finally {{
    if ($null -ne $stream) {{
      $stream.Dispose()
    }}
    if ($null -ne $graphics) {{
      $graphics.Dispose()
    }}
    if ($null -ne $bitmap) {{
      $bitmap.Dispose()
    }}
    $icon.Dispose()
  }}
}}

$result | ConvertTo-Json -Compress
"#
    );

    let output = match run_powershell_script(&script) {
        Ok(value) => value,
        Err(_) => return HashMap::new(),
    };

    serde_json::from_str::<HashMap<String, String>>(&output)
        .map(|items| {
            items
                .into_iter()
                .filter(|(_, base64)| !base64.trim().is_empty())
                .map(|(path, base64)| (path, format!("data:image/png;base64,{base64}")))
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(target_os = "macos")]
fn macos_bundle_ancestors(app_path: &str) -> Vec<PathBuf> {
    Path::new(app_path)
        .ancestors()
        .filter(|path| {
            path.file_name()
                .and_then(|value| value.to_str())
                .map(|name| name.ends_with(".app") || name.ends_with(".xpc"))
                .unwrap_or(false)
        })
        .map(Path::to_path_buf)
        .collect()
}

#[cfg(target_os = "macos")]
fn find_macos_bundle_icon_path(bundle_path: &Path) -> Option<PathBuf> {
    let contents_dir = bundle_path.join("Contents");
    if !contents_dir.exists() {
        let mut entries = fs::read_dir(bundle_path)
            .ok()?
            .flatten()
            .collect::<Vec<_>>();
        entries.sort_by_key(|entry| entry.file_name());
        return entries.into_iter().find_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_str()?.to_ascii_lowercase();
            if name.starts_with("appicon") && is_image_file_path(&path) {
                Some(path)
            } else {
                None
            }
        });
    }

    let resources_dir = contents_dir.join("Resources");
    if !resources_dir.exists() {
        return None;
    }

    let mut icons = fs::read_dir(resources_dir)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .and_then(|value| value.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("icns"))
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    icons.sort();
    icons.into_iter().next()
}

#[cfg(target_os = "macos")]
fn convert_macos_icon_to_png_data_url(icon_path: &Path) -> Option<String> {
    if is_image_file_path(icon_path)
        && !icon_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("icns"))
            .unwrap_or(false)
    {
        return read_local_icon_data_url(icon_path.to_str()?);
    }

    let temp_path =
        std::env::temp_dir().join(format!("routex-icon-{}.png", current_timestamp_ms()));
    let output = Command::new("sips")
        .args([
            "-s",
            "format",
            "png",
            icon_path.to_str()?,
            "--out",
            temp_path.to_str()?,
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        let _ = fs::remove_file(&temp_path);
        return None;
    }

    let value = read_local_icon_data_url(temp_path.to_str()?);
    let _ = fs::remove_file(temp_path);
    value
}

#[cfg(target_os = "macos")]
fn extract_macos_icon_data_url(app_path: &str) -> Option<String> {
    let bundle_path = macos_bundle_ancestors(app_path)
        .into_iter()
        .find(|bundle_path| find_macos_bundle_icon_path(bundle_path).is_some())?;
    let icon_path = find_macos_bundle_icon_path(&bundle_path)?;
    convert_macos_icon_to_png_data_url(&icon_path)
}

#[cfg(target_os = "linux")]
fn find_linux_desktop_file(app_path: &str) -> Option<PathBuf> {
    let exec_name = Path::new(app_path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(app_path)
        .to_string();
    let home = std::env::var("HOME").ok();
    let mut desktop_dirs = vec![PathBuf::from("/usr/share/applications")];
    if let Some(home) = home {
        desktop_dirs.push(PathBuf::from(home).join(".local/share/applications"));
    }

    for dir in desktop_dirs {
        if !dir.exists() {
            continue;
        }

        let Ok(entries) = fs::read_dir(dir) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("desktop") {
                continue;
            }

            let Ok(content) = fs::read_to_string(&path) else {
                continue;
            };

            let exec_match = content.lines().find_map(|line| {
                line.strip_prefix("Exec=")
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
            });

            if let Some(exec_line) = exec_match {
                let exec_cmd = exec_line.split_whitespace().next().unwrap_or_default();
                let exec_basename = Path::new(exec_cmd)
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or_default();
                if exec_cmd == app_path
                    || exec_basename == exec_name
                    || exec_cmd.ends_with(app_path)
                    || app_path.ends_with(exec_basename)
                {
                    return Some(path);
                }
            }

            let expected_name = format!("Name={app_path}");
            let expected_generic_name = format!("GenericName={app_path}");
            if content.lines().any(|line| {
                let trimmed = line.trim();
                trimmed == expected_name || trimmed == expected_generic_name
            }) {
                return Some(path);
            }
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn parse_linux_icon_name(content: &str) -> Option<String> {
    content
        .lines()
        .find_map(|line| line.strip_prefix("Icon=").map(str::trim))
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

#[cfg(target_os = "linux")]
fn resolve_linux_icon_path(icon_name: &str) -> Option<PathBuf> {
    let path = PathBuf::from(icon_name);
    if path.is_absolute() && path.exists() {
        return Some(path);
    }

    let home = std::env::var("HOME").ok();
    let mut icon_dirs = vec![
        PathBuf::from("/usr/share/icons/hicolor"),
        PathBuf::from("/usr/share/pixmaps"),
        PathBuf::from("/usr/share/icons/Adwaita"),
    ];
    if let Some(home) = home {
        icon_dirs.push(PathBuf::from(home).join(".local/share/icons"));
    }

    let sizes = [
        "512x512", "256x256", "128x128", "64x64", "48x48", "32x32", "24x24", "16x16",
    ];
    let extensions = ["png", "svg", "xpm"];

    for dir in &icon_dirs {
        for size in sizes {
            for ext in extensions {
                let path = dir
                    .join(size)
                    .join("apps")
                    .join(format!("{icon_name}.{ext}"));
                if path.exists() {
                    return Some(path);
                }
            }
        }
    }

    for ext in extensions {
        let path = PathBuf::from(format!("/usr/share/pixmaps/{icon_name}.{ext}"));
        if path.exists() {
            return Some(path);
        }
    }

    for dir in &icon_dirs {
        for ext in extensions {
            let path = dir.join(format!("{icon_name}.{ext}"));
            if path.exists() {
                return Some(path);
            }
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn extract_linux_icon_data_url(app_path: &str) -> Option<String> {
    let desktop_file = find_linux_desktop_file(app_path)?;
    let content = fs::read_to_string(desktop_file).ok()?;
    let icon_name = parse_linux_icon_name(&content)?;
    let icon_path = resolve_linux_icon_path(&icon_name)?;
    read_local_icon_data_url(icon_path.to_str()?)
}

fn resolve_icon_data_url_uncached(normalized_path: &str) -> String {
    let path = Path::new(&normalized_path);
    if path.exists() && path.is_file() && is_image_file_path(path) {
        return read_local_icon_data_url(&normalized_path)
            .unwrap_or_else(|| default_icon_data_url().to_string());
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(value) = extract_windows_icon_data_url(&normalized_path) {
            return value;
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(value) = extract_macos_icon_data_url(&normalized_path) {
            return value;
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(value) = extract_linux_icon_data_url(&normalized_path) {
            return value;
        }
    }

    read_local_icon_data_url(&normalized_path)
        .unwrap_or_else(|| default_icon_data_url().to_string())
}

fn resolve_icon_data_url(app_path: &str) -> String {
    if is_icon_remote_or_data_resource(app_path) {
        return app_path.to_string();
    }

    let normalized_path = normalize_icon_request_path(app_path);
    if let Some(cached) = read_cached_icon_data_url(&normalized_path) {
        return cached;
    }

    let resolved = resolve_icon_data_url_uncached(&normalized_path);
    write_cached_icon_data_url(&normalized_path, resolved.clone());
    resolved
}

fn resolve_icon_data_urls(app_paths: &[String]) -> HashMap<String, String> {
    let mut resolved = HashMap::new();

    #[cfg(target_os = "windows")]
    let mut pending_windows_paths = HashSet::new();
    #[cfg(target_os = "windows")]
    let mut original_paths_by_normalized = HashMap::<String, Vec<String>>::new();

    for app_path in app_paths {
        if app_path.is_empty() {
            continue;
        }

        if is_icon_remote_or_data_resource(app_path) {
            resolved.insert(app_path.clone(), app_path.clone());
            continue;
        }

        let normalized_path = normalize_icon_request_path(app_path);
        if let Some(cached) = read_cached_icon_data_url(&normalized_path) {
            resolved.insert(app_path.clone(), cached);
            continue;
        }

        let path = Path::new(&normalized_path);
        if path.exists() && path.is_file() && is_image_file_path(path) {
            let value = read_local_icon_data_url(&normalized_path)
                .unwrap_or_else(|| default_icon_data_url().to_string());
            write_cached_icon_data_url(&normalized_path, value.clone());
            resolved.insert(app_path.clone(), value);
            continue;
        }

        #[cfg(target_os = "windows")]
        {
            if is_windows_icon_extractable_path(path) {
                pending_windows_paths.insert(normalized_path.clone());
                original_paths_by_normalized
                    .entry(normalized_path)
                    .or_default()
                    .push(app_path.clone());
                continue;
            }
        }

        let value = resolve_icon_data_url_uncached(&normalized_path);
        write_cached_icon_data_url(&normalized_path, value.clone());
        resolved.insert(app_path.clone(), value);
    }

    #[cfg(target_os = "windows")]
    if !pending_windows_paths.is_empty() {
        let pending_paths = pending_windows_paths.into_iter().collect::<Vec<_>>();
        let batched = extract_windows_icon_data_urls_batch(&pending_paths);

        for (normalized_path, original_paths) in original_paths_by_normalized {
            let value = batched
                .get(&normalized_path)
                .cloned()
                .unwrap_or_else(|| resolve_icon_data_url_uncached(&normalized_path));
            write_cached_icon_data_url(&normalized_path, value.clone());

            for original_path in original_paths {
                resolved.insert(original_path, value.clone());
            }
        }
    }

    resolved
}

fn read_string_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn read_webdav_config(app: &tauri::AppHandle) -> Result<WebdavConfig, String> {
    let config = read_app_config_store(app)?;
    Ok(WebdavConfig {
        url: read_string_field(&config, "webdavUrl"),
        username: read_string_field(&config, "webdavUsername"),
        password: read_string_field(&config, "webdavPassword"),
        dir: {
            let dir = read_string_field(&config, "webdavDir");
            if dir.trim().is_empty() {
                "routex".to_string()
            } else {
                dir
            }
        },
    })
}

fn ensure_webdav_config(config: &WebdavConfig) -> Result<(), String> {
    if config.url.trim().is_empty() {
        return Err("WebDAV 地址未配置".to_string());
    }

    Ok(())
}

fn build_webdav_url(config: &WebdavConfig, child: Option<&str>) -> String {
    let mut base = config.url.trim_end_matches('/').to_string();
    let mut segments = Vec::new();

    if !config.dir.trim().is_empty() {
        segments.extend(
            config
                .dir
                .split('/')
                .filter(|segment| !segment.trim().is_empty())
                .map(|segment| urlencoding::encode(segment).into_owned()),
        );
    }

    if let Some(child) = child {
        segments.extend(
            child
                .split('/')
                .filter(|segment| !segment.trim().is_empty())
                .map(|segment| urlencoding::encode(segment).into_owned()),
        );
    }

    if !segments.is_empty() {
        base.push('/');
        base.push_str(&segments.join("/"));
    }

    base
}

fn get_app_name_value(app_path: &str) -> String {
    Path::new(app_path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(app_path)
        .to_string()
}

fn default_icon_data_url() -> &'static str {
    "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\"><rect width=\"64\" height=\"64\" rx=\"18\" fill=\"%231f6feb\"/><path d=\"M20 21h24a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3V24a3 3 0 0 1 3-3Z\" fill=\"%23fff\" fill-opacity=\".92\"/><path d=\"M24 28h16M24 34h10\" stroke=\"%231f6feb\" stroke-width=\"4\" stroke-linecap=\"round\"/></svg>"
}

fn emit_ipc_event(app: &tauri::AppHandle, channel: &str, payload: Value) {
    let _ = app.emit(channel, payload);
}

fn guess_mime_from_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    }
}

fn to_data_url(mime: &str, bytes: &[u8]) -> String {
    format!("data:{mime};base64,{}", BASE64_STANDARD.encode(bytes))
}

fn resolve_tray_icon_path(app: &tauri::AppHandle, file_name: &str) -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        let path = dev_root()?.join("resources").join(file_name);
        if path.exists() {
            return Ok(path);
        }
    }

    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let path = resource_dir.join(file_name);
    if path.exists() {
        return Ok(path);
    }

    Err(format!("Tray icon not found: {file_name}"))
}

fn set_tray_icon_from_path(app: &tauri::AppHandle, file_name: &str) -> Result<(), String> {
    let Some(tray) = app.tray_by_id(TRAY_ICON_ID) else {
        return Ok(());
    };
    let path = resolve_tray_icon_path(app, file_name)?;
    let image = Image::from_path(path).map_err(|e| e.to_string())?;
    tray.set_icon(Some(image)).map_err(|e| e.to_string())
}

fn update_tray_icon_for_state(app: &tauri::AppHandle) -> Result<(), String> {
    if app.tray_by_id(TRAY_ICON_ID).is_none() {
        return Ok(());
    }

    if cfg!(target_os = "windows") {
        let config = read_app_config_store(app)?;
        let controled = read_controlled_config_store(app)?;
        let sysproxy_enabled = config
            .get("sysProxy")
            .and_then(Value::as_object)
            .and_then(|value| value.get("enable"))
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let tun_enabled = controled
            .get("tun")
            .and_then(Value::as_object)
            .and_then(|value| value.get("enable"))
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let icon_name = if tun_enabled {
            "icon_tun.ico"
        } else if sysproxy_enabled {
            "icon_proxy.ico"
        } else {
            "icon.ico"
        };
        return set_tray_icon_from_path(app, icon_name);
    }

    if cfg!(target_os = "macos") {
        let config = read_app_config_store(app)?;
        let show_traffic = config
            .get("showTraffic")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if !show_traffic {
            return set_tray_icon_from_path(app, "iconTemplate.png");
        }
    }

    if cfg!(target_os = "linux") {
        return set_tray_icon_from_path(app, "icon.png");
    }

    Ok(())
}

fn apply_tray_icon_data_url(app: &tauri::AppHandle, data_url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let Some(tray) = app.tray_by_id(TRAY_ICON_ID) else {
            return Ok(());
        };
        let encoded = data_url
            .split_once(',')
            .map(|(_, value)| value)
            .ok_or_else(|| "invalid tray icon data url".to_string())?;
        let bytes = BASE64_STANDARD.decode(encoded).map_err(|e| e.to_string())?;
        let image = Image::from_bytes(&bytes).map_err(|e| e.to_string())?;
        return tray.set_icon(Some(image)).map_err(|e| e.to_string());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, data_url);
        Ok(())
    }
}

fn show_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Err("main window is unavailable".to_string());
    };
    if window.is_minimized().map_err(|e| e.to_string())? {
        let _ = window.unminimize();
    }
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

fn trigger_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Err("main window is unavailable".to_string());
    };

    if window.is_visible().map_err(|e| e.to_string())?
        && !window.is_minimized().map_err(|e| e.to_string())?
    {
        let _ = window.hide();
        return Ok(());
    }

    show_main_window(app)
}

fn hide_traymenu_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(TRAYMENU_WINDOW_LABEL) {
        let _ = window.hide();
    }
}

fn tray_mode_label(mode: &str) -> &'static str {
    match mode {
        "global" => "全局",
        "direct" => "直连",
        _ => "规则",
    }
}

fn build_native_tray_menu(app: &tauri::AppHandle) -> Result<Menu<tauri::Wry>, String> {
    let app_config = read_app_config_store(app)?;
    let controlled_config = read_controlled_config_store(app)?;

    let show_floating = app_config
        .get("showFloatingWindow")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let sys_proxy_enabled = app_config
        .get("sysProxy")
        .and_then(Value::as_object)
        .and_then(|sysproxy| sysproxy.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let tun_enabled = controlled_config
        .get("tun")
        .and_then(Value::as_object)
        .and_then(|tun| tun.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let mode = controlled_config
        .get("mode")
        .and_then(Value::as_str)
        .unwrap_or("rule");

    let show_window = MenuItem::with_id(
        app,
        TRAY_MENU_SHOW_WINDOW_ID,
        "显示窗口",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let toggle_floating = MenuItem::with_id(
        app,
        TRAY_MENU_TOGGLE_FLOATING_ID,
        if show_floating {
            "关闭悬浮窗"
        } else {
            "显示悬浮窗"
        },
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let sys_proxy = CheckMenuItem::with_id(
        app,
        TRAY_MENU_TOGGLE_SYS_PROXY_ID,
        "系统代理",
        true,
        sys_proxy_enabled,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let tun = CheckMenuItem::with_id(
        app,
        TRAY_MENU_TOGGLE_TUN_ID,
        "虚拟网卡",
        true,
        tun_enabled,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let rule_mode = CheckMenuItem::with_id(
        app,
        TRAY_MENU_MODE_RULE_ID,
        "规则模式",
        true,
        mode == "rule",
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let global_mode = CheckMenuItem::with_id(
        app,
        TRAY_MENU_MODE_GLOBAL_ID,
        "全局模式",
        true,
        mode == "global",
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let direct_mode = CheckMenuItem::with_id(
        app,
        TRAY_MENU_MODE_DIRECT_ID,
        "直连模式",
        true,
        mode == "direct",
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let mode_menu = Submenu::with_items(
        app,
        format!("出站模式 ({})", tray_mode_label(mode)),
        true,
        &[&rule_mode, &global_mode, &direct_mode],
    )
    .map_err(|e| e.to_string())?;
    let quit = MenuItem::with_id(app, TRAY_MENU_QUIT_ID, "退出应用", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let separator_1 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let separator_2 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let separator_3 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;

    Menu::with_items(
        app,
        &[
            &show_window,
            &toggle_floating,
            &separator_1,
            &sys_proxy,
            &tun,
            &separator_2,
            &mode_menu,
            &separator_3,
            &quit,
        ],
    )
    .map_err(|e| e.to_string())
}

fn refresh_native_tray_menu(app: &tauri::AppHandle) -> Result<(), String> {
    if cfg!(target_os = "macos") {
        return Ok(());
    }

    let Some(tray) = app.tray_by_id(TRAY_ICON_ID) else {
        return Ok(());
    };

    let menu = build_native_tray_menu(app)?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())
}

fn handle_tray_toggle_floating(app: &tauri::AppHandle) -> Result<(), String> {
    let current = read_app_config_store(app)?
        .get("showFloatingWindow")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    patch_app_config_store(app, &json!({ "showFloatingWindow": !current }))?;
    sync_shell_surfaces(app)?;
    emit_ipc_event(app, "appConfigUpdated", Value::Null);
    Ok(())
}

fn handle_tray_toggle_sys_proxy(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    let config = read_app_config_store(app)?;
    let current = config
        .get("sysProxy")
        .and_then(Value::as_object)
        .and_then(|sysproxy| sysproxy.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let only_active_device = config
        .get("onlyActiveDevice")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let next = !current;
    trigger_sys_proxy(app, state, next, only_active_device)?;
    patch_app_config_store(app, &json!({ "sysProxy": { "enable": next } }))?;
    emit_ipc_event(app, "appConfigUpdated", Value::Null);
    Ok(())
}

fn handle_tray_toggle_tun(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    let controlled = read_controlled_config_store(app)?;
    let current = controlled
        .get("tun")
        .and_then(Value::as_object)
        .and_then(|tun| tun.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let patch = if current {
        json!({ "tun": { "enable": false } })
    } else {
        json!({ "tun": { "enable": true }, "dns": { "enable": true } })
    };
    let next_controlled = patch_controlled_config_store(app, &patch)?;
    let value = restart_core_process(app, state, Some(&next_controlled))?;
    emit_ipc_event(app, "core-started", value);
    emit_ipc_event(app, "controledMihomoConfigUpdated", Value::Null);
    emit_ipc_event(app, "groupsUpdated", Value::Null);
    emit_ipc_event(app, "rulesUpdated", Value::Null);
    Ok(())
}

fn handle_tray_change_mode(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    next_mode: &str,
) -> Result<(), String> {
    patch_controlled_config_store(app, &json!({ "mode": next_mode }))?;

    if let Err(error) = core_request(
        state,
        reqwest::Method::PATCH,
        "/configs",
        None,
        Some(json!({ "mode": next_mode })),
    ) {
        if error != "Mihomo controller is not available" {
            return Err(error);
        }
    }

    emit_ipc_event(app, "controledMihomoConfigUpdated", Value::Null);
    emit_ipc_event(app, "groupsUpdated", Value::Null);
    emit_ipc_event(app, "rulesUpdated", Value::Null);
    Ok(())
}

fn handle_native_tray_menu_event(app: &tauri::AppHandle, event: &MenuEvent) -> Result<(), String> {
    let state = app.state::<CoreState>();

    match event.id() {
        id if id == TRAY_MENU_SHOW_WINDOW_ID => show_main_window(app),
        id if id == TRAY_MENU_TOGGLE_FLOATING_ID => handle_tray_toggle_floating(app),
        id if id == TRAY_MENU_TOGGLE_SYS_PROXY_ID => handle_tray_toggle_sys_proxy(app, &state),
        id if id == TRAY_MENU_TOGGLE_TUN_ID => handle_tray_toggle_tun(app, &state),
        id if id == TRAY_MENU_MODE_RULE_ID => handle_tray_change_mode(app, &state, "rule"),
        id if id == TRAY_MENU_MODE_GLOBAL_ID => handle_tray_change_mode(app, &state, "global"),
        id if id == TRAY_MENU_MODE_DIRECT_ID => handle_tray_change_mode(app, &state, "direct"),
        id if id == TRAY_MENU_QUIT_ID => {
            shutdown_runtime(app, &state);
            app.exit(0);
            return Ok(());
        }
        _ => Ok(()),
    }?;

    update_tray_icon_for_state(app)?;
    refresh_native_tray_menu(app)?;
    Ok(())
}

fn run_shortcut_action(
    app: &tauri::AppHandle,
    action: &str,
    event: &ShortcutEvent,
) -> Result<(), String> {
    if event.state != ShortcutState::Pressed {
        return Ok(());
    }

    let state = app.state::<CoreState>();

    match action {
        "showWindowShortcut" => trigger_main_window(app),
        "showFloatingWindowShortcut" => handle_tray_toggle_floating(app),
        "triggerSysProxyShortcut" => handle_tray_toggle_sys_proxy(app, &state),
        "triggerTunShortcut" => handle_tray_toggle_tun(app, &state),
        "ruleModeShortcut" => handle_tray_change_mode(app, &state, "rule"),
        "globalModeShortcut" => handle_tray_change_mode(app, &state, "global"),
        "directModeShortcut" => handle_tray_change_mode(app, &state, "direct"),
        "quitWithoutCoreShortcut" => {
            app.exit(0);
            Ok(())
        }
        "restartAppShortcut" => relaunch_current_app(app, &state),
        _ => Err(format!("Unknown shortcut action: {action}")),
    }
}

fn register_shortcut_binding(
    app: &tauri::AppHandle,
    shortcut_text: &str,
    action: &str,
) -> Result<(), String> {
    if shortcut_text.trim().is_empty() {
        return Ok(());
    }

    let action_name = action.to_string();
    app.global_shortcut()
        .on_shortcut(
            shortcut_text,
            move |app_handle, _shortcut: &Shortcut, event| {
                if let Err(error) = run_shortcut_action(app_handle, &action_name, &event) {
                    eprintln!("shortcut action failed: {error}");
                }
            },
        )
        .map_err(|e| e.to_string())
}

fn read_shortcut_binding(config: &Value, action: &str) -> String {
    config
        .get(action)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn init_global_shortcuts(app: &tauri::AppHandle) -> Result<(), String> {
    let config = read_app_config_store(app)?;

    app.global_shortcut()
        .unregister_all()
        .map_err(|e| e.to_string())?;

    for action in SHORTCUT_ACTION_KEYS {
        let shortcut_text = read_shortcut_binding(&config, action);
        if shortcut_text.is_empty() {
            continue;
        }

        register_shortcut_binding(app, &shortcut_text, action)?;
    }

    Ok(())
}

fn register_global_shortcut(
    app: &tauri::AppHandle,
    old_shortcut: &str,
    new_shortcut: &str,
    action: &str,
) -> Result<bool, String> {
    let shortcut_manager = app.global_shortcut();

    if !old_shortcut.trim().is_empty() {
        let _ = shortcut_manager.unregister(old_shortcut);
    }

    if new_shortcut.trim().is_empty() {
        return Ok(true);
    }

    match register_shortcut_binding(app, new_shortcut, action) {
        Ok(()) => Ok(true),
        Err(_) => Ok(false),
    }
}

fn ensure_floating_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(FLOATING_WINDOW_LABEL) {
        return Ok(window);
    }

    let mut builder = WebviewWindowBuilder::new(
        app,
        FLOATING_WINDOW_LABEL,
        WebviewUrl::App("floating.html".into()),
    )
    .title("RouteX Floating")
    .inner_size(120.0, 42.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .transparent(true)
    .shadow(true)
    .visible(false)
    .focused(true);

    if let Some(state) = read_floating_window_state(app)? {
        builder = builder.position(state.x as f64, state.y as f64);
    }

    let window = builder.build().map_err(|e| e.to_string())?;

    window.on_window_event({
        let handle = app.clone();
        move |event| {
            if let WindowEvent::Moved(position) = event {
                let _ = write_floating_window_state(
                    &handle,
                    &FloatingWindowState {
                        x: position.x,
                        y: position.y,
                    },
                );
            }
        }
    });

    let _ = window.set_always_on_top(true);
    let _ = window.set_skip_taskbar(true);
    Ok(window)
}

fn position_traymenu_window(
    window: &tauri::WebviewWindow,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .or_else(|| window.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let size = monitor.size();
        let safe_x = x.clamp(0.0, (size.width as f64 - width).max(0.0));
        let safe_y = y.clamp(0.0, (size.height as f64 - height).max(0.0));
        window
            .set_position(Position::Physical(PhysicalPosition::new(
                safe_x as i32,
                safe_y as i32,
            )))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn ensure_traymenu_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(TRAYMENU_WINDOW_LABEL) {
        return Ok(window);
    }

    let window = WebviewWindowBuilder::new(
        app,
        TRAYMENU_WINDOW_LABEL,
        WebviewUrl::App("traymenu.html".into()),
    )
    .title("RouteX Tray Menu")
    .inner_size(380.0, 520.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .focused(true)
    .build()
    .map_err(|e| e.to_string())?;

    window.on_window_event({
        let handle = app.clone();
        move |event| {
            if let WindowEvent::Focused(false) = event {
                hide_traymenu_window(&handle);
            }
        }
    });

    Ok(window)
}

fn show_traymenu_window(
    app: &tauri::AppHandle,
    position: Option<(f64, f64)>,
) -> Result<(), String> {
    let window = ensure_traymenu_window(app)?;
    let width = 380.0;
    let height = 520.0;
    if let Some((x, y)) = position {
        let _ = position_traymenu_window(&window, x, y - height, width, height);
    }
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

fn toggle_traymenu_window(
    app: &tauri::AppHandle,
    position: Option<(f64, f64)>,
) -> Result<(), String> {
    let window = ensure_traymenu_window(app)?;
    if window.is_visible().map_err(|e| e.to_string())? {
        let _ = window.hide();
        return Ok(());
    }
    show_traymenu_window(app, position)
}

fn sync_shell_surfaces(app: &tauri::AppHandle) -> Result<(), String> {
    let config = read_app_config_store(app)?;
    let disable_tray = config
        .get("disableTray")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let show_floating = config
        .get("showFloatingWindow")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    if disable_tray {
        hide_traymenu_window(app);
        if let Some(tray) = app.remove_tray_by_id(TRAY_ICON_ID) {
            let _ = tray.set_visible(false);
        }
    } else {
        ensure_tray_icon(app)?;
        update_tray_icon_for_state(app)?;
    }

    if show_floating {
        let window = ensure_floating_window(app)?;
        let _ = window.show();
    } else if let Some(window) = app.get_webview_window(FLOATING_WINDOW_LABEL) {
        let _ = window.close();
    }

    Ok(())
}

fn ensure_tray_icon(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(TRAY_ICON_ID) {
        let _ = tray.set_visible(true);
        let _ = refresh_native_tray_menu(app);
        update_tray_icon_for_state(app)?;
        return Ok(());
    }

    let mut builder = TrayIconBuilder::with_id(TRAY_ICON_ID)
        .tooltip("RouteX")
        .show_menu_on_left_click(false);

    #[cfg(not(target_os = "macos"))]
    {
        let menu = build_native_tray_menu(app)?;
        builder = builder.menu(&menu).on_menu_event(|app, event| {
            if let Err(error) = handle_native_tray_menu_event(app, &event) {
                eprintln!("tray menu event failed: {error}");
            }
        });
    }

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder
        .on_tray_icon_event({
            let handle = app.clone();
            move |_tray, event| match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    position,
                    ..
                } => {
                    if cfg!(target_os = "macos") {
                        let _ = toggle_traymenu_window(&handle, Some((position.x, position.y)));
                    } else {
                        let _ = trigger_main_window(&handle);
                    }
                }
                TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                } => {
                    if !cfg!(target_os = "macos") {
                        let _ = show_main_window(&handle);
                    }
                }
                TrayIconEvent::Click {
                    button: MouseButton::Right,
                    button_state: MouseButtonState::Up,
                    ..
                } => {
                    if cfg!(target_os = "macos") {
                        let _ = show_main_window(&handle);
                    }
                }
                _ => {}
            }
        })
        .build(app)
        .map_err(|e| e.to_string())?;

    update_tray_icon_for_state(app)?;
    Ok(())
}

fn webdav_request(
    client: &Client,
    method: reqwest::Method,
    url: &str,
    config: &WebdavConfig,
) -> reqwest::blocking::RequestBuilder {
    let request = client.request(method, url);
    if config.username.trim().is_empty() {
        request
    } else {
        request.basic_auth(&config.username, Some(&config.password))
    }
}

fn ensure_webdav_directory(config: &WebdavConfig) -> Result<(), String> {
    ensure_webdav_config(config)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let method = reqwest::Method::from_bytes(b"MKCOL").map_err(|e| e.to_string())?;
    let mut current = config.url.trim_end_matches('/').to_string();
    for segment in config
        .dir
        .split('/')
        .filter(|segment| !segment.trim().is_empty())
    {
        current.push('/');
        current.push_str(&urlencoding::encode(segment));

        let response = webdav_request(&client, method.clone(), &current, config)
            .send()
            .map_err(|e| e.to_string())?;
        let status = response.status();
        if !status.is_success()
            && status != reqwest::StatusCode::METHOD_NOT_ALLOWED
            && status != reqwest::StatusCode::CONFLICT
        {
            return Err(format!("创建 WebDAV 目录失败: {}", status));
        }
    }

    Ok(())
}

fn build_webdav_backup_archive(app: &tauri::AppHandle) -> Result<Vec<u8>, String> {
    let root = app_storage_root(app)?;
    if !root.exists() {
        fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    }

    let cursor = Cursor::new(Vec::<u8>::new());
    let mut writer = ZipWriter::new(cursor);
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

    for entry in WalkDir::new(&root) {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let relative = path.strip_prefix(&root).map_err(|e| e.to_string())?;

        if relative.as_os_str().is_empty() {
            continue;
        }

        let name = relative.to_string_lossy().replace('\\', "/");
        if path.is_dir() {
            writer
                .add_directory(format!("{name}/"), options)
                .map_err(|e| e.to_string())?;
        } else {
            writer
                .start_file(name, options)
                .map_err(|e| e.to_string())?;
            let bytes = fs::read(path).map_err(|e| e.to_string())?;
            writer.write_all(&bytes).map_err(|e| e.to_string())?;
        }
    }

    writer
        .finish()
        .map(|cursor| cursor.into_inner())
        .map_err(|e| e.to_string())
}

fn restore_webdav_backup_archive(app: &tauri::AppHandle, bytes: &[u8]) -> Result<(), String> {
    let root = app_storage_root(app)?;
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;

    let cursor = Cursor::new(bytes.to_vec());
    let mut archive = ZipArchive::new(cursor).map_err(|e| e.to_string())?;

    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|e| e.to_string())?;
        let Some(relative_path) = file.enclosed_name().map(Path::to_path_buf) else {
            continue;
        };

        let output_path = root.join(relative_path);
        if file.name().ends_with('/') {
            fs::create_dir_all(&output_path).map_err(|e| e.to_string())?;
            continue;
        }

        ensure_parent(&output_path)?;
        let mut output = fs::File::create(&output_path).map_err(|e| e.to_string())?;
        std::io::copy(&mut file, &mut output).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn list_webdav_backup_names(config: &WebdavConfig) -> Result<Vec<String>, String> {
    ensure_webdav_config(config)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let method = reqwest::Method::from_bytes(b"PROPFIND").map_err(|e| e.to_string())?;
    let response = webdav_request(&client, method, &build_webdav_url(config, None), config)
        .header("Depth", "1")
        .body(String::new())
        .send()
        .map_err(|e| e.to_string())?;
    let status = response.status();
    if !status.is_success() && status.as_u16() != 207 {
        return Err(format!("读取 WebDAV 目录失败: {}", status));
    }

    let body = response.text().map_err(|e| e.to_string())?;
    let mut reader = Reader::from_str(&body);
    reader.config_mut().trim_text(true);

    let mut names = Vec::new();
    loop {
        match reader.read_event() {
            Ok(Event::Start(event)) if event.local_name().as_ref() == b"href" => {
                let text = reader.read_text(event.name()).map_err(|e| e.to_string())?;
                let basename = text
                    .split('/')
                    .filter(|segment| !segment.is_empty())
                    .last()
                    .unwrap_or_default();
                let decoded = urlencoding::decode(basename)
                    .map(|value| value.into_owned())
                    .unwrap_or_else(|_| basename.to_string());
                if decoded.ends_with(".zip") && !names.contains(&decoded) {
                    names.push(decoded);
                }
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => return Err(error.to_string()),
        }
    }

    names.sort();
    names.reverse();
    Ok(names)
}

fn webdav_backup(app: &tauri::AppHandle) -> Result<bool, String> {
    let config = read_webdav_config(app)?;
    ensure_webdav_directory(&config)?;

    let archive = build_webdav_backup_archive(app)?;
    let file_name = format!("{}_{}.zip", platform_name(), current_timestamp_ms());
    let client = Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let response = webdav_request(
        &client,
        reqwest::Method::PUT,
        &build_webdav_url(&config, Some(&file_name)),
        &config,
    )
    .body(archive)
    .send()
    .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("上传 WebDAV 备份失败: {}", response.status()));
    }

    Ok(true)
}

fn webdav_restore(app: &tauri::AppHandle, filename: &str) -> Result<(), String> {
    let config = read_webdav_config(app)?;
    ensure_webdav_config(&config)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let mut response = webdav_request(
        &client,
        reqwest::Method::GET,
        &build_webdav_url(&config, Some(filename)),
        &config,
    )
    .send()
    .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("下载 WebDAV 备份失败: {}", response.status()));
    }

    let mut bytes = Vec::new();
    response
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    restore_webdav_backup_archive(app, &bytes)
}

fn webdav_delete(app: &tauri::AppHandle, filename: &str) -> Result<(), String> {
    let config = read_webdav_config(app)?;
    ensure_webdav_config(&config)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = webdav_request(
        &client,
        reqwest::Method::DELETE,
        &build_webdav_url(&config, Some(filename)),
        &config,
    )
    .send()
    .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("删除 WebDAV 备份失败: {}", response.status()));
    }

    Ok(())
}

fn http_client_with_timeout(timeout_ms: u64) -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| e.to_string())
}

fn http_get_response(
    url: &str,
    timeout_ms: u64,
) -> Result<(reqwest::StatusCode, String, Value), String> {
    let client = http_client_with_timeout(timeout_ms)?;
    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0 RouteX-Tauri/1.0")
        .header(reqwest::header::ACCEPT, "*/*")
        .send()
        .map_err(|e| e.to_string())?;

    let status = response.status();
    let mut headers = serde_json::Map::new();
    for (key, value) in response.headers() {
        headers.insert(
            key.as_str().to_string(),
            Value::String(value.to_str().unwrap_or_default().to_string()),
        );
    }

    let mut limited = response.take(150_000);
    let mut data = String::new();
    limited
        .read_to_string(&mut data)
        .map_err(|e| e.to_string())?;

    Ok((status, data, Value::Object(headers)))
}

fn http_get_json(url: &str, timeout_ms: u64) -> Result<Value, String> {
    let (status, body, _) = http_get_response(url, timeout_ms)?;
    if !status.is_success() {
        return Err(format!("HTTP 请求失败: {}", status));
    }

    serde_json::from_str::<Value>(&body).map_err(|e| e.to_string())
}

fn http_post_json(url: &str, body: &Value, timeout_ms: u64) -> Result<Value, String> {
    let client = http_client_with_timeout(timeout_ms)?;
    let response = client
        .post(url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0 RouteX-Tauri/1.0")
        .json(body)
        .send()
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("HTTP 请求失败: {}", response.status()));
    }

    response.json::<Value>().map_err(|e| e.to_string())
}

fn resolve_to_ip(query: &str) -> String {
    if query.parse::<std::net::IpAddr>().is_ok() {
        return query.to_string();
    }

    format!("{query}:80")
        .to_socket_addrs()
        .ok()
        .and_then(|mut addrs| addrs.next().map(|addr| addr.ip().to_string()))
        .unwrap_or_else(|| query.to_string())
}

fn fetch_ip_info_current() -> Result<Value, String> {
    http_get_json(
        "http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query",
        10_000,
    )
}

fn fetch_ip_info_query(query: &str) -> Result<Value, String> {
    let ip = resolve_to_ip(query);
    let mut result = http_get_json(
        &format!("http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query"),
        10_000,
    )?;
    if let Some(map) = result.as_object_mut() {
        map.insert("query".to_string(), Value::String(query.to_string()));
    }
    Ok(result)
}

fn fetch_batch_ip_info(queries: &[IpInfoQueryInput]) -> Result<Value, String> {
    let request_body = Value::Array(
        queries
            .iter()
            .map(|item| {
                json!({
                    "query": resolve_to_ip(&item.query),
                    "lang": item.lang.clone().unwrap_or_else(|| "zh-CN".to_string())
                })
            })
            .collect(),
    );

    let mut result = http_post_json("http://ip-api.com/batch", &request_body, 15_000)?;
    if let Some(items) = result.as_array_mut() {
        for (index, item) in items.iter_mut().enumerate() {
            if let Some(map) = item.as_object_mut() {
                if let Some(original) = queries.get(index) {
                    map.insert("query".to_string(), Value::String(original.query.clone()));
                }
            }
        }
    }
    Ok(result)
}

fn http_get_value(url: &str, timeout_ms: u64) -> Result<Value, String> {
    let (status, data, headers) = http_get_response(url, timeout_ms)?;
    Ok(json!({
        "status": status.as_u16(),
        "data": data,
        "headers": headers,
    }))
}

fn test_connectivity_value(url: &str, timeout_ms: u64) -> Value {
    let start = std::time::Instant::now();
    match http_get_response(url, timeout_ms) {
        Ok((status, _, _)) => json!({
            "success": status.as_u16() < 400,
            "latency": start.elapsed().as_millis() as i64,
            "status": status.as_u16(),
        }),
        Err(error) => json!({
            "success": false,
            "latency": start.elapsed().as_millis() as i64,
            "error": error,
        }),
    }
}

fn build_group_children(
    proxies_map: &serde_json::Map<String, Value>,
    all_names: &[Value],
    icon_map: &serde_json::Map<String, Value>,
) -> Vec<Value> {
    all_names
        .iter()
        .filter_map(Value::as_str)
        .filter_map(|name| {
            proxies_map.get(name).map(|proxy| {
                let mut cloned = proxy.clone();
                if let Some(icon) = icon_map.get(name) {
                    if let Some(object) = cloned.as_object_mut() {
                        object.insert("icon".to_string(), icon.clone());
                    }
                }
                cloned
            })
        })
        .collect()
}

fn build_mihomo_groups_value(proxies: &Value, runtime: &Value) -> Value {
    let mode = runtime
        .get("mode")
        .and_then(Value::as_str)
        .unwrap_or("rule");
    if mode == "direct" {
        return Value::Array(vec![]);
    }

    let proxy_groups = runtime
        .get("proxy-groups")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let proxies_map = proxies
        .get("proxies")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let mut icon_map = serde_json::Map::new();
    for group in &proxy_groups {
        if let Some(name) = group.get("name").and_then(Value::as_str) {
            if let Some(icon) = group.get("icon") {
                icon_map.insert(name.to_string(), icon.clone());
            }
        }
    }

    let mut groups = Vec::new();
    for group in &proxy_groups {
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
                Value::Array(build_group_children(&proxies_map, all_names, &icon_map)),
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
                            Value::Array(build_group_children(&proxies_map, all_names, &icon_map)),
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

fn extract_domain(input: &str) -> String {
    if let Ok(url) = reqwest::Url::parse(input) {
        if let Some(host) = url.host_str() {
            return host.to_string();
        }
    }

    input
        .trim()
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .split('/')
        .next()
        .unwrap_or_default()
        .split(':')
        .next()
        .unwrap_or_default()
        .to_string()
}

fn test_rule_match_value(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    domain: &str,
) -> Result<Value, String> {
    let runtime = current_runtime_value(app, state)?;
    let mixed_port = runtime
        .get("mixed-port")
        .and_then(Value::as_i64)
        .unwrap_or(7890);
    if mixed_port <= 0 {
        return Ok(Value::Null);
    }

    let target_url = if domain.starts_with("http://") || domain.starts_with("https://") {
        domain.to_string()
    } else {
        format!("http://{domain}/")
    };

    let client = Client::builder()
        .timeout(Duration::from_secs(3))
        .proxy(
            reqwest::Proxy::all(format!("http://127.0.0.1:{mixed_port}"))
                .map_err(|e| e.to_string())?,
        )
        .build()
        .map_err(|e| e.to_string())?;
    let _ = client.get(target_url).send();

    std::thread::sleep(Duration::from_millis(500));

    let target_domain = extract_domain(domain).to_lowercase();
    let connections = core_request(state, reqwest::Method::GET, "/connections", None, None)?;
    let items = connections
        .get("connections")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    for item in items {
        let host = item
            .get("metadata")
            .and_then(Value::as_object)
            .and_then(|meta| meta.get("host"))
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_lowercase();
        if host != target_domain && !host.ends_with(&format!(".{target_domain}")) {
            continue;
        }

        if let Some(id) = item.get("id").and_then(Value::as_str) {
            let _ = core_request(
                state,
                reqwest::Method::DELETE,
                &format!("/connections/{}", urlencoding::encode(id)),
                None,
                None,
            );
        }

        let proxy = item
            .get("chains")
            .and_then(Value::as_array)
            .and_then(|chains| chains.first())
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        return Ok(json!({
            "rule": item.get("rule").and_then(Value::as_str).unwrap_or_default(),
            "rulePayload": item.get("rulePayload").and_then(Value::as_str).unwrap_or_default(),
            "proxy": proxy,
        }));
    }

    Ok(Value::Null)
}

fn check_streaming_unlock(service: &str) -> Result<Value, String> {
    let timeout = 15_000;
    let result = match service {
        "netflix" => {
            let (status, body, _) =
                http_get_response("https://www.netflix.com/title/80018499", timeout)?;
            if status == reqwest::StatusCode::OK {
                let region = body
                    .split("\"countryCode\":\"")
                    .nth(1)
                    .and_then(|part| part.get(0..2))
                    .unwrap_or("Unknown");
                json!({ "status": "unlocked", "region": region })
            } else if status == reqwest::StatusCode::NOT_FOUND {
                let (second_status, _, _) =
                    http_get_response("https://www.netflix.com/title/70143836", timeout)?;
                if second_status == reqwest::StatusCode::OK {
                    json!({ "status": "unlocked", "region": "仅自制剧" })
                } else {
                    json!({ "status": "locked" })
                }
            } else {
                json!({ "status": "locked" })
            }
        }
        "youtube" => {
            let (status, body, _) = http_get_response("https://www.youtube.com/premium", timeout)?;
            if status == reqwest::StatusCode::OK {
                let region = body
                    .split("\"GL\":\"")
                    .nth(1)
                    .and_then(|part| part.get(0..2))
                    .unwrap_or("Unknown");
                json!({ "status": "unlocked", "region": region })
            } else {
                json!({ "status": "locked" })
            }
        }
        "spotify" => {
            let (status, _, _) = http_get_response("https://open.spotify.com/", timeout)?;
            if status == reqwest::StatusCode::OK {
                json!({ "status": "unlocked", "region": "Available" })
            } else {
                json!({ "status": "locked" })
            }
        }
        "chatgpt" => {
            let (status, body, _) = http_get_response("https://ios.chat.openai.com/", timeout)?;
            if status.is_success() || status.is_redirection() {
                json!({ "status": "unlocked", "region": "Available" })
            } else if status == reqwest::StatusCode::FORBIDDEN
                && (body.contains("blocked")
                    || body.contains("unavailable")
                    || body.contains("VPN"))
            {
                json!({ "status": "locked" })
            } else {
                let (model_status, _, _) =
                    http_get_response("https://api.openai.com/v1/models", timeout)?;
                if model_status == reqwest::StatusCode::FORBIDDEN {
                    json!({ "status": "locked" })
                } else {
                    json!({ "status": "unlocked", "region": "Available" })
                }
            }
        }
        "gemini" => {
            let (status, body, _) = http_get_response("https://gemini.google.com/", timeout)?;
            if status == reqwest::StatusCode::FORBIDDEN {
                json!({ "status": "locked" })
            } else if body.contains("not available")
                || body.contains("unavailable")
                || body.contains("not supported")
            {
                json!({ "status": "locked" })
            } else {
                json!({ "status": "unlocked", "region": "Available" })
            }
        }
        "tiktok" => {
            let (status, body, _) = http_get_response("https://www.tiktok.com/", timeout)?;
            if status == reqwest::StatusCode::OK
                && !(body.contains("not available") || body.contains("unavailable"))
            {
                json!({ "status": "unlocked", "region": "Available" })
            } else {
                json!({ "status": "locked" })
            }
        }
        _ => json!({ "status": "error", "error": format!("未知服务: {service}") }),
    };

    Ok(result)
}

fn resolve_runtime_file_path(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw_path);
    if path.is_absolute() {
        return Ok(path);
    }

    let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    if let Some(work_dir) = runtime.work_dir.as_ref() {
        return Ok(work_dir.join(raw_path));
    }
    drop(runtime);

    Ok(storage_dir(app, RUNTIME_DIR_NAME)?.join(raw_path))
}

fn read_runtime_text(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
) -> Result<String, String> {
    let path = resolve_runtime_file_path(app, state, raw_path)?;
    if !path.exists() {
        return Ok(String::new());
    }

    fs::read_to_string(path).map_err(|e| e.to_string())
}

fn write_runtime_text(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
    content: &str,
) -> Result<(), String> {
    let path = resolve_runtime_file_path(app, state, raw_path)?;
    ensure_parent(&path)?;
    fs::write(path, content).map_err(|e| e.to_string())
}

const DEFAULT_SUBSCRIPTION_USER_AGENT: &str = "clash.meta/alpha-e89af72";

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
        "Remote File"
    } else {
        "Local File"
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
        substore: item
            .substore
            .or_else(|| existing.and_then(|value| value.substore)),
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
            next_item
                .url
                .as_deref()
                .map(|url| guess_name_from_url(url, "Remote File"))
                .unwrap_or_else(|| "Remote File".to_string())
        } else {
            "Local File".to_string()
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

fn run_startup_alignment(app: &tauri::AppHandle) -> Result<(), String> {
    let config = read_app_config_store(app)?;
    let silent_start = config
        .get("silentStart")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let sysproxy_enabled = config
        .get("sysProxy")
        .and_then(Value::as_object)
        .and_then(|value| value.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let only_active_device = config
        .get("onlyActiveDevice")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let network_detection = config
        .get("networkDetection")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    sync_shell_surfaces(app)?;

    if let Some(window) = app.get_webview_window("main") {
        if silent_start {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }

    let state = app.state::<CoreState>();

    if sysproxy_enabled {
        let _ = trigger_sys_proxy(app, &state, true, only_active_device);
    }

    if network_detection {
        let _ = start_network_detection(app, &state);
    }

    if restart_core_and_emit(app, &state).is_ok() {
        let _ = get_provider_stats_value(app);
    }

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

fn update_group_reference_array(
    group_object: &mut serde_json::Map<String, Value>,
    key: &str,
    proxy_name_map: &HashMap<String, String>,
    group_name_map: &HashMap<String, String>,
    provider_name_map: &HashMap<String, String>,
) {
    let Some(items) = group_object.get_mut(key).and_then(Value::as_array_mut) else {
        return;
    };

    for item in items {
        let Some(name) = item.as_str() else {
            continue;
        };

        let mapped = provider_name_map
            .get(name)
            .cloned()
            .unwrap_or_else(|| map_named_reference(name, proxy_name_map, group_name_map));
        *item = Value::String(mapped);
    }
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
    let mut target_groups = target_object
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
    let mut group_names = target_groups
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

    let mut provider_name_map = HashMap::new();
    for (provider_name, provider_value) in source_proxy_providers {
        let next_provider_name =
            create_unique_name(&provider_name, &mut provider_names, profile_name);
        provider_name_map.insert(provider_name.clone(), next_provider_name.clone());
        let mut cloned_provider = provider_value.clone();
        rewrite_provider_path(&mut cloned_provider, profile_id);
        target_proxy_providers.insert(next_provider_name, cloned_provider);
    }

    let mut group_name_map = HashMap::new();
    for group in &source_groups {
        if let Some(group_name) = value_name(group) {
            let next_group_name = create_unique_name(&group_name, &mut group_names, profile_name);
            group_name_map.insert(group_name, next_group_name);
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

    for group in source_groups {
        let mut cloned_group = group;
        let Some(group_object) = cloned_group.as_object_mut() else {
            continue;
        };

        if let Some(group_name) = group_object.get("name").and_then(Value::as_str) {
            if let Some(mapped_name) = group_name_map.get(group_name) {
                group_object.insert("name".to_string(), Value::String(mapped_name.clone()));
            }
        }

        update_group_reference_array(
            group_object,
            "proxies",
            &proxy_name_map,
            &group_name_map,
            &provider_name_map,
        );
        update_group_reference_array(
            group_object,
            "use",
            &proxy_name_map,
            &group_name_map,
            &provider_name_map,
        );

        target_groups.push(cloned_group);
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

fn apply_yaml_overrides_to_profile(
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
        if item.ext == "js" {
            return Err("当前 Tauri 版本暂不支持 JS 覆写".to_string());
        }
        if item.ext != "yaml" {
            continue;
        }

        let text = read_override_text(app, &item.id, &item.ext)?;
        if text.trim().is_empty() {
            continue;
        }

        let patch = parse_profile_yaml_value(&text)?;
        merge_config_value(profile, &patch, true);
    }

    Ok(())
}

fn current_profile_runtime_config(app: &tauri::AppHandle) -> Result<Value, String> {
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
            apply_yaml_overrides_to_profile(app, Some(profile_id), &mut overridden_profile)?;
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
        apply_yaml_overrides_to_profile(app, current.as_deref(), &mut profile)?;
        profile
    } else {
        json!({})
    };

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
    let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    if let Some(config_path) = runtime.config_path.as_ref() {
        if config_path.exists() {
            let text = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
            let yaml = serde_yaml::from_str::<Value>(&text).map_err(|e| e.to_string())?;
            return Ok(yaml);
        }
    }
    drop(runtime);

    current_profile_runtime_config(app)
}

fn current_controller_address(state: &State<'_, CoreState>) -> Result<Option<String>, String> {
    let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    Ok(runtime.controller_url.as_ref().map(|url| {
        url.strip_prefix("http://")
            .or_else(|| url.strip_prefix("https://"))
            .unwrap_or(url)
            .to_string()
    }))
}

fn current_runtime_value_for_renderer(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<Value, String> {
    let value = current_runtime_value(app, state)?;
    let Some(controller_address) = current_controller_address(state)? else {
        return Ok(value);
    };

    if controller_address.trim().is_empty() {
        return Ok(value);
    }

    Ok(normalize_runtime_config(Some(&value), &controller_address))
}

fn current_controller_url(state: &State<'_, CoreState>) -> Result<Option<String>, String> {
    let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    Ok(runtime.controller_url.clone())
}

fn json_u64(value: Option<&Value>) -> u64 {
    value
        .and_then(Value::as_u64)
        .or_else(|| value.and_then(Value::as_i64).map(|v| v.max(0) as u64))
        .unwrap_or(0)
}

fn close_connections_by_group(state: &State<'_, CoreState>, name: &str) -> Result<(), String> {
    let connections = core_request(state, reqwest::Method::GET, "/connections", None, None)?;
    let items = connections
        .get("connections")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    for item in items {
        let matches_group = item
            .get("chains")
            .and_then(Value::as_array)
            .map(|chains| chains.iter().any(|chain| chain.as_str() == Some(name)))
            .unwrap_or(false);
        if !matches_group {
            continue;
        }

        if let Some(id) = item.get("id").and_then(Value::as_str) {
            let _ = core_request(
                state,
                reqwest::Method::DELETE,
                &format!("/connections/{}", urlencoding::encode(id)),
                None,
                None,
            );
        }
    }

    Ok(())
}

fn get_process_traffic_ranking_value(
    state: &State<'_, CoreState>,
    sort_by: &str,
) -> Result<Value, String> {
    let connections = core_request(state, reqwest::Method::GET, "/connections", None, None)?;
    let items = connections
        .get("connections")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut process_stats = HashMap::<String, Value>::new();
    for item in items {
        let process = item
            .get("metadata")
            .and_then(Value::as_object)
            .and_then(|metadata| metadata.get("process"))
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty() && *value != "-")
            .unwrap_or("未知进程")
            .to_string();
        let host = item
            .get("metadata")
            .and_then(Value::as_object)
            .and_then(|metadata| metadata.get("host"))
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .or_else(|| {
                item.get("metadata")
                    .and_then(Value::as_object)
                    .and_then(|metadata| metadata.get("destinationIP"))
                    .and_then(Value::as_str)
            })
            .unwrap_or("")
            .to_string();
        let upload = item.get("upload").and_then(Value::as_u64).unwrap_or(0);
        let download = item.get("download").and_then(Value::as_u64).unwrap_or(0);

        let entry = process_stats.entry(process.clone()).or_insert_with(|| {
            json!({
                "process": process,
                "host": host,
                "upload": 0_u64,
                "download": 0_u64,
            })
        });

        if let Some(value) = entry.get_mut("upload") {
            *value = json!(value.as_u64().unwrap_or(0) + upload);
        }
        if let Some(value) = entry.get_mut("download") {
            *value = json!(value.as_u64().unwrap_or(0) + download);
        }
        if !host.is_empty() {
            if let Some(value) = entry.get_mut("host") {
                *value = Value::String(host);
            }
        }
    }

    let mut ranking = process_stats.into_values().collect::<Vec<_>>();
    ranking.sort_by(|left, right| {
        let left_value = left.get(sort_by).and_then(Value::as_u64).unwrap_or(0);
        let right_value = right.get(sort_by).and_then(Value::as_u64).unwrap_or(0);
        right_value.cmp(&left_value)
    });
    ranking.truncate(10);
    Ok(Value::Array(ranking))
}

fn fetch_text(url: &str, timeout_secs: u64) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client.get(url).send().map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("请求失败: {}", response.status()));
    }
    response.text().map_err(|e| e.to_string())
}

fn compare_versions(left: &str, right: &str) -> std::cmp::Ordering {
    let parse_parts = |version: &str| {
        version
            .split('.')
            .map(|part| {
                part.chars()
                    .take_while(|char| char.is_ascii_digit())
                    .collect::<String>()
                    .parse::<u64>()
                    .unwrap_or(0)
            })
            .collect::<Vec<_>>()
    };

    let left_parts = parse_parts(left);
    let right_parts = parse_parts(right);
    let max_len = left_parts.len().max(right_parts.len());

    for index in 0..max_len {
        let left_value = *left_parts.get(index).unwrap_or(&0);
        let right_value = *right_parts.get(index).unwrap_or(&0);
        match left_value.cmp(&right_value) {
            std::cmp::Ordering::Equal => continue,
            ordering => return ordering,
        }
    }

    std::cmp::Ordering::Equal
}

fn stringify_release_notes(value: Option<&serde_yaml::Value>) -> String {
    match value {
        Some(serde_yaml::Value::String(text)) => text.trim().to_string(),
        Some(serde_yaml::Value::Sequence(items)) => items
            .iter()
            .filter_map(|item| match item {
                serde_yaml::Value::String(text) => Some(text.trim().to_string()),
                other => serde_yaml::to_string(other)
                    .ok()
                    .map(|text| text.trim().to_string()),
            })
            .filter(|text| !text.is_empty())
            .collect::<Vec<_>>()
            .join("\n"),
        Some(other) => serde_yaml::to_string(other)
            .map(|text| text.trim().to_string())
            .unwrap_or_default(),
        None => String::new(),
    }
}

fn update_channel(app: &tauri::AppHandle) -> Result<String, String> {
    Ok(read_app_config_store(app)?
        .get("updateChannel")
        .and_then(Value::as_str)
        .unwrap_or("stable")
        .to_string())
}

fn release_tag_for_version(version: &str) -> String {
    if version.contains("beta") {
        String::from("pre-release")
    } else {
        format!("v{version}")
    }
}

fn update_manifest_url(app: &tauri::AppHandle) -> Result<String, String> {
    let update_channel = update_channel(app)?;
    Ok(if update_channel == "beta" {
        String::from("https://github.com/Jarv1s0/RouteX/releases/download/pre-release/latest.yml")
    } else {
        String::from("https://github.com/Jarv1s0/RouteX/releases/latest/download/latest.yml")
    })
}

fn update_client(app: &tauri::AppHandle, timeout_secs: u64) -> Result<Client, String> {
    let controlled_config = read_controlled_config_store(app)?;
    let mixed_port = controlled_config
        .get("mixed-port")
        .and_then(Value::as_u64)
        .unwrap_or(7890);

    let mut client_builder = Client::builder().timeout(Duration::from_secs(timeout_secs));
    if mixed_port != 0 {
        let proxy = reqwest::Proxy::http(format!("http://127.0.0.1:{mixed_port}"))
            .map_err(|e| e.to_string())?;
        client_builder = client_builder.proxy(proxy);
    }

    client_builder.build().map_err(|e| e.to_string())
}

fn fetch_update_manifest(app: &tauri::AppHandle) -> Result<ReleaseManifest, String> {
    let client = update_client(app, 20)?;
    let manifest_url = update_manifest_url(app)?;
    let response = client
        .get(&manifest_url)
        .header(reqwest::header::CONTENT_TYPE, "application/octet-stream")
        .send()
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("请求失败: {}", response.status()));
    }

    let manifest_text = response.text().map_err(|e| e.to_string())?;
    serde_yaml::from_str::<ReleaseManifest>(&manifest_text).map_err(|e| e.to_string())
}

fn emit_update_status(
    app: &tauri::AppHandle,
    downloading: bool,
    progress: u64,
    error: Option<&str>,
) {
    let payload = match error {
        Some(message) => json!({
            "downloading": downloading,
            "progress": progress,
            "error": message,
        }),
        None => json!({
            "downloading": downloading,
            "progress": progress,
        }),
    };
    emit_ipc_event(app, "update-status", payload);
}

fn supported_update_asset(path: &str) -> bool {
    let path = path.to_ascii_lowercase();

    #[cfg(target_os = "windows")]
    {
        return path.ends_with(".exe") || path.ends_with(".msi");
    }

    #[cfg(target_os = "macos")]
    {
        return path.ends_with(".pkg") || path.ends_with(".dmg");
    }

    #[cfg(target_os = "linux")]
    {
        return path.ends_with(".appimage") || path.ends_with(".deb") || path.ends_with(".rpm");
    }

    #[allow(unreachable_code)]
    false
}

fn resolve_update_asset(manifest: &ReleaseManifest) -> Result<(String, Option<String>), String> {
    if let Some(files) = manifest.files.as_ref() {
        if let Some(file) = files.iter().find(|file| {
            file.url
                .as_deref()
                .map(supported_update_asset)
                .unwrap_or(false)
        }) {
            return Ok((file.url.clone().unwrap_or_default(), file.sha512.clone()));
        }
    }

    if let Some(path) = manifest.path.as_ref() {
        if supported_update_asset(path) {
            return Ok((path.clone(), manifest.sha512.clone()));
        }
    }

    Err(String::from("更新清单里没有当前平台可用的安装包"))
}

fn resolve_update_asset_url(version: &str, asset_path: &str) -> String {
    if asset_path.starts_with("http://") || asset_path.starts_with("https://") {
        return asset_path.to_string();
    }

    format!(
        "https://github.com/Jarv1s0/RouteX/releases/download/{}/{}",
        release_tag_for_version(version),
        asset_path.trim_start_matches('/')
    )
}

fn update_download_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base_dir = app_data_root(app)?.join(UPDATES_DIR_NAME);
    fs::create_dir_all(&base_dir).map_err(|e| e.to_string())?;
    Ok(base_dir)
}

fn expected_sha512_bytes(sha512: &Option<String>) -> Result<Option<Vec<u8>>, String> {
    match sha512
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        Some(value) => BASE64_STANDARD
            .decode(value)
            .map(Some)
            .map_err(|e| format!("无法解析更新清单里的 SHA-512: {e}")),
        None => Ok(None),
    }
}

fn verify_file_sha512(path: &Path, expected: &Option<Vec<u8>>) -> Result<(), String> {
    let Some(expected) = expected.as_ref() else {
        return Ok(());
    };

    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha512::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    let actual = hasher.finalize().to_vec();
    if actual == *expected {
        return Ok(());
    }

    Err(String::from("更新包 SHA-512 校验失败"))
}

fn start_update_download(state: &State<'_, CoreState>) -> Result<Arc<AtomicBool>, String> {
    let mut guard = state
        .update_download_cancel
        .lock()
        .map_err(|_| String::from("更新状态锁已损坏"))?;
    if guard.is_some() {
        return Err(String::from("已有更新下载任务正在进行"));
    }

    let cancel_flag = Arc::new(AtomicBool::new(false));
    *guard = Some(cancel_flag.clone());
    Ok(cancel_flag)
}

fn finish_update_download(state: &State<'_, CoreState>) {
    if let Ok(mut guard) = state.update_download_cancel.lock() {
        *guard = None;
    }
}

fn launch_downloaded_update(app: &tauri::AppHandle, installer_path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let is_msi = installer_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("msi"))
            .unwrap_or(false);

        if is_msi {
            Command::new("msiexec")
                .arg("/i")
                .arg(installer_path)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            Command::new(installer_path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }

        app.exit(0);
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(installer_path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        if installer_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("AppImage"))
            .unwrap_or(false)
        {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;

                let mut permissions = fs::metadata(installer_path)
                    .map_err(|e| e.to_string())?
                    .permissions();
                permissions.set_mode(0o755);
                fs::set_permissions(installer_path, permissions).map_err(|e| e.to_string())?;
            }
        }

        open_path_in_shell(installer_path)?;
        return Ok(());
    }
}

fn download_and_install_update(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    version: &str,
) -> Result<(), String> {
    let cancel_flag = start_update_download(state)?;
    let result = (|| -> Result<(), String> {
        let manifest = fetch_update_manifest(app)?;
        if manifest.version != version {
            return Err(String::from("更新信息已变化，请重新检查更新"));
        }

        let (asset_path, sha512) = resolve_update_asset(&manifest)?;
        let download_url = resolve_update_asset_url(&manifest.version, &asset_path);
        let file_name = Path::new(&asset_path)
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| String::from("无法解析更新包文件名"))?;
        let download_path = update_download_dir(app)?.join(file_name);
        let expected_hash = expected_sha512_bytes(&sha512)?;

        emit_update_status(app, true, 0, None);

        let client = update_client(app, 600)?;
        let mut response = client
            .get(&download_url)
            .send()
            .map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!("下载更新失败: {}", response.status()));
        }

        let total_size = response.content_length();
        let mut file = fs::File::create(&download_path).map_err(|e| e.to_string())?;
        let mut downloaded_bytes = 0_u64;
        let mut buffer = [0_u8; 64 * 1024];

        loop {
            if cancel_flag.load(AtomicOrdering::SeqCst) {
                let _ = fs::remove_file(&download_path);
                emit_update_status(app, false, 0, Some("下载已取消"));
                return Ok(());
            }

            let read = response.read(&mut buffer).map_err(|e| e.to_string())?;
            if read == 0 {
                break;
            }

            file.write_all(&buffer[..read]).map_err(|e| e.to_string())?;
            downloaded_bytes += read as u64;

            let progress = total_size
                .map(|size| ((downloaded_bytes * 100) / size.max(1)).min(100))
                .unwrap_or(0);
            emit_update_status(app, true, progress, None);
        }

        file.flush().map_err(|e| e.to_string())?;
        verify_file_sha512(&download_path, &expected_hash)?;
        emit_update_status(app, false, 100, None);
        launch_downloaded_update(app, &download_path)
    })();

    if let Err(error) = &result {
        emit_update_status(app, false, 0, Some(error));
    }
    finish_update_download(state);
    result
}

fn cancel_update_download(state: &State<'_, CoreState>) -> Result<(), String> {
    let guard = state
        .update_download_cancel
        .lock()
        .map_err(|_| String::from("更新状态锁已损坏"))?;
    if let Some(cancel_flag) = guard.as_ref() {
        cancel_flag.store(true, AtomicOrdering::SeqCst);
    }
    Ok(())
}

fn check_update_manifest(app: &tauri::AppHandle) -> Result<Option<Value>, String> {
    let manifest = fetch_update_manifest(app)?;
    let current_version = app.package_info().version.to_string();

    if compare_versions(&manifest.version, &current_version).is_gt() {
        return Ok(Some(json!({
            "version": manifest.version,
            "releaseNotes": stringify_release_notes(manifest.release_notes.as_ref()),
        })));
    }

    Ok(None)
}

fn github_client(app: &tauri::AppHandle) -> Result<Client, String> {
    let controlled_config = read_controlled_config_store(app)?;
    let mixed_port = controlled_config
        .get("mixed-port")
        .and_then(Value::as_u64)
        .unwrap_or(7890);

    let mut builder = Client::builder().timeout(Duration::from_secs(30));
    if mixed_port != 0 {
        let proxy = reqwest::Proxy::http(format!("http://127.0.0.1:{mixed_port}"))
            .map_err(|e| e.to_string())?;
        builder = builder.proxy(proxy);
    }

    builder.build().map_err(|e| e.to_string())
}

fn get_github_token(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(read_app_config_store(app)?
        .get("githubToken")
        .and_then(Value::as_str)
        .map(str::to_string)
        .filter(|token| !token.trim().is_empty()))
}

fn list_gists(app: &tauri::AppHandle, token: &str) -> Result<Vec<GistInfo>, String> {
    let client = github_client(app)?;
    client
        .get("https://api.github.com/gists")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
        .send()
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<Vec<GistInfo>>()
        .map_err(|e| e.to_string())
}

fn upsert_runtime_gist(
    app: &tauri::AppHandle,
    token: &str,
    gist_id: Option<&str>,
) -> Result<(), String> {
    let client = github_client(app)?;
    let content = serde_yaml::to_string(&current_runtime_value(app, &app.state::<CoreState>())?)
        .map_err(|e| e.to_string())?;
    let payload = json!({
        "description": "Auto Synced RouteX Runtime Config",
        "public": false,
        "files": {
            "routex.yaml": {
                "content": content
            }
        }
    });

    let request = if let Some(id) = gist_id {
        client.patch(format!("https://api.github.com/gists/{id}"))
    } else {
        client.post("https://api.github.com/gists")
    };

    request
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
        .json(&payload)
        .send()
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn get_gist_url_value(app: &tauri::AppHandle) -> Result<String, String> {
    let Some(token) = get_github_token(app)? else {
        return Ok(String::new());
    };

    let mut gists = list_gists(app, &token)?;
    if let Some(gist) = gists
        .iter()
        .find(|gist| gist.description.as_deref() == Some("Auto Synced RouteX Runtime Config"))
    {
        return Ok(gist.html_url.clone());
    }

    upsert_runtime_gist(app, &token, None)?;
    gists = list_gists(app, &token)?;
    let gist = gists
        .iter()
        .find(|gist| gist.description.as_deref() == Some("Auto Synced RouteX Runtime Config"))
        .ok_or_else(|| "Gist not found".to_string())?;

    Ok(gist.html_url.clone())
}

fn get_provider_stats_value(app: &tauri::AppHandle) -> Result<ProviderStatsData, String> {
    let mut stats = read_provider_stats(app)?;
    let today = current_local_date_string();
    let profile_config = read_profile_config(app)?;

    for item in profile_config.items {
        let Some(extra) = item.extra.as_ref() else {
            continue;
        };

        let upload = extra.get("upload").and_then(Value::as_u64).unwrap_or(0);
        let download = extra.get("download").and_then(Value::as_u64).unwrap_or(0);
        let used = upload.saturating_add(download);
        let provider_name = if item.name.trim().is_empty() {
            item.id.clone()
        } else {
            item.name.clone()
        };

        if let Some(snapshot) = stats
            .snapshots
            .iter_mut()
            .find(|snapshot| snapshot.date == today && snapshot.provider == provider_name)
        {
            snapshot.used = used;
        } else {
            stats.snapshots.push(ProviderSnapshotData {
                date: today.clone(),
                provider: provider_name,
                used,
            });
        }
    }

    if stats.snapshots.len() > 4096 {
        stats.snapshots.sort_by(|left, right| {
            left.date
                .cmp(&right.date)
                .then(left.provider.cmp(&right.provider))
        });
        let overflow = stats.snapshots.len() - 4096;
        stats.snapshots.drain(..overflow);
    }

    stats.last_update = current_timestamp_ms();
    write_provider_stats(app, &stats)?;
    Ok(stats)
}

fn clear_provider_stats_value(app: &tauri::AppHandle) -> Result<(), String> {
    write_provider_stats(
        app,
        &ProviderStatsData {
            snapshots: Vec::new(),
            last_update: current_timestamp_ms(),
        },
    )
}

fn test_network_latency() -> i64 {
    let client = match Client::builder().timeout(NETWORK_HEALTH_TIMEOUT).build() {
        Ok(client) => client,
        Err(_) => return 0,
    };
    let started_at = Instant::now();
    match client.head(NETWORK_CONNECTIVITY_CHECK_URL).send() {
        Ok(response) if response.status().is_success() => started_at.elapsed().as_millis() as i64,
        Ok(_) | Err(_) => 0,
    }
}

fn test_dns_latency(domain: &str) -> i64 {
    let started_at = Instant::now();
    match (domain, 80).to_socket_addrs() {
        Ok(mut addrs) => {
            if addrs.next().is_some() {
                let elapsed = started_at.elapsed().as_millis() as i64;
                elapsed.max(1)
            } else {
                -1
            }
        }
        Err(_) => -1,
    }
}

fn calculate_network_health_value(state: &NetworkHealthState) -> Value {
    let valid_latencies = state
        .latency_history
        .iter()
        .copied()
        .filter(|latency| *latency > 0)
        .collect::<Vec<_>>();
    let current_latency = state.latency_history.last().copied().unwrap_or(-1);
    let current_dns_latency = state.dns_latency_history.last().copied().unwrap_or(-1);
    let avg_latency = if valid_latencies.is_empty() {
        0
    } else {
        valid_latencies.iter().sum::<i64>() / valid_latencies.len() as i64
    };
    let max_latency = valid_latencies.iter().copied().max().unwrap_or(0);
    let min_latency = valid_latencies.iter().copied().min().unwrap_or(0);
    let jitter = if valid_latencies.len() < 2 {
        0
    } else {
        let sum = valid_latencies
            .windows(2)
            .map(|window| (window[1] - window[0]).abs())
            .sum::<i64>();
        sum / (valid_latencies.len() - 1) as i64
    };
    let packet_loss = if state.test_count == 0 {
        0
    } else {
        ((state.fail_count as f64 / state.test_count as f64) * 100.0).round() as i64
    };
    let uptime = if state.test_count == 0 {
        100.0
    } else {
        (((state.test_count - state.fail_count) as f64 / state.test_count as f64) * 1000.0).round()
            / 10.0
    };

    json!({
        "currentLatency": current_latency,
        "currentDnsLatency": current_dns_latency,
        "avgLatency": avg_latency,
        "maxLatency": max_latency,
        "minLatency": min_latency,
        "jitter": jitter,
        "packetLoss": packet_loss,
        "uptime": uptime,
        "testCount": state.test_count,
        "failCount": state.fail_count,
    })
}

fn run_network_health_test(app: &tauri::AppHandle) {
    let latency = test_network_latency();
    let dns_latency = test_dns_latency("www.bing.com");
    let payload = {
        let state = app.state::<CoreState>();
        let Ok(mut health_state) = state.network_health_state.lock() else {
            return;
        };
        health_state.test_count += 1;
        if latency <= 0 {
            health_state.fail_count += 1;
        }
        health_state.latency_history.push(latency);
        if health_state.latency_history.len() > NETWORK_HEALTH_MAX_HISTORY {
            let overflow = health_state.latency_history.len() - NETWORK_HEALTH_MAX_HISTORY;
            health_state.latency_history.drain(..overflow);
        }
        health_state.dns_latency_history.push(dns_latency);
        if health_state.dns_latency_history.len() > NETWORK_HEALTH_MAX_HISTORY {
            let overflow = health_state.dns_latency_history.len() - NETWORK_HEALTH_MAX_HISTORY;
            health_state.dns_latency_history.drain(..overflow);
        }
        calculate_network_health_value(&health_state)
    };

    emit_ipc_event(app, "networkHealth", payload);
}

fn start_network_health_monitor(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    let mut monitor_handle = state
        .network_health_monitor
        .lock()
        .map_err(|e| e.to_string())?;
    if monitor_handle.is_some() {
        return Ok(());
    }

    let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>();
    let app_handle = app.clone();
    thread::spawn(move || {
        let app_handle = app_handle.clone();
        run_network_health_test(&app_handle);
        loop {
            match shutdown_rx.recv_timeout(NETWORK_HEALTH_TEST_INTERVAL) {
                Ok(_) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    run_network_health_test(&app_handle);
                }
            }
        }
    });

    *monitor_handle = Some(NetworkHealthMonitorHandle {
        shutdown: shutdown_tx,
    });
    Ok(())
}

fn stop_network_health_monitor(state: &State<'_, CoreState>) -> Result<(), String> {
    let mut monitor_handle = state
        .network_health_monitor
        .lock()
        .map_err(|e| e.to_string())?;
    if let Some(handle) = monitor_handle.take() {
        let _ = handle.shutdown.send(());
    }
    Ok(())
}

fn start_core_events_monitor(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    let controller_url = current_controller_url(state)?
        .ok_or_else(|| "Mihomo controller is not available".to_string())?;
    let connection_interval = Duration::from_millis(read_connection_interval_ms(app));

    stop_core_events_monitor(state)?;

    let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>();
    let app_handle = app.clone();
    thread::spawn(move || {
        let client = match Client::builder().timeout(Duration::from_secs(3)).build() {
            Ok(client) => client,
            Err(_) => return,
        };
        let connections_url = format!("{controller_url}/connections");
        let mut last_totals: Option<(u64, u64, Instant)> = None;

        loop {
            if let Ok(response) = client.get(&connections_url).send() {
                if response.status().is_success() {
                    if let Ok(snapshot) = response.json::<Value>() {
                        let now = Instant::now();
                        let upload_total = json_u64(snapshot.get("uploadTotal"));
                        let download_total = json_u64(snapshot.get("downloadTotal"));
                        let (up, down) = if let Some((last_upload, last_download, last_at)) =
                            last_totals
                        {
                            let elapsed_ms = now.duration_since(last_at).as_millis().max(1) as u64;
                            (
                                upload_total
                                    .saturating_sub(last_upload)
                                    .saturating_mul(1000)
                                    / elapsed_ms,
                                download_total
                                    .saturating_sub(last_download)
                                    .saturating_mul(1000)
                                    / elapsed_ms,
                            )
                        } else {
                            (0, 0)
                        };

                        last_totals = Some((upload_total, download_total, now));
                        emit_ipc_event(
                            &app_handle,
                            "mihomoTraffic",
                            json!({ "up": up, "down": down }),
                        );
                    }
                }
            }

            match shutdown_rx.recv_timeout(connection_interval) {
                Ok(_) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
                Err(mpsc::RecvTimeoutError::Timeout) => {}
            }
        }
    });

    let mut monitor_handle = state
        .core_events_monitor
        .lock()
        .map_err(|e| e.to_string())?;
    *monitor_handle = Some(CoreEventsMonitorHandle {
        shutdown: shutdown_tx,
    });
    Ok(())
}

fn stop_core_events_monitor(state: &State<'_, CoreState>) -> Result<(), String> {
    let mut monitor_handle = state
        .core_events_monitor
        .lock()
        .map_err(|e| e.to_string())?;
    if let Some(handle) = monitor_handle.take() {
        let _ = handle.shutdown.send(());
    }
    Ok(())
}

fn get_network_health_stats_value(state: &State<'_, CoreState>) -> Result<Value, String> {
    let health_state = state
        .network_health_state
        .lock()
        .map_err(|e| e.to_string())?;
    Ok(calculate_network_health_value(&health_state))
}

fn get_app_uptime_seconds() -> u64 {
    APP_STARTED_AT.get_or_init(Instant::now).elapsed().as_secs()
}

fn collect_process_memory_snapshot() -> Value {
    let pid = std::process::id();
    let mut snapshot = json!({
        "pid": pid,
        "platform": platform_name(),
        "timestamp": current_timestamp_ms(),
        "uptimeSeconds": get_app_uptime_seconds(),
        "executable": std::env::current_exe()
            .ok()
            .map(|path| path.to_string_lossy().to_string()),
    });

    #[cfg(target_os = "windows")]
    {
        let script = format!(
            r#"
$process = Get-Process -Id {pid} -ErrorAction SilentlyContinue
if ($null -ne $process) {{
  [pscustomobject]@{{
    workingSet = [int64]$process.WorkingSet64
    privateMemory = [int64]$process.PrivateMemorySize64
    virtualMemory = [int64]$process.VirtualMemorySize64
    pagedMemory = [int64]$process.PagedMemorySize64
    handleCount = [int]$process.HandleCount
    threadCount = [int]$process.Threads.Count
  }} | ConvertTo-Json -Compress
}}
"#
        );

        if let Ok(output) = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if let Ok(Value::Object(values)) = serde_json::from_str::<Value>(&stdout) {
                    if let Some(object) = snapshot.as_object_mut() {
                        object.extend(values);
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let pid_string = pid.to_string();
        if let Ok(output) = Command::new("ps")
            .args(["-o", "rss=,vsz=", "-p", &pid_string])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let parts = stdout.split_whitespace().collect::<Vec<_>>();
                if let Some(object) = snapshot.as_object_mut() {
                    if let Some(rss_kb) = parts.first().and_then(|value| value.parse::<u64>().ok())
                    {
                        object.insert("residentSetKb".to_string(), json!(rss_kb));
                    }
                    if let Some(vsz_kb) = parts.get(1).and_then(|value| value.parse::<u64>().ok()) {
                        object.insert("virtualMemoryKb".to_string(), json!(vsz_kb));
                    }
                }
            }
        }
    }

    snapshot
}

fn create_heap_snapshot(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<String, String> {
    let (base_dir, _, _, _) = ensure_runtime_dirs(app, None, false)?;
    let diagnostics_dir = base_dir.join("diagnostics");
    fs::create_dir_all(&diagnostics_dir).map_err(|e| e.to_string())?;

    let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    let output_path = diagnostics_dir.join(format!(
        "{}-diagnostic.heapsnapshot.json",
        current_timestamp_ms()
    ));
    let payload = json!({
        "kind": "tauri-diagnostic-snapshot",
        "process": collect_process_memory_snapshot(),
        "runtime": {
            "binaryPath": runtime.binary_path.as_ref().map(|path| path.to_string_lossy().to_string()),
            "workDir": runtime.work_dir.as_ref().map(|path| path.to_string_lossy().to_string()),
            "logPath": runtime.log_path.as_ref().map(|path| path.to_string_lossy().to_string()),
            "controllerUrl": runtime.controller_url.clone(),
            "configPath": runtime.config_path.as_ref().map(|path| path.to_string_lossy().to_string()),
        }
    });
    drop(runtime);

    write_json_file(&output_path, &payload)?;
    Ok(output_path.to_string_lossy().to_string())
}

fn convert_mrs_ruleset(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    raw_path: &str,
    behavior: &str,
) -> Result<String, String> {
    let source = resolve_runtime_file_path(app, state, raw_path)?;
    if !source.exists() {
        return Err(format!("规则文件不存在: {}", source.display()));
    }

    let binary = resolve_core_binary(app, "mihomo")?;
    let output = std::env::temp_dir().join(format!("routex-mrs-{}.txt", create_id()));

    let status = Command::new(binary)
        .arg("convert-ruleset")
        .arg(behavior)
        .arg("mrs")
        .arg(&source)
        .arg(&output)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err(format!("convert-ruleset 执行失败: {}", status));
    }

    let text = fs::read_to_string(&output).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(output);
    Ok(text)
}

fn open_path_in_shell(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg(path);
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(path);
        command
    };

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        command
    };

    command.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

fn normalize_dialog_extensions(extensions: &[String]) -> Vec<String> {
    extensions
        .iter()
        .map(|ext| ext.trim().trim_start_matches('.').to_ascii_lowercase())
        .filter(|ext| !ext.is_empty())
        .collect()
}

#[cfg(not(target_os = "windows"))]
fn normalize_dialog_result(output: std::process::Output) -> Result<Option<String>, String> {
    match collect_command_error(output) {
        Ok(stdout) => {
            let value = stdout.trim().trim_matches('\0').to_string();
            if value.is_empty() {
                Ok(None)
            } else {
                Ok(Some(value))
            }
        }
        Err(error) if error == "UserCancelledError" => Ok(None),
        Err(error) => Err(error),
    }
}

#[cfg(target_os = "windows")]
fn powershell_single_quoted(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(target_os = "windows")]
fn encode_powershell_script(script: &str) -> String {
    let utf16 = script
        .encode_utf16()
        .flat_map(|unit| unit.to_le_bytes())
        .collect::<Vec<_>>();
    BASE64_STANDARD.encode(utf16)
}

#[cfg(target_os = "windows")]
fn run_powershell_script(script: &str) -> Result<String, String> {
    let encoded = encode_powershell_script(script);
    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &encoded])
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if output.status.success() {
        return Ok(stdout);
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !stderr.is_empty() {
        return Err(stderr);
    }
    if !stdout.is_empty() {
        return Err(stdout);
    }

    Err(format!("PowerShell 执行失败: {}", output.status))
}

#[cfg(target_os = "windows")]
fn windows_dialog_filter(extensions: &[String]) -> String {
    if extensions.is_empty() {
        return "所有文件 (*.*)|*.*".to_string();
    }

    let patterns = extensions
        .iter()
        .map(|ext| format!("*.{ext}"))
        .collect::<Vec<_>>();
    let joined_patterns = patterns.join(";");
    format!("支持的文件 ({joined_patterns})|{joined_patterns}|所有文件 (*.*)|*.*")
}

#[cfg(target_os = "windows")]
fn pick_open_file_paths_native(extensions: &[String]) -> Result<Option<Vec<String>>, String> {
    let filter = powershell_single_quoted(&windows_dialog_filter(extensions));
    let script = format!(
        r#"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '选择文件'
$dialog.Filter = {filter}
$dialog.Multiselect = $false
$dialog.CheckFileExists = $true
$dialog.RestoreDirectory = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{
  @($dialog.FileName) | ConvertTo-Json -Compress
}}
"#
    );

    let stdout = run_powershell_script(&script)?;
    if stdout.is_empty() {
        return Ok(None);
    }

    let files = serde_json::from_str::<Vec<String>>(&stdout).map_err(|e| e.to_string())?;
    let files = files
        .into_iter()
        .filter(|path| !path.trim().is_empty())
        .collect::<Vec<_>>();

    if files.is_empty() {
        return Ok(None);
    }

    Ok(Some(files))
}

#[cfg(not(target_os = "windows"))]
fn pick_open_file_paths_native(extensions: &[String]) -> Result<Option<Vec<String>>, String> {
    #[cfg(target_os = "macos")]
    {
        let _ = extensions;
        let output = Command::new("osascript")
            .args([
                "-e",
                r#"POSIX path of (choose file with prompt "选择文件")"#,
            ])
            .output()
            .map_err(|e| e.to_string())?;
        return Ok(normalize_dialog_result(output)?.map(|path| vec![path]));
    }

    #[cfg(target_os = "linux")]
    {
        let patterns = extensions
            .iter()
            .map(|ext| format!("*.{ext}"))
            .collect::<Vec<_>>();

        let mut run_backend = |backend: &str| -> Result<Option<Vec<String>>, String> {
            match backend {
                "kdialog" => {
                    let mut command = Command::new("kdialog");
                    command.arg("--getopenfilename").arg(".");
                    if !patterns.is_empty() {
                        command.arg(format!("{}|支持的文件", patterns.join(" ")));
                    }
                    let output = command.output().map_err(|e| e.to_string())?;
                    Ok(normalize_dialog_result(output)?.map(|path| vec![path]))
                }
                "zenity" | "qarma" => {
                    let mut command = Command::new(backend);
                    command.args(["--file-selection", "--title=选择文件"]);
                    if !patterns.is_empty() {
                        command.arg(format!("--file-filter=支持的文件 | {}", patterns.join(" ")));
                        command.arg("--file-filter=所有文件 | *");
                    }
                    let output = command.output().map_err(|e| e.to_string())?;
                    Ok(normalize_dialog_result(output)?.map(|path| vec![path]))
                }
                _ => Err("当前平台未实现原生打开文件对话框".to_string()),
            }
        };

        for backend in ["zenity", "qarma", "kdialog"] {
            if Command::new("sh")
                .args(["-c", &format!("command -v {backend} >/dev/null 2>&1")])
                .status()
                .map(|status| status.success())
                .unwrap_or(false)
            {
                return run_backend(backend);
            }
        }

        return Err(
            "当前 Linux 环境缺少可用的原生文件对话框命令（zenity/qarma/kdialog）".to_string(),
        );
    }

    #[allow(unreachable_code)]
    Err("当前平台未实现原生打开文件对话框".to_string())
}

#[cfg(target_os = "windows")]
fn pick_save_file_path_native(default_name: &str, ext: &str) -> Result<Option<PathBuf>, String> {
    let normalized_ext = ext.trim().trim_start_matches('.').to_ascii_lowercase();
    let normalized_name = if normalized_ext.is_empty()
        || default_name
            .to_ascii_lowercase()
            .ends_with(&format!(".{normalized_ext}"))
    {
        default_name.to_string()
    } else {
        format!("{default_name}.{normalized_ext}")
    };
    let filter = powershell_single_quoted(&windows_dialog_filter(&[normalized_ext.clone()]));
    let file_name = powershell_single_quoted(&normalized_name);
    let default_ext = powershell_single_quoted(&normalized_ext);
    let script = format!(
        r#"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.SaveFileDialog
$dialog.Title = '保存文件'
$dialog.Filter = {filter}
$dialog.FileName = {file_name}
$dialog.DefaultExt = {default_ext}
$dialog.AddExtension = $true
$dialog.OverwritePrompt = $true
$dialog.RestoreDirectory = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{
  $dialog.FileName
}}
"#
    );

    let stdout = run_powershell_script(&script)?;
    if stdout.is_empty() {
        return Ok(None);
    }

    Ok(Some(PathBuf::from(stdout)))
}

#[cfg(not(target_os = "windows"))]
fn pick_save_file_path_native(default_name: &str, ext: &str) -> Result<Option<PathBuf>, String> {
    let normalized_ext = ext.trim().trim_start_matches('.').to_ascii_lowercase();
    let normalized_name = if normalized_ext.is_empty()
        || default_name
            .to_ascii_lowercase()
            .ends_with(&format!(".{normalized_ext}"))
    {
        default_name.to_string()
    } else {
        format!("{default_name}.{normalized_ext}")
    };

    #[cfg(target_os = "macos")]
    {
        let escaped_name = normalized_name.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!(
            r#"POSIX path of (choose file name with prompt "保存文件" default name "{}")"#,
            escaped_name
        );
        let output = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| e.to_string())?;
        return Ok(normalize_dialog_result(output)?.map(PathBuf::from));
    }

    #[cfg(target_os = "linux")]
    {
        let initial_path = std::env::current_dir()
            .map_err(|e| e.to_string())?
            .join(&normalized_name);
        let initial_path = initial_path.to_string_lossy().to_string();
        let patterns = if normalized_ext.is_empty() {
            Vec::new()
        } else {
            vec![format!("*.{normalized_ext}")]
        };

        let mut run_backend = |backend: &str| -> Result<Option<PathBuf>, String> {
            match backend {
                "kdialog" => {
                    let mut command = Command::new("kdialog");
                    command.arg("--getsavefilename").arg(&initial_path);
                    if !patterns.is_empty() {
                        command.arg(format!("{}|支持的文件", patterns.join(" ")));
                    }
                    let output = command.output().map_err(|e| e.to_string())?;
                    Ok(normalize_dialog_result(output)?.map(PathBuf::from))
                }
                "zenity" | "qarma" => {
                    let mut command = Command::new(backend);
                    command.args([
                        "--file-selection",
                        "--save",
                        "--confirm-overwrite",
                        "--title=保存文件",
                    ]);
                    command.arg(format!("--filename={initial_path}"));
                    if !patterns.is_empty() {
                        command.arg(format!("--file-filter=支持的文件 | {}", patterns.join(" ")));
                        command.arg("--file-filter=所有文件 | *");
                    }
                    let output = command.output().map_err(|e| e.to_string())?;
                    Ok(normalize_dialog_result(output)?.map(PathBuf::from))
                }
                _ => Err("当前平台未实现原生保存文件对话框".to_string()),
            }
        };

        for backend in ["zenity", "qarma", "kdialog"] {
            if Command::new("sh")
                .args(["-c", &format!("command -v {backend} >/dev/null 2>&1")])
                .status()
                .map(|status| status.success())
                .unwrap_or(false)
            {
                return run_backend(backend);
            }
        }

        return Err(
            "当前 Linux 环境缺少可用的原生文件对话框命令（zenity/qarma/kdialog）".to_string(),
        );
    }

    #[allow(unreachable_code)]
    Err("当前平台未实现原生保存文件对话框".to_string())
}

fn save_text_file_with_dialog(
    content: &str,
    default_name: &str,
    ext: &str,
) -> Result<bool, String> {
    let Some(path) = pick_save_file_path_native(default_name, ext)? else {
        return Ok(false);
    };

    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(true)
}

fn relaunch_current_app(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    shutdown_runtime(app, state);

    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let current_dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let args = std::env::args_os().skip(1).collect::<Vec<_>>();

    Command::new(current_exe)
        .args(args)
        .current_dir(current_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    app.exit(0);
    Ok(())
}

fn command_exists(command: &str) -> bool {
    let locator = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };
    Command::new(locator)
        .arg(command)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn find_system_mihomo_paths() -> Vec<String> {
    let mut found_paths = Vec::new();
    let mut seen = HashSet::new();
    let search_names = ["mihomo", "clash"];

    let mut push_candidate = |path: PathBuf| {
        if path.exists() {
            let value = path.to_string_lossy().to_string();
            if seen.insert(value.clone()) {
                found_paths.push(value);
            }
        }
    };

    for name in search_names {
        let locator = if cfg!(target_os = "windows") {
            "where"
        } else {
            "which"
        };
        if let Ok(output) = Command::new(locator).arg(name).output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout
                    .lines()
                    .map(str::trim)
                    .filter(|line| !line.is_empty())
                {
                    push_candidate(PathBuf::from(line));
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut common_dirs = vec![
            PathBuf::from("/bin"),
            PathBuf::from("/usr/bin"),
            PathBuf::from("/usr/local/bin"),
        ];
        if let Ok(home_dir) = user_home_dir() {
            common_dirs.push(home_dir.join(".local").join("bin"));
            common_dirs.push(home_dir.join("bin"));
        }

        for dir in common_dirs {
            if !dir.exists() {
                continue;
            }

            for name in search_names {
                push_candidate(dir.join(name));
            }
        }
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    if command_exists("brew") {
        for name in search_names {
            if let Ok(output) = Command::new("brew").args(["--prefix", name]).output() {
                if output.status.success() {
                    let prefix = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !prefix.is_empty() {
                        push_candidate(PathBuf::from(prefix).join("bin").join(name));
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    if command_exists("scoop") {
        for name in search_names {
            if let Ok(output) = Command::new("scoop").args(["which", name]).output() {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    for line in stdout
                        .lines()
                        .map(str::trim)
                        .filter(|line| !line.is_empty())
                    {
                        push_candidate(PathBuf::from(line));
                    }
                }
            }
        }
    }

    found_paths.sort();
    found_paths
}

fn build_proxy_env_command(app: &tauri::AppHandle, shell_type: &str) -> Result<String, String> {
    let app_config = read_app_config_store(app)?;
    let controlled_config = read_controlled_config_store(app)?;
    let sys_proxy = app_config.get("sysProxy").and_then(Value::as_object);
    let host = sys_proxy
        .and_then(|value| value.get("host"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("127.0.0.1");
    let bypass = json_array_strings(sys_proxy.and_then(|value| value.get("bypass"))).join(",");
    let mixed_port = controlled_config
        .get("mixed-port")
        .and_then(Value::as_u64)
        .unwrap_or(7890);
    let proxy_url = format!("http://{host}:{mixed_port}");

    match shell_type {
        "bash" => Ok(format!(
            "export https_proxy={proxy_url} http_proxy={proxy_url} all_proxy={proxy_url} no_proxy={bypass}"
        )),
        "cmd" => Ok(format!(
            "set http_proxy={proxy_url}\r\nset https_proxy={proxy_url}\r\nset no_proxy={bypass}"
        )),
        "powershell" => Ok(format!(
            "$env:HTTP_PROXY=\"{proxy_url}\"; $env:HTTPS_PROXY=\"{proxy_url}\"; $env:no_proxy=\"{bypass}\""
        )),
        "nushell" => Ok(format!(
            "load-env {{http_proxy:\"{proxy_url}\", https_proxy:\"{proxy_url}\", no_proxy:\"{bypass}\"}}"
        )),
        other => Err(format!("不支持的终端类型: {other}")),
    }
}

#[cfg(target_os = "windows")]
fn copy_text_to_clipboard(text: &str) -> Result<(), String> {
    let script = format!(
        r#"
$clipboardText = @'
{text}
'@
Set-Clipboard -Value $clipboardText
"#
    );
    run_powershell_script(&script).map(|_| ())
}

#[cfg(target_os = "macos")]
fn copy_text_to_clipboard(text: &str) -> Result<(), String> {
    let mut child = Command::new("pbcopy")
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    let Some(stdin) = child.stdin.as_mut() else {
        return Err("无法写入 pbcopy 标准输入".to_string());
    };
    stdin
        .write_all(text.as_bytes())
        .map_err(|e| e.to_string())?;
    let status = child.wait().map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("pbcopy 执行失败: {status}"))
    }
}

#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
fn copy_text_to_clipboard(text: &str) -> Result<(), String> {
    for program in ["wl-copy", "xclip", "xsel"] {
        let mut command = Command::new(program);
        match program {
            "xclip" => {
                command.args(["-selection", "clipboard"]);
            }
            "xsel" => {
                command.args(["--clipboard", "--input"]);
            }
            _ => {}
        }

        let Ok(mut child) = command.stdin(Stdio::piped()).spawn() else {
            continue;
        };
        if let Some(stdin) = child.stdin.as_mut() {
            stdin
                .write_all(text.as_bytes())
                .map_err(|e| e.to_string())?;
        }
        let status = child.wait().map_err(|e| e.to_string())?;
        if status.success() {
            return Ok(());
        }
    }

    Err("当前系统未找到可用的剪贴板命令".to_string())
}

fn allocate_controller_address() -> Result<String, String> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let address = listener.local_addr().map_err(|e| e.to_string())?;
    drop(listener);
    Ok(format!("127.0.0.1:{}", address.port()))
}

fn dev_root() -> Result<PathBuf, String> {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "failed to resolve repo root".to_string())
}

fn current_exe_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
}

fn push_resource_candidate(
    candidates: &mut Vec<PathBuf>,
    seen: &mut HashSet<PathBuf>,
    path: PathBuf,
) {
    if seen.insert(path.clone()) {
        candidates.push(path);
    }
}

fn collect_resource_candidates(
    app: &tauri::AppHandle,
    relative_dir: &str,
    file_name: &str,
) -> Result<Vec<PathBuf>, String> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    if cfg!(debug_assertions) {
        push_resource_candidate(
            &mut candidates,
            &mut seen,
            dev_root()?.join("extra").join(relative_dir).join(file_name),
        );
    }

    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    for base in [
        resource_dir.clone(),
        resource_dir.join("extra"),
        resource_dir
            .parent()
            .map(|path| path.join("_up_").join("extra"))
            .unwrap_or_default(),
    ] {
        if !base.as_os_str().is_empty() {
            push_resource_candidate(
                &mut candidates,
                &mut seen,
                base.join(relative_dir).join(file_name),
            );
        }
    }

    if let Some(exe_dir) = current_exe_dir() {
        for base in [
            exe_dir.clone(),
            exe_dir.join("resources"),
            exe_dir.join("_up_").join("extra"),
            exe_dir
                .parent()
                .map(|path| path.join("Resources"))
                .unwrap_or_default(),
        ] {
            if !base.as_os_str().is_empty() {
                push_resource_candidate(
                    &mut candidates,
                    &mut seen,
                    base.join(relative_dir).join(file_name),
                );
            }
        }
    }

    Ok(candidates)
}

fn resolve_resource_binary(
    app: &tauri::AppHandle,
    relative_dir: &str,
    file_name: &str,
) -> Result<PathBuf, String> {
    let candidates = collect_resource_candidates(app, relative_dir, file_name)?;
    for path in &candidates {
        if path.exists() {
            return Ok(path.clone());
        }
    }

    let searched = candidates
        .iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(", ");
    Err(format!(
        "Resource not found: {relative_dir}/{file_name}. searched: {searched}"
    ))
}

fn resolve_core_binary(app: &tauri::AppHandle, core: &str) -> Result<PathBuf, String> {
    let extension = if cfg!(target_os = "windows") {
        ".exe"
    } else {
        ""
    };
    let file_name = format!("{core}{extension}");
    resolve_resource_binary(app, "sidecar", &file_name)
        .map_err(|_| format!("Mihomo core not found: {file_name}"))
}

fn resolve_service_binary(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let extension = if cfg!(target_os = "windows") {
        ".exe"
    } else {
        ""
    };
    let file_name = format!("routex-service{extension}");
    resolve_resource_binary(app, "files", &file_name)
        .map_err(|_| format!("RouteX service not found: {file_name}"))
}

fn read_sysproxy_value(app: &tauri::AppHandle) -> Result<Value, String> {
    Ok(read_app_config_store(app)?
        .get("sysProxy")
        .cloned()
        .unwrap_or_else(|| json!({ "enable": false, "mode": "manual" })))
}

fn read_only_active_device(app: &tauri::AppHandle) -> Result<bool, String> {
    Ok(read_app_config_store(app)?
        .get("onlyActiveDevice")
        .and_then(Value::as_bool)
        .unwrap_or(false))
}

fn read_mixed_port(app: &tauri::AppHandle) -> Result<u64, String> {
    Ok(read_controlled_config_store(app)?
        .get("mixed-port")
        .and_then(Value::as_u64)
        .unwrap_or(7890))
}

fn build_sysproxy_signature(
    app: &tauri::AppHandle,
    enable: bool,
    only_active_device: bool,
) -> Result<String, String> {
    if !enable {
        return Ok(json!({
            "enable": enable,
            "onlyActiveDevice": only_active_device,
        })
        .to_string());
    }

    let sysproxy = read_sysproxy_value(app)?;
    let bypass = {
        let values = json_array_strings(sysproxy.get("bypass"));
        if values.is_empty() {
            default_sysproxy_bypass()
        } else {
            values
        }
    };

    Ok(json!({
        "enable": enable,
        "onlyActiveDevice": only_active_device,
        "mode": sysproxy.get("mode").and_then(Value::as_str).unwrap_or("manual"),
        "host": sysproxy.get("host").and_then(Value::as_str).unwrap_or("127.0.0.1"),
        "settingMode": sysproxy.get("settingMode").and_then(Value::as_str).unwrap_or("exec"),
        "bypass": bypass,
        "port": read_mixed_port(app)?,
    })
    .to_string())
}

fn run_service_command(app: &tauri::AppHandle, args: &[String]) -> Result<(), String> {
    let binary = resolve_service_binary(app)?;
    let output = Command::new(binary)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        Err(format!("RouteX service command failed: {}", output.status))
    } else {
        Err(stderr)
    }
}

fn run_service_command_capture(app: &tauri::AppHandle, args: &[String]) -> Result<String, String> {
    let binary = resolve_service_binary(app)?;
    let output = Command::new(binary)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let combined = if stderr.is_empty() {
        stdout.clone()
    } else if stdout.is_empty() {
        stderr.clone()
    } else {
        format!("{stdout}\n{stderr}")
    };

    if output.status.success() {
        Ok(combined)
    } else if combined.is_empty() {
        Err(format!("RouteX service command failed: {}", output.status))
    } else {
        Err(combined)
    }
}

fn service_command_args(
    only_active_device: bool,
    command: &str,
    extra_args: Vec<String>,
) -> Vec<String> {
    let mut args = Vec::new();
    if only_active_device {
        args.push(String::from("--only-active-device"));
    }
    args.push(command.to_string());
    args.extend(extra_args);
    args
}

fn task_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_root(app)?.join(TASKS_DIR_NAME);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn routex_run_binary_task_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(task_dir(app)?.join(ROUTEX_RUN_BINARY))
}

fn routex_run_task_xml_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(task_dir(app)?.join(ROUTEX_RUN_XML))
}

fn routex_autorun_task_xml_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(task_dir(app)?.join(ROUTEX_AUTORUN_XML))
}

fn resolve_routex_run_binary(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    resolve_resource_binary(app, "files", ROUTEX_RUN_BINARY)
        .map_err(|_| format!("RouteX run helper not found: {ROUTEX_RUN_BINARY}"))
}

fn encode_utf16le_with_bom(value: &str) -> Vec<u8> {
    let mut bytes = vec![0xFF, 0xFE];
    for code_unit in value.encode_utf16() {
        bytes.extend_from_slice(&code_unit.to_le_bytes());
    }
    bytes
}

fn schtasks_command(args: &[&str]) -> Result<(), String> {
    let output = Command::new("schtasks.exe")
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !stderr.is_empty() {
        Err(stderr)
    } else if !stdout.is_empty() {
        Err(stdout)
    } else {
        Err(format!("schtasks failed: {}", output.status))
    }
}

fn build_routex_run_task_xml(app: &tauri::AppHandle) -> Result<String, String> {
    let routex_run_path = routex_run_binary_task_path(app)?;
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers />
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>3</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>"{}"</Command>
      <Arguments>"{}"</Arguments>
    </Exec>
  </Actions>
</Task>
"#,
        routex_run_path.display(),
        exe_path.display()
    ))
}

fn build_routex_autorun_task_xml(app: &tauri::AppHandle) -> Result<String, String> {
    let routex_run_path = routex_run_binary_task_path(app)?;
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <Delay>PT3S</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>3</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>"{}"</Command>
      <Arguments>"{}"</Arguments>
    </Exec>
  </Actions>
</Task>
"#,
        routex_run_path.display(),
        exe_path.display()
    ))
}

fn create_autorun_task(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let task_file_path = routex_autorun_task_xml_path(app)?;
        let routex_run_dest = routex_run_binary_task_path(app)?;
        let routex_run_source = resolve_routex_run_binary(app)?;
        let task_xml = build_routex_autorun_task_xml(app)?;

        fs::write(&task_file_path, encode_utf16le_with_bom(&task_xml))
            .map_err(|e| e.to_string())?;
        fs::copy(routex_run_source, routex_run_dest).map_err(|e| e.to_string())?;
        schtasks_command(&[
            "/create",
            "/tn",
            ROUTEX_AUTORUN_TASK_NAME,
            "/xml",
            task_file_path
                .to_str()
                .ok_or_else(|| "invalid autorun task xml path".to_string())?,
            "/f",
        ])?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("当前平台未实现开机自启".to_string())
    }
}

fn delete_autorun_task() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        match schtasks_command(&["/delete", "/tn", ROUTEX_AUTORUN_TASK_NAME, "/f"]) {
            Ok(()) => Ok(()),
            Err(error) if error.to_ascii_lowercase().contains("cannot find") => Ok(()),
            Err(error) if error.contains("找不到") => Ok(()),
            Err(error) => Err(error),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

fn check_autorun_task() -> bool {
    #[cfg(target_os = "windows")]
    {
        schtasks_command(&["/query", "/tn", ROUTEX_AUTORUN_TASK_NAME]).is_ok()
    }

    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn user_home_dir() -> Result<PathBuf, String> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "无法解析用户主目录".to_string())
}

#[cfg(target_os = "macos")]
fn macos_login_item_name() -> Result<String, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(exe_path
        .to_string_lossy()
        .split(".app")
        .next()
        .unwrap_or_default()
        .replace("/Applications/", ""))
}

#[cfg(target_os = "macos")]
fn check_autorun_macos() -> Result<bool, String> {
    let login_item_name = macos_login_item_name()?;
    let output = Command::new("osascript")
        .args([
            "-e",
            r#"tell application "System Events" to get the name of every login item"#,
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("osascript 执行失败: {}", output.status)
        } else {
            stderr
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.contains(&login_item_name))
}

#[cfg(target_os = "macos")]
fn enable_autorun_macos() -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let app_path = format!(
        "{}.app",
        exe_path
            .to_string_lossy()
            .split(".app")
            .next()
            .unwrap_or_default()
    );
    let script = format!(
        r#"tell application "System Events" to make login item at end with properties {{path:"{}", hidden:false}}"#,
        app_path.replace('\\', "\\\\").replace('"', "\\\"")
    );
    let status = Command::new("osascript")
        .args(["-e", &script])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("osascript 执行失败: {status}"))
    }
}

#[cfg(target_os = "macos")]
fn disable_autorun_macos() -> Result<(), String> {
    let login_item_name = macos_login_item_name()?;
    let script = format!(
        r#"tell application "System Events" to delete login item "{}""#,
        login_item_name.replace('\\', "\\\\").replace('"', "\\\"")
    );
    let status = Command::new("osascript")
        .args(["-e", &script])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("osascript 执行失败: {status}"))
    }
}

#[cfg(target_os = "linux")]
fn linux_autostart_file_path() -> Result<PathBuf, String> {
    Ok(user_home_dir()?
        .join(".config")
        .join("autostart")
        .join(ROUTEX_DESKTOP_NAME))
}

#[cfg(target_os = "linux")]
fn linux_autostart_desktop_entry() -> Result<String, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(format!(
        "[Desktop Entry]\nName=RouteX\nExec={} %U\nTerminal=false\nType=Application\nIcon=routex\nStartupWMClass=routex\nComment=RouteX\nCategories=Utility;\n",
        exe_path.to_string_lossy()
    ))
}

fn check_auto_run_enabled() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        return Ok(check_autorun_task());
    }

    #[cfg(target_os = "macos")]
    {
        return check_autorun_macos();
    }

    #[cfg(target_os = "linux")]
    {
        return Ok(linux_autostart_file_path()?.exists());
    }

    #[allow(unreachable_code)]
    Ok(false)
}

fn enable_auto_run(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        return create_autorun_task(app);
    }

    #[cfg(target_os = "macos")]
    {
        let _ = app;
        return enable_autorun_macos();
    }

    #[cfg(target_os = "linux")]
    {
        let _ = app;
        let desktop_file_path = linux_autostart_file_path()?;
        if let Some(parent) = desktop_file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(desktop_file_path, linux_autostart_desktop_entry()?)
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("当前平台未实现开机自启".to_string())
}

fn disable_auto_run() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        return delete_autorun_task();
    }

    #[cfg(target_os = "macos")]
    {
        return disable_autorun_macos();
    }

    #[cfg(target_os = "linux")]
    {
        let desktop_file_path = linux_autostart_file_path()?;
        if desktop_file_path.exists() {
            fs::remove_file(desktop_file_path).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("当前平台未实现开机自启".to_string())
}

fn create_elevate_task(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let task_file_path = routex_run_task_xml_path(app)?;
        let routex_run_dest = routex_run_binary_task_path(app)?;
        let routex_run_source = resolve_routex_run_binary(app)?;
        let task_xml = build_routex_run_task_xml(app)?;

        fs::write(&task_file_path, encode_utf16le_with_bom(&task_xml))
            .map_err(|e| e.to_string())?;
        fs::copy(routex_run_source, routex_run_dest).map_err(|e| e.to_string())?;
        schtasks_command(&[
            "/create",
            "/tn",
            ROUTEX_RUN_TASK_NAME,
            "/xml",
            task_file_path
                .to_str()
                .ok_or_else(|| "invalid task xml path".to_string())?,
            "/f",
        ])?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("当前平台未实现任务计划授权".to_string())
    }
}

fn delete_elevate_task() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        match schtasks_command(&["/delete", "/tn", ROUTEX_RUN_TASK_NAME, "/f"]) {
            Ok(()) => Ok(()),
            Err(error) if error.to_ascii_lowercase().contains("cannot find") => Ok(()),
            Err(error) if error.contains("找不到") => Ok(()),
            Err(error) => Err(error),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

fn check_elevate_task() -> bool {
    #[cfg(target_os = "windows")]
    {
        schtasks_command(&["/query", "/tn", ROUTEX_RUN_TASK_NAME]).is_ok()
    }

    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[cfg(not(target_os = "windows"))]
fn has_elevated_permission_flag(permissions: &str) -> bool {
    permissions.contains('s') || permissions.contains('S')
}

#[cfg(not(target_os = "windows"))]
fn parse_ls_permissions(stdout: &str) -> &str {
    stdout.split_whitespace().next().unwrap_or_default()
}

#[cfg(not(target_os = "windows"))]
fn is_user_cancelled_error(message: &str) -> bool {
    message.contains("用户已取消")
        || message.contains("用户取消操作")
        || message.contains("User canceled")
        || message.contains("UserCancelledError")
        || message.contains("(-128)")
        || message.contains("user cancelled")
        || message.contains("dismissed")
}

#[cfg(not(target_os = "windows"))]
fn collect_command_error(output: std::process::Output) -> Result<String, String> {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        return Ok(stdout);
    }

    if is_user_cancelled_error(&stderr) || is_user_cancelled_error(&stdout) {
        return Err("UserCancelledError".to_string());
    }

    if !stderr.is_empty() {
        Err(stderr)
    } else if !stdout.is_empty() {
        Err(stdout)
    } else {
        Err(format!("命令执行失败: {}", output.status))
    }
}

fn check_core_permission_value(app: &tauri::AppHandle) -> Result<Value, String> {
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        return Ok(json!({
            "mihomo": false,
            "mihomo-alpha": false,
        }));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let check_permission = |core_name: &str| -> bool {
            let Ok(core_path) = resolve_core_binary(app, core_name) else {
                return false;
            };
            let Ok(output) = Command::new("ls")
                .args(["-l", &core_path.to_string_lossy()])
                .output()
            else {
                return false;
            };
            if !output.status.success() {
                return false;
            }
            let stdout = String::from_utf8_lossy(&output.stdout);
            has_elevated_permission_flag(parse_ls_permissions(&stdout))
        };

        return Ok(json!({
            "mihomo": check_permission("mihomo"),
            "mihomo-alpha": check_permission("mihomo-alpha"),
        }));
    }
}

fn manual_grant_core_permission(
    app: &tauri::AppHandle,
    cores: Option<Vec<String>>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = cores;
        return create_elevate_task(app);
    }

    #[cfg(target_os = "macos")]
    {
        let target_cores =
            cores.unwrap_or_else(|| vec!["mihomo".to_string(), "mihomo-alpha".to_string()]);
        for core_name in target_cores {
            let core_path = resolve_core_binary(app, &core_name)?;
            let escaped_path = core_path.to_string_lossy().replace('"', "\\\"");
            let shell =
                format!(r#"chown root:admin \"{escaped_path}\" && chmod +sx \"{escaped_path}\""#);
            let command = format!(r#"do shell script "{shell}" with administrator privileges"#);
            let output = Command::new("osascript")
                .args(["-e", &command])
                .output()
                .map_err(|e| e.to_string())?;
            collect_command_error(output)?;
        }
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        let target_cores =
            cores.unwrap_or_else(|| vec!["mihomo".to_string(), "mihomo-alpha".to_string()]);
        for core_name in target_cores {
            let core_path = resolve_core_binary(app, &core_name)?;
            let script = format!(
                r#"chown root:root "{}" && chmod +sx "{}""#,
                core_path.display(),
                core_path.display()
            );
            let output = Command::new("pkexec")
                .args(["bash", "-c", &script])
                .output()
                .map_err(|e| e.to_string())?;
            collect_command_error(output)?;
        }
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("当前平台未实现内核授权".to_string())
}

fn revoke_core_permission(
    _app: &tauri::AppHandle,
    cores: Option<Vec<String>>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = cores;
        return delete_elevate_task();
    }

    #[cfg(target_os = "macos")]
    {
        let target_cores =
            cores.unwrap_or_else(|| vec!["mihomo".to_string(), "mihomo-alpha".to_string()]);
        for core_name in target_cores {
            let core_path = resolve_core_binary(app, &core_name)?;
            let escaped_path = core_path.to_string_lossy().replace('"', "\\\"");
            let shell = format!(r#"chmod a-s \"{escaped_path}\""#);
            let command = format!(r#"do shell script "{shell}" with administrator privileges"#);
            let output = Command::new("osascript")
                .args(["-e", &command])
                .output()
                .map_err(|e| e.to_string())?;
            collect_command_error(output)?;
        }
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        let target_cores =
            cores.unwrap_or_else(|| vec!["mihomo".to_string(), "mihomo-alpha".to_string()]);
        for core_name in target_cores {
            let core_path = resolve_core_binary(app, &core_name)?;
            let script = format!(r#"chmod a-s "{}""#, core_path.display());
            let output = Command::new("pkexec")
                .args(["bash", "-c", &script])
                .output()
                .map_err(|e| e.to_string())?;
            collect_command_error(output)?;
        }
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("当前平台未实现撤销内核授权".to_string())
}

fn read_service_auth_key(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(read_app_config_store(app)?
        .get("serviceAuthKey")
        .and_then(Value::as_str)
        .map(str::to_string))
}

fn parse_service_auth_key(service_auth_key: &str) -> Result<(String, String), String> {
    let Some((public_key, private_key)) = service_auth_key.split_once(':') else {
        return Err("serviceAuthKey 格式无效，无法初始化服务".to_string());
    };
    if public_key.trim().is_empty() || private_key.trim().is_empty() {
        return Err("serviceAuthKey 格式无效，无法初始化服务".to_string());
    }
    Ok((public_key.to_string(), private_key.to_string()))
}

fn service_status_value(app: &tauri::AppHandle) -> Result<Value, String> {
    let output = match run_service_command_capture(
        app,
        &[String::from("service"), String::from("status")],
    ) {
        Ok(output) => output,
        Err(error) => {
            let normalized = error.to_ascii_lowercase();
            if normalized.contains("not installed") || error.contains("未安装") {
                return Ok(json!("not-installed"));
            }
            if normalized.contains("stopped") || normalized.contains("not running") {
                return Ok(json!("stopped"));
            }
            return Ok(json!("unknown"));
        }
    };

    let normalized = output.to_ascii_lowercase();
    if normalized.contains("running") {
        return Ok(json!("running"));
    }
    if normalized.contains("stopped") || normalized.contains("not running") {
        return Ok(json!("stopped"));
    }
    if normalized.contains("not installed") {
        return Ok(json!("not-installed"));
    }
    if read_service_auth_key(app)?.is_none() {
        return Ok(json!("need-init"));
    }
    Ok(json!("unknown"))
}

fn test_service_connection_value(app: &tauri::AppHandle) -> bool {
    if read_service_auth_key(app).ok().flatten().is_none() {
        return false;
    }
    run_service_command_capture(app, &[String::from("status")]).is_ok()
}

fn init_service(app: &tauri::AppHandle, auth_key_input: Option<Value>) -> Result<(), String> {
    let service_auth_key = match auth_key_input {
        Some(Value::Object(payload)) => {
            let public_key = payload
                .get("publicKey")
                .and_then(Value::as_str)
                .ok_or_else(|| "initService requires publicKey".to_string())?;
            let private_key = payload
                .get("privateKey")
                .and_then(Value::as_str)
                .ok_or_else(|| "initService requires privateKey".to_string())?;
            format!("{public_key}:{private_key}")
        }
        Some(Value::Null) | None => read_service_auth_key(app)?.ok_or_else(|| {
            "当前未提供服务密钥，无法初始化服务；请先生成并传入 serviceAuthKey".to_string()
        })?,
        Some(_) => return Err("initService 参数格式无效".to_string()),
    };

    let (public_key, _) = parse_service_auth_key(&service_auth_key)?;
    run_service_command(
        app,
        &[
            String::from("service"),
            String::from("init"),
            String::from("--public-key"),
            public_key,
        ],
    )?;
    patch_app_config_store(app, &json!({ "serviceAuthKey": service_auth_key }))?;
    Ok(())
}

fn install_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("install")])
}

fn uninstall_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("uninstall")])
}

fn start_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("start")])
}

fn restart_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("restart")])
}

fn stop_service(app: &tauri::AppHandle) -> Result<(), String> {
    run_service_command(app, &[String::from("service"), String::from("stop")])
}

fn get_interfaces_value() -> Value {
    #[cfg(target_os = "windows")]
    {
        let script = r#"
$items = Get-NetIPAddress |
  Where-Object {
    $_.InterfaceAlias -and
    $_.IPAddress -ne '127.0.0.1' -and
    $_.IPAddress -ne '::1' -and
    $_.IPAddress -notlike '169.254*' -and
    $_.IPAddress -notlike 'fe80*'
  } |
  Select-Object InterfaceAlias, AddressFamily, IPAddress
$items | ConvertTo-Json -Compress
"#;
        let output = match Command::new("powershell")
            .args(["-NoProfile", "-Command", script])
            .output()
        {
            Ok(output) if output.status.success() => output,
            _ => return json!({}),
        };

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            return json!({});
        }

        let records = match serde_json::from_str::<Value>(&stdout) {
            Ok(Value::Array(items)) => items,
            Ok(Value::Object(item)) => vec![Value::Object(item)],
            _ => return json!({}),
        };

        let mut interfaces = serde_json::Map::new();
        for record in records {
            let name = record
                .get("InterfaceAlias")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim()
                .to_string();
            let address = record
                .get("IPAddress")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim()
                .to_string();
            if name.is_empty() || address.is_empty() {
                continue;
            }

            let family = match record
                .get("AddressFamily")
                .and_then(Value::as_str)
                .unwrap_or_default()
            {
                "IPv6" => "IPv6",
                _ => "IPv4",
            };

            let entry = interfaces
                .entry(name.clone())
                .or_insert_with(|| Value::Array(Vec::new()));
            if let Some(items) = entry.as_array_mut() {
                items.push(json!({
                    "address": address,
                    "family": family,
                    "internal": false,
                    "cidr": Value::Null,
                    "mac": Value::Null,
                    "netmask": Value::Null,
                }));
            }
        }

        return Value::Object(interfaces);
    }

    #[cfg(not(target_os = "windows"))]
    {
        json!({})
    }
}

fn runtime_files_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_root(app)?
        .join(RUNTIME_ASSETS_DIR_NAME)
        .join("files");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn download_binary_file(url: &str, target_path: &Path) -> Result<(), String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
        .send()
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("下载失败: {}", response.status()));
    }

    let bytes = response.bytes().map_err(|e| e.to_string())?;
    ensure_parent(target_path)?;
    fs::write(target_path, bytes).map_err(|e| e.to_string())
}

fn ensure_enable_loopback_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = resolve_resource_binary(app, "files", "enableLoopback.exe") {
        return Ok(path);
    }

    let runtime_path = runtime_files_dir(app)?.join("enableLoopback.exe");
    if runtime_path.exists() {
        return Ok(runtime_path);
    }

    download_binary_file(ENABLE_LOOPBACK_URL, &runtime_path)?;
    Ok(runtime_path)
}

fn open_uwp_tool(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let tool_path = ensure_enable_loopback_path(app)?;
        Command::new(tool_path).spawn().map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("当前平台不支持 UWP 工具".to_string())
    }
}

fn stop_pac_server(state: &State<'_, CoreState>) -> Result<(), String> {
    let handle = state.pac_server.lock().map_err(|e| e.to_string())?.take();
    if let Some(handle) = handle {
        let _ = handle.shutdown.send(());
    }
    Ok(())
}

fn serve_pac_connection(
    stream: &mut std::net::TcpStream,
    script: &str,
) -> Result<(), std::io::Error> {
    let _ = stream.set_read_timeout(Some(Duration::from_millis(300)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(1)));
    let mut buffer = [0_u8; 1024];
    let _ = stream.read(&mut buffer);

    let body = script.as_bytes();
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/x-ns-proxy-autoconfig\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(response.as_bytes())?;
    stream.write_all(body)?;
    stream.flush()?;
    Ok(())
}

fn start_pac_server(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<Option<(String, u16)>, String> {
    stop_pac_server(state)?;

    let sysproxy = read_sysproxy_value(app)?;
    let mode = sysproxy
        .get("mode")
        .and_then(Value::as_str)
        .unwrap_or("manual");
    if mode != "auto" {
        return Ok(None);
    }

    let host = sysproxy
        .get("host")
        .and_then(Value::as_str)
        .unwrap_or("127.0.0.1")
        .to_string();
    let mixed_port = read_mixed_port(app)?;
    let default_script = r#"
function FindProxyForURL(url, host) {
  return "PROXY 127.0.0.1:%mixed-port%; SOCKS5 127.0.0.1:%mixed-port%; DIRECT;";
}
"#;
    let script = sysproxy
        .get("pacScript")
        .and_then(Value::as_str)
        .unwrap_or(default_script)
        .replace("%mixed-port%", &mixed_port.to_string());

    let listener = TcpListener::bind(format!("{host}:0"))
        .map_err(|e| format!("PAC server bind failed: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("PAC server configure failed: {e}"))?;

    let (shutdown_tx, shutdown_rx) = mpsc::channel();
    thread::spawn(move || loop {
        if shutdown_rx.try_recv().is_ok() {
            break;
        }

        match listener.accept() {
            Ok((mut stream, _)) => {
                let _ = serve_pac_connection(&mut stream, &script);
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(100));
            }
            Err(_) => break,
        }
    });

    let mut pac_server = state.pac_server.lock().map_err(|e| e.to_string())?;
    *pac_server = Some(PacServerHandle {
        shutdown: shutdown_tx,
    });
    Ok(Some((host, port)))
}

fn set_sys_proxy(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    only_active_device: bool,
) -> Result<(), String> {
    let sysproxy = read_sysproxy_value(app)?;
    let mode = sysproxy
        .get("mode")
        .and_then(Value::as_str)
        .unwrap_or("manual");
    let host = sysproxy
        .get("host")
        .and_then(Value::as_str)
        .unwrap_or("127.0.0.1");
    match mode {
        "auto" => {
            let (pac_host, pac_port) = start_pac_server(app, state)?
                .ok_or_else(|| "PAC server did not start".to_string())?;
            run_service_command(
                app,
                &service_command_args(
                    only_active_device,
                    "pac",
                    vec![
                        String::from("--url"),
                        format!("http://{pac_host}:{pac_port}/pac"),
                    ],
                ),
            )
        }
        _ => {
            let mixed_port = read_mixed_port(app)?;
            if mixed_port == 0 {
                return Ok(());
            }

            let bypass = {
                let values = json_array_strings(sysproxy.get("bypass"));
                if values.is_empty() {
                    default_sysproxy_bypass()
                } else {
                    values
                }
            };
            let bypass_separator = if cfg!(target_os = "windows") {
                ";"
            } else {
                ","
            };
            run_service_command(
                app,
                &service_command_args(
                    only_active_device,
                    "proxy",
                    vec![
                        String::from("--server"),
                        format!("{host}:{mixed_port}"),
                        String::from("--bypass"),
                        bypass.join(bypass_separator),
                    ],
                ),
            )
        }
    }
}

fn disable_sys_proxy(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    only_active_device: bool,
) -> Result<(), String> {
    stop_pac_server(state)?;
    run_service_command(
        app,
        &service_command_args(only_active_device, "disable", Vec::new()),
    )
}

fn trigger_sys_proxy(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    enable: bool,
    only_active_device: bool,
) -> Result<(), String> {
    let signature = build_sysproxy_signature(app, enable, only_active_device)?;
    {
        let last_signature = state
            .last_sysproxy_signature
            .lock()
            .map_err(|e| e.to_string())?;
        if last_signature.as_deref() == Some(signature.as_str()) {
            return Ok(());
        }
    }

    if enable {
        set_sys_proxy(app, state, only_active_device)?;
    } else {
        disable_sys_proxy(app, state, only_active_device)?;
    }

    let mut last_signature = state
        .last_sysproxy_signature
        .lock()
        .map_err(|e| e.to_string())?;
    *last_signature = Some(signature);
    Ok(())
}

fn is_core_running(state: &State<'_, CoreState>) -> Result<bool, String> {
    let mut runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    let is_running = if let Some(child) = runtime.child.as_mut() {
        child.try_wait().map_err(|e| e.to_string())?.is_none()
    } else {
        false
    };
    if !is_running {
        runtime.child = None;
    }
    Ok(is_running)
}

fn has_network_connectivity() -> bool {
    Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .and_then(|client| client.get(NETWORK_CONNECTIVITY_CHECK_URL).send())
        .map(|response| response.status().is_success() || response.status().as_u16() == 204)
        .unwrap_or(false)
}

fn has_up_network_interface(excluded_keywords: &[String]) -> bool {
    #[cfg(target_os = "windows")]
    {
        let script =
            "Get-NetAdapter | Select-Object -Property Name, Status | ConvertTo-Json -Compress";
        let output = match Command::new("powershell")
            .args(["-NoProfile", "-Command", script])
            .output()
        {
            Ok(output) => output,
            Err(_) => return true,
        };

        if !output.status.success() {
            return true;
        }

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            return false;
        }

        let entries = match serde_json::from_str::<Value>(&stdout) {
            Ok(Value::Array(items)) => items,
            Ok(Value::Object(item)) => vec![Value::Object(item)],
            _ => return true,
        };

        let excluded = excluded_keywords
            .iter()
            .map(|value| value.to_ascii_lowercase())
            .collect::<Vec<_>>();

        return entries.iter().any(|entry| {
            let name = entry
                .get("Name")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let status = entry
                .get("Status")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let name_lower = name.to_ascii_lowercase();
            status.eq_ignore_ascii_case("Up")
                && !excluded
                    .iter()
                    .any(|keyword| !keyword.is_empty() && name_lower.contains(keyword))
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = excluded_keywords;
        true
    }
}

fn stop_network_detection(state: &State<'_, CoreState>) -> Result<(), String> {
    let handle = state
        .network_detection
        .lock()
        .map_err(|e| e.to_string())?
        .take();
    if let Some(handle) = handle {
        let _ = handle.shutdown.send(());
    }
    let mut network_down_handled = state
        .network_down_handled
        .lock()
        .map_err(|e| e.to_string())?;
    *network_down_handled = false;
    Ok(())
}

fn start_network_detection(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    stop_network_detection(state)?;

    let app_config = read_app_config_store(app)?;
    let only_active_device = app_config
        .get("onlyActiveDevice")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let mut excluded = json_array_strings(app_config.get("networkDetectionBypass"));
    let interval_secs = app_config
        .get("networkDetectionInterval")
        .and_then(Value::as_u64)
        .unwrap_or(10)
        .max(1);
    let sysproxy_enabled = app_config
        .get("sysProxy")
        .and_then(Value::as_object)
        .and_then(|value| value.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let tun_device = read_controlled_config_store(app)?
        .get("tun")
        .and_then(Value::as_object)
        .and_then(|value| value.get("device"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            if cfg!(target_os = "macos") {
                None
            } else {
                Some("mihomo".to_string())
            }
        });
    for item in [
        tun_device,
        Some("lo".to_string()),
        Some("docker0".to_string()),
        Some("utun".to_string()),
    ] {
        if let Some(item) = item {
            excluded.push(item);
        }
    }

    let (shutdown_tx, shutdown_rx) = mpsc::channel();
    let app_handle = app.clone();
    thread::spawn(move || loop {
        if shutdown_rx
            .recv_timeout(Duration::from_secs(interval_secs))
            .is_ok()
        {
            break;
        }

        let is_online = has_up_network_interface(&excluded) && has_network_connectivity();
        let state = app_handle.state::<CoreState>();
        let mut network_down_handled = match state.network_down_handled.lock() {
            Ok(value) => value,
            Err(_) => break,
        };

        let core_running = match is_core_running(&state) {
            Ok(value) => value,
            Err(_) => false,
        };

        if is_online {
            if *network_down_handled && !core_running {
                let runtime_config = current_runtime_value(&app_handle, &state).ok();
                match restart_core_process(&app_handle, &state, runtime_config.as_ref()) {
                    Ok(value) => {
                        emit_ipc_event(&app_handle, "core-started", value);
                        emit_ipc_event(&app_handle, "groupsUpdated", Value::Null);
                        emit_ipc_event(&app_handle, "rulesUpdated", Value::Null);
                        if sysproxy_enabled {
                            let _ =
                                trigger_sys_proxy(&app_handle, &state, true, only_active_device);
                        }
                        *network_down_handled = false;
                    }
                    Err(_) => {}
                }
            }
            continue;
        }

        if !*network_down_handled {
            if sysproxy_enabled {
                let _ = trigger_sys_proxy(&app_handle, &state, false, only_active_device);
            }
            let _ = recover_dns(&app_handle);
            let _ = stop_core_process(&state);
            *network_down_handled = true;
        }
    });

    let mut handle = state.network_detection.lock().map_err(|e| e.to_string())?;
    *handle = Some(NetworkDetectionHandle {
        shutdown: shutdown_tx,
    });
    Ok(())
}

fn shutdown_runtime(app: &tauri::AppHandle, state: &State<'_, CoreState>) {
    let only_active_device = read_only_active_device(app).unwrap_or(false);
    let _ = stop_network_detection(state);
    let _ = trigger_sys_proxy(app, state, false, only_active_device);
    let _ = recover_dns(app);
    let _ = stop_core_process(state);
}

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

#[cfg(target_os = "macos")]
fn get_default_device_macos() -> Result<String, String> {
    let output = Command::new("route")
        .args(["-n", "get", "default"])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("Get device failed".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let device = stdout
        .lines()
        .find_map(|line| {
            let trimmed = line.trim();
            trimmed
                .strip_prefix("interface:")
                .map(|value| value.trim().to_string())
        })
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Get device failed".to_string())?;

    Ok(device)
}

#[cfg(target_os = "macos")]
fn get_default_service_macos() -> Result<String, String> {
    let device = get_default_device_macos()?;
    let output = Command::new("networksetup")
        .args(["-listnetworkserviceorder"])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("Get networkservice failed".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let block = stdout
        .split("\n\n")
        .find(|section| section.contains(&format!("Device: {device}")))
        .ok_or_else(|| "Get networkservice failed".to_string())?;

    let service = block
        .lines()
        .find_map(|line| {
            let trimmed = line.trim();
            if !trimmed.starts_with('(') {
                return None;
            }

            trimmed
                .find(')')
                .map(|index| trimmed[index + 1..].trim().to_string())
        })
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Get service failed".to_string())?;

    Ok(service)
}

#[cfg(target_os = "macos")]
fn set_app_config_partial(app: &tauri::AppHandle, patch: &Value) -> Result<(), String> {
    patch_app_config_store(app, patch)?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn get_origin_dns_macos(app: &tauri::AppHandle) -> Result<(), String> {
    let service = get_default_service_macos()?;
    let output = Command::new("networksetup")
        .args(["-getdnsservers", &service])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("Get DNS failed".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.starts_with("There aren't any DNS Servers set on") {
        set_app_config_partial(app, &json!({ "originDNS": "Empty" }))?;
    } else {
        set_app_config_partial(app, &json!({ "originDNS": stdout.replace('\n', " ") }))?;
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn set_dns_macos(_app: &tauri::AppHandle, dns: &str, _mode: &str) -> Result<(), String> {
    let service = get_default_service_macos()?;
    let dns_servers = if dns == "Empty" {
        vec!["Empty".to_string()]
    } else {
        dns.split_whitespace()
            .map(str::to_string)
            .collect::<Vec<_>>()
    };

    let mut command = Command::new("networksetup");
    command.arg("-setdnsservers").arg(&service);
    for dns_server in dns_servers {
        command.arg(dns_server);
    }

    let status = command.status().map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("networksetup 执行失败: {status}"))
    }
}

#[cfg(target_os = "macos")]
fn set_public_dns_macos(app: &tauri::AppHandle) -> Result<(), String> {
    let app_config = read_app_config_store(app)?;
    let auto_set_dns_mode = app_config
        .get("autoSetDNSMode")
        .and_then(Value::as_str)
        .unwrap_or("none");
    if auto_set_dns_mode == "none" {
        return Ok(());
    }

    let origin_dns = app_config.get("originDNS").and_then(Value::as_str);
    if origin_dns.is_none() || origin_dns == Some("") {
        get_origin_dns_macos(app)?;
        set_dns_macos(app, "223.5.5.5", auto_set_dns_mode)?;
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn recover_dns_macos(app: &tauri::AppHandle) -> Result<(), String> {
    let app_config = read_app_config_store(app)?;
    let auto_set_dns_mode = app_config
        .get("autoSetDNSMode")
        .and_then(Value::as_str)
        .unwrap_or("none");
    if auto_set_dns_mode == "none" {
        return Ok(());
    }

    let Some(origin_dns) = app_config.get("originDNS").and_then(Value::as_str) else {
        return Ok(());
    };

    set_dns_macos(app, origin_dns, auto_set_dns_mode)?;
    set_app_config_partial(app, &json!({ "originDNS": Value::Null }))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn set_public_dns(app: &tauri::AppHandle) -> Result<(), String> {
    set_public_dns_macos(app)
}

#[cfg(not(target_os = "macos"))]
fn set_public_dns(_app: &tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn recover_dns(app: &tauri::AppHandle) -> Result<(), String> {
    recover_dns_macos(app)
}

#[cfg(not(target_os = "macos"))]
fn recover_dns(_app: &tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

fn prepare_runtime_work_dir(app: &tauri::AppHandle, work_dir: &Path) -> Result<(), String> {
    for file_name in [
        "country.mmdb",
        "geoip.metadb",
        "geoip.dat",
        "geosite.dat",
        "ASN.mmdb",
    ] {
        let target_path = work_dir.join(file_name);
        let should_copy = if target_path.exists() {
            fs::metadata(&target_path)
                .map(|metadata| metadata.len() == 0)
                .unwrap_or(true)
        } else {
            true
        };

        if !should_copy {
            continue;
        }

        let source_path = resolve_resource_binary(app, "files", file_name)?;
        if target_path.exists() {
            let _ = fs::remove_file(&target_path);
        }
        fs::copy(source_path, target_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn ensure_runtime_dirs(
    app: &tauri::AppHandle,
    current_profile_id: Option<&str>,
    diff_work_dir: bool,
) -> Result<(PathBuf, PathBuf, PathBuf, PathBuf), String> {
    let base = app_data_root(app)?.join(TAURI_CORE_DIR_NAME);
    let profile_base = if diff_work_dir {
        current_profile_id
            .filter(|value| !value.trim().is_empty())
            .map(|id| base.join("profiles").join(id))
            .unwrap_or_else(|| base.clone())
    } else {
        base.clone()
    };

    let work_dir = profile_base.join("work");
    let logs_dir = profile_base.join("logs");
    let test_dir = profile_base.join("test");
    let log_path = logs_dir.join("mihomo.log");

    fs::create_dir_all(&work_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&test_dir).map_err(|e| e.to_string())?;

    Ok((base, work_dir, log_path, test_dir))
}

fn check_runtime_profile(
    binary_path: &Path,
    config_path: &Path,
    test_dir: &Path,
    safe_paths: &[String],
) -> Result<(), String> {
    let mut command = Command::new(binary_path);
    command
        .arg("-t")
        .arg("-f")
        .arg(config_path)
        .arg("-d")
        .arg(test_dir);

    if !safe_paths.is_empty() {
        command.env("SAFE_PATHS", safe_paths.join(path_delimiter()));
    }

    let output = command.output().map_err(|e| e.to_string())?;
    if output.status.success() {
        return Ok(());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let error_lines = stdout
        .lines()
        .filter(|line| line.contains("level=error"))
        .map(|line| {
            line.split("level=error")
                .nth(1)
                .unwrap_or(line)
                .trim()
                .to_string()
        })
        .collect::<Vec<_>>();

    if !error_lines.is_empty() {
        return Err(format!("Profile Check Failed:\n{}", error_lines.join("\n")));
    }

    let fallback = if !stderr.trim().is_empty() {
        stderr.trim().to_string()
    } else if !stdout.trim().is_empty() {
        stdout.trim().to_string()
    } else {
        format!("Mihomo exited with status {}", output.status)
    };

    Err(fallback)
}

fn normalize_runtime_config(input: Option<&Value>, controller_address: &str) -> Value {
    let mut config = input
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();

    config.insert(
        "external-controller".to_string(),
        Value::String(controller_address.to_string()),
    );
    config.remove("external-controller-pipe");
    config.remove("external-controller-unix");
    config
        .entry("allow-lan".to_string())
        .or_insert_with(|| Value::Bool(false));
    config
        .entry("mode".to_string())
        .or_insert_with(|| Value::String("rule".to_string()));
    config
        .entry("log-level".to_string())
        .or_insert_with(|| Value::String("info".to_string()));
    config
        .entry("mixed-port".to_string())
        .or_insert_with(|| Value::Number(7890.into()));
    config
        .entry("ipv6".to_string())
        .or_insert_with(|| Value::Bool(true));
    config
        .entry("proxies".to_string())
        .or_insert_with(|| Value::Array(vec![]));
    config
        .entry("proxy-groups".to_string())
        .or_insert_with(|| Value::Array(vec![]));
    config
        .entry("rules".to_string())
        .or_insert_with(|| Value::Array(vec![Value::String("MATCH,DIRECT".to_string())]));

    Value::Object(config)
}

fn stop_core_process(state: &State<'_, CoreState>) -> Result<(), String> {
    let _ = stop_core_events_monitor(state);
    let mut runtime = state.runtime.lock().map_err(|e| e.to_string())?;

    if let Some(child) = runtime.child.as_mut() {
        if child.try_wait().map_err(|e| e.to_string())?.is_none() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    runtime.child = None;
    runtime.controller_url = None;
    runtime.config_path = None;
    Ok(())
}

fn core_request(
    state: &State<'_, CoreState>,
    method: reqwest::Method,
    path: &str,
    query: Option<&[(&str, String)]>,
    body: Option<Value>,
) -> Result<Value, String> {
    let started_at = Instant::now();
    let method_for_log = method.clone();
    let controller_url = {
        let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
        runtime
            .controller_url
            .clone()
            .ok_or_else(|| "Mihomo controller is not available".to_string())?
    };

    let url = format!("{controller_url}{path}");
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let mut request = client.request(method, &url);

    if let Some(query) = query {
        request = request.query(query);
    }

    if let Some(body) = body {
        request = request.json(&body);
    }

    let response = request.send().map_err(|e| e.to_string())?;
    let status = response.status();
    if status == reqwest::StatusCode::NO_CONTENT {
        return Ok(Value::Null);
    }
    if !status.is_success() {
        return Err(format!("Mihomo API request failed: {status}"));
    }
    let body = response.text().map_err(|e| e.to_string())?;
    if body.trim().is_empty() {
        return Ok(Value::Null);
    }
    let result = serde_json::from_str::<Value>(&body).map_err(|e| e.to_string());
    let elapsed_ms = started_at.elapsed().as_millis();
    if elapsed_ms >= 80 || path == "/rules" || path == "/providers/rules" || path == "/proxies" {
        eprintln!(
            "[desktop.core_request] {} {} {}ms",
            method_for_log, path, elapsed_ms
        );
    }
    result
}

fn wait_for_core_ready(state: &State<'_, CoreState>, runtime_config: &Value) -> Result<(), String> {
    let mut last_error = String::from("Mihomo controller is not available");
    let expected_rule_providers = runtime_config
        .get("rule-providers")
        .and_then(Value::as_object)
        .map(|providers| providers.len())
        .unwrap_or(0);
    let expected_proxy_providers = runtime_config
        .get("proxy-providers")
        .and_then(Value::as_object)
        .map(|providers| providers.len())
        .unwrap_or(0);

    for _ in 0..50 {
        match core_request(state, reqwest::Method::GET, "/rules", None, None) {
            Ok(_) => {
                for _ in 0..50 {
                    let proxy_ready = if expected_proxy_providers == 0 {
                        true
                    } else {
                        core_request(
                            state,
                            reqwest::Method::GET,
                            "/providers/proxies",
                            None,
                            None,
                        )
                        .ok()
                        .and_then(|value| {
                            value
                                .get("providers")
                                .and_then(Value::as_object)
                                .map(|providers| providers.len() >= expected_proxy_providers)
                        })
                        .unwrap_or(false)
                    };

                    let rule_ready = if expected_rule_providers == 0 {
                        true
                    } else {
                        core_request(state, reqwest::Method::GET, "/providers/rules", None, None)
                            .ok()
                            .and_then(|value| {
                                value
                                    .get("providers")
                                    .and_then(Value::as_object)
                                    .map(|providers| providers.len() >= expected_rule_providers)
                            })
                            .unwrap_or(false)
                    };

                    if proxy_ready && rule_ready {
                        return Ok(());
                    }

                    std::thread::sleep(Duration::from_millis(200));
                }

                return Err("Timed out waiting for providers to become ready".to_string());
            }
            Err(error) => {
                last_error = error;
                std::thread::sleep(Duration::from_millis(200));
            }
        }
    }

    Err(format!(
        "Timed out waiting for Mihomo controller to become ready: {last_error}"
    ))
}

fn validate_runtime_start_log(
    log_path: &Path,
    log_start_offset: u64,
    runtime_config: &Value,
) -> Result<(), String> {
    let expected_tun_enabled = runtime_config
        .get("tun")
        .and_then(Value::as_object)
        .and_then(|tun| tun.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);

    let mut file = fs::File::open(log_path).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(log_start_offset))
        .map_err(|e| e.to_string())?;
    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|e| e.to_string())?;

    for line in content.lines() {
        if line.contains("Start Mixed(http+socks) server error")
            || line.contains("Start HTTP server error")
            || line.contains("Start SOCKS server error")
            || line.contains("Start Redir server error")
        {
            return Err("核心启动失败：入站端口仍被其他实例占用".to_string());
        }

        if expected_tun_enabled && line.contains("Start TUN listening error") {
            if line.contains("Access is denied") {
                return Err("TUN 启动失败：当前实例没有获得虚拟网卡所需权限".to_string());
            }
            if line.contains("Cannot create a file when that file already exists") {
                return Err("TUN 启动失败：旧的 Wintun 设备残留，请先关闭旧实例后重试".to_string());
            }
            return Err("TUN 启动失败：核心未成功接管虚拟网卡".to_string());
        }
    }

    Ok(())
}

fn restart_core_process(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    config: Option<&Value>,
) -> Result<Value, String> {
    let _ = recover_dns(app);
    stop_core_process(state)?;

    let core = read_core_name(app)?;
    let binary_path = resolve_core_binary(app, &core)?;
    let current_profile_id = current_runtime_profile_id(app)?;
    let diff_work_dir = read_diff_work_dir(app)?;
    let safe_paths = read_safe_paths(app)?;
    let (control_dns, control_sniff) = read_control_flags(app)?;
    let (_, work_dir, log_path, test_dir) =
        ensure_runtime_dirs(app, current_profile_id.as_deref(), diff_work_dir)?;
    let controller_address = allocate_controller_address()?;
    let mut merged_runtime_config = current_profile_runtime_config(app)?;
    if let Some(config_patch) = config {
        merge_json(&mut merged_runtime_config, config_patch);
    }
    sanitize_runtime_profile_value(&mut merged_runtime_config, control_dns, control_sniff);
    let runtime_config =
        normalize_runtime_config(Some(&merged_runtime_config), &controller_address);
    let config_path = work_dir.join("config.yaml");
    let config_yaml = serde_yaml::to_string(&runtime_config).map_err(|e| e.to_string())?;
    prepare_runtime_work_dir(app, &work_dir)?;
    fs::write(&config_path, config_yaml).map_err(|e| e.to_string())?;
    check_runtime_profile(&binary_path, &config_path, &test_dir, &safe_paths)?;
    let tun_enabled = runtime_config
        .get("tun")
        .and_then(Value::as_object)
        .and_then(|tun| tun.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let auto_set_dns_mode = read_auto_set_dns_mode(app)?;
    if tun_enabled && auto_set_dns_mode != "none" {
        set_public_dns(app)?;
    }

    let stdout = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| e.to_string())?;
    let stderr = stdout.try_clone().map_err(|e| e.to_string())?;

    let mut command = Command::new(&binary_path);
    command
        .arg("-d")
        .arg(&work_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));

    let log_start_offset = fs::metadata(&log_path).map(|m| m.len()).unwrap_or(0);
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    std::thread::sleep(Duration::from_millis(500));
    if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
        return Err(format!("Mihomo exited early with status: {status}"));
    }

    let pid = child.id();
    let mut runtime = state.runtime.lock().map_err(|e| e.to_string())?;
    runtime.binary_path = Some(binary_path.clone());
    runtime.work_dir = Some(work_dir.clone());
    runtime.log_path = Some(log_path.clone());
    runtime.controller_url = Some(format!("http://{controller_address}"));
    runtime.config_path = Some(config_path.clone());
    runtime.child = Some(child);
    drop(runtime);

    if let Err(error) = wait_for_core_ready(state, &runtime_config) {
        let _ = recover_dns(app);
        let _ = stop_core_process(state);
        return Err(error);
    }

    if let Err(error) = validate_runtime_start_log(&log_path, log_start_offset, &runtime_config) {
        let _ = recover_dns(app);
        let _ = stop_core_process(state);
        return Err(error);
    }

    let _ = start_core_events_monitor(app, state);

    Ok(json!({
        "pid": pid,
        "binaryPath": binary_path.to_string_lossy(),
        "workDir": work_dir.to_string_lossy(),
        "logPath": log_path.to_string_lossy(),
        "controller": controller_address,
    }))
}

#[tauri::command]
async fn desktop_check_update(app: tauri::AppHandle) -> Result<Value, String> {
    let started_at = Instant::now();
    let app_for_task = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || check_update_manifest(&app_for_task))
        .await
        .map_err(|e| e.to_string())
        .and_then(|result| result.map(|value| json!(value)));

    let elapsed_ms = started_at.elapsed().as_millis();
    match &result {
        Ok(_) => eprintln!("[desktop.invoke] checkUpdate {}ms", elapsed_ms),
        Err(error) => eprintln!(
            "[desktop.invoke] checkUpdate failed in {}ms: {}",
            elapsed_ms, error
        ),
    }

    result
}

#[tauri::command]
fn desktop_invoke(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    state: State<'_, CoreState>,
    channel: String,
    args: Vec<Value>,
) -> Result<Value, String> {
    let started_at = Instant::now();
    let result = match channel.as_str() {
        "getVersion" => Ok(json!(app.package_info().version.to_string())),
        "platform" => Ok(json!(platform_name())),
        "checkAutoRun" => Ok(json!(check_auto_run_enabled()?)),
        "enableAutoRun" => {
            enable_auto_run(&app)?;
            Ok(Value::Null)
        }
        "disableAutoRun" => {
            disable_auto_run()?;
            Ok(Value::Null)
        }
        "checkUpdate" => Ok(json!(check_update_manifest(&app)?)),
        "downloadAndInstallUpdate" => {
            let version = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| String::from("缺少更新版本号"))?;
            download_and_install_update(&app, &state, version)?;
            Ok(Value::Null)
        }
        "cancelUpdate" => {
            cancel_update_download(&state)?;
            Ok(Value::Null)
        }
        "getUserAgent" => Ok(json!(format!(
            "RouteX-Tauri/{}",
            app.package_info().version
        ))),
        "getGistUrl" => Ok(json!(get_gist_url_value(&app)?)),
        "getAppConfig" => Ok(read_app_config_store(&app)?),
        "getChainsConfig" => Ok(json!(read_chains_config(&app)?)),
        "getAllChains" => Ok(json!(read_chains_config(&app)?.items)),
        "patchAppConfig" => {
            patch_app_config_store(&app, args.first().unwrap_or(&Value::Null))?;
            sync_shell_surfaces(&app)?;
            emit_ipc_event(&app, "appConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "addChainItem" => {
            let item = serde_json::from_value::<ChainItemInput>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            let chain = add_chain_item_store(&app, item)?;
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(json!(chain))
        }
        "updateChainItem" => {
            let item = serde_json::from_value::<ChainItemData>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            update_chain_item_store(&app, item)?;
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "removeChainItem" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "removeChainItem requires chain id".to_string())?;
            remove_chain_item_store(&app, id)?;
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getControledMihomoConfig" => Ok(read_controlled_config_store(&app)?),
        "patchControledMihomoConfig" => {
            patch_controlled_config_store(&app, args.first().unwrap_or(&Value::Null))?;
            update_tray_icon_for_state(&app)?;
            emit_ipc_event(&app, "controledMihomoConfigUpdated", Value::Null);
            emit_ipc_event(&app, "groupsUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getProfileConfig" => Ok(json!(read_profile_config(&app)?)),
        "setProfileConfig" => {
            let config = serde_json::from_value::<ProfileConfigData>(
                args.first()
                    .cloned()
                    .unwrap_or_else(|| json!({ "items": [] })),
            )
            .map_err(|e| e.to_string())?;
            write_profile_config(&app, &config)?;
            emit_ipc_event(&app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getCurrentProfileItem" => Ok(json!(current_profile_item(&app)?)),
        "getProfileItem" => {
            let id = args.first().and_then(Value::as_str);
            let config = read_profile_config(&app)?;
            Ok(json!(get_profile_item_from_config(&config, id)
                .unwrap_or_else(default_empty_profile_item)))
        }
        "changeCurrentProfile" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "changeCurrentProfile requires profile id".to_string())?;
            change_current_profile_store(&app, id)?;
            emit_ipc_event(&app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "setActiveProfiles" => {
            let ids = args
                .first()
                .and_then(Value::as_array)
                .map(|values| {
                    values
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let current = args.get(1).and_then(Value::as_str);
            set_active_profiles_store(&app, &ids, current)?;
            emit_ipc_event(&app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "addProfileItem" => {
            let item = serde_json::from_value::<ProfileItemInput>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            add_or_replace_profile_item(&app, item)?;
            emit_ipc_event(&app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "updateProfileItem" => {
            let item = serde_json::from_value::<ProfileItemData>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            update_profile_item_store(&app, item)?;
            emit_ipc_event(&app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "removeProfileItem" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "removeProfileItem requires profile id".to_string())?;
            remove_profile_item_store(&app, id)?;
            emit_ipc_event(&app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getProfileStr" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getProfileStr requires profile id".to_string())?;
            Ok(json!(read_profile_text(&app, id)?))
        }
        "setProfileStr" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "setProfileStr requires profile id".to_string())?;
            let content = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "setProfileStr requires content".to_string())?;
            write_profile_text(&app, id, content)?;
            Ok(Value::Null)
        }
        "getRawProfileStr" => {
            let current = current_profile_item(&app)?;
            Ok(json!(read_profile_text(&app, &current.id)?))
        }
        "getCurrentProfileStr" => {
            let current = current_profile_item(&app)?;
            Ok(json!(read_profile_text(&app, &current.id)?))
        }
        "getOverrideConfig" => Ok(json!(read_override_config(&app)?)),
        "setOverrideConfig" => {
            let config = serde_json::from_value::<OverrideConfigData>(
                args.first()
                    .cloned()
                    .unwrap_or_else(|| json!({ "items": [] })),
            )
            .map_err(|e| e.to_string())?;
            write_override_config(&app, &config)?;
            emit_ipc_event(&app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getOverrideItem" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getOverrideItem requires override id".to_string())?;
            let config = read_override_config(&app)?;
            Ok(json!(config.items.into_iter().find(|item| item.id == id)))
        }
        "addOverrideItem" => {
            let item = serde_json::from_value::<OverrideItemInput>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            add_or_replace_override_item(&app, item)?;
            emit_ipc_event(&app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "updateOverrideItem" => {
            let item = serde_json::from_value::<OverrideItemData>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            update_override_item_store(&app, item)?;
            emit_ipc_event(&app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "removeOverrideItem" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "removeOverrideItem requires override id".to_string())?;
            remove_override_item_store(&app, id)?;
            let _ = remove_override_reference_store(&app, id)?;
            restart_core_and_emit(&app, &state)?;
            emit_ipc_event(&app, "overrideConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getOverride" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getOverride requires override id".to_string())?;
            let ext = args.get(1).and_then(Value::as_str).unwrap_or("yaml");
            Ok(json!(read_override_text(&app, id, ext)?))
        }
        "canRollbackOverride" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "canRollbackOverride requires override id".to_string())?;
            let ext = args.get(1).and_then(Value::as_str).unwrap_or("yaml");
            let path = override_rollback_path(&app, id, ext)?;
            Ok(json!(path.exists()))
        }
        "rollbackOverride" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "rollbackOverride requires override id".to_string())?;
            let ext = args.get(1).and_then(Value::as_str).unwrap_or("yaml");
            rollback_override_text(&app, id, ext)?;
            restart_core_and_emit(&app, &state)?;
            emit_ipc_event(&app, "overrideConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "setOverride" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "setOverride requires override id".to_string())?;
            let ext = args.get(1).and_then(Value::as_str).unwrap_or("yaml");
            let content = args
                .get(2)
                .and_then(Value::as_str)
                .ok_or_else(|| "setOverride requires content".to_string())?;
            write_override_text(&app, id, ext, content)?;
            emit_ipc_event(&app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "getOverrideProfileStr" => Ok(json!(current_override_profile_text(&app)?)),
        "getFileStr" => {
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getFileStr requires path".to_string())?;
            Ok(json!(read_runtime_text(&app, &state, path)?))
        }
        "setFileStr" => {
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "setFileStr requires path".to_string())?;
            let content = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "setFileStr requires content".to_string())?;
            write_runtime_text(&app, &state, path, content)?;
            Ok(Value::Null)
        }
        "readTextFile" => {
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "readTextFile requires path".to_string())?;
            Ok(json!(read_runtime_text(&app, &state, path)?))
        }
        "convertMrsRuleset" => {
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "convertMrsRuleset requires path".to_string())?;
            let behavior = args.get(1).and_then(Value::as_str).unwrap_or("domain");
            Ok(json!(convert_mrs_ruleset(&app, &state, path, behavior)?))
        }
        "openFile" => {
            let file_type = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "openFile requires file type".to_string())?;
            let id = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "openFile requires id".to_string())?;
            let ext = args.get(2).and_then(Value::as_str).unwrap_or("yaml");
            let path = if file_type == "profile" {
                profile_file_path(&app, id)?
            } else {
                override_file_path(&app, id, ext)?
            };
            open_path_in_shell(&path)?;
            Ok(Value::Null)
        }
        "resolveThemes" => Ok(json!(resolve_theme_entries(&app)?)),
        "fetchThemes" => {
            fetch_theme_archive(&app)?;
            Ok(Value::Null)
        }
        "readTheme" => {
            let theme = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "readTheme requires theme name".to_string())?;
            Ok(json!(read_theme_text(&app, theme)?))
        }
        "getAppName" => {
            let app_path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getAppName requires app path".to_string())?;
            Ok(json!(get_app_name_value(app_path)))
        }
        "writeTheme" => {
            let theme = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "writeTheme requires theme name".to_string())?;
            let css = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "writeTheme requires css content".to_string())?;
            write_theme_text(&app, theme, css)?;
            Ok(Value::Null)
        }
        "getRuntimeConfig" => Ok(current_runtime_value_for_renderer(&app, &state)?),
        "getRuntimeConfigStr" => {
            let value = current_runtime_value_for_renderer(&app, &state)?;
            Ok(json!(
                serde_yaml::to_string(&value).map_err(|e| e.to_string())?
            ))
        }
        "testConnectivity" => {
            let url = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "testConnectivity requires url".to_string())?;
            let timeout = args.get(1).and_then(Value::as_u64).unwrap_or(5_000);
            Ok(test_connectivity_value(url, timeout))
        }
        "testRuleMatch" => {
            let domain = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "testRuleMatch requires domain".to_string())?;
            test_rule_match_value(&app, &state, domain)
        }
        "alert" => {
            let message =
                args.first()
                    .map(|value| match value {
                        Value::String(text) => text.clone(),
                        other => serde_json::to_string_pretty(other)
                            .unwrap_or_else(|_| other.to_string()),
                    })
                    .unwrap_or_default();
            emit_ipc_event(
                &app,
                "show-dialog-modal",
                json!(["warning", "提示", message]),
            );
            Ok(Value::Null)
        }
        "applyTheme" => Ok(Value::Null),
        "fetchIpInfo" => Ok(fetch_ip_info_current()?),
        "fetchIpInfoQuery" => {
            let query = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "fetchIpInfoQuery requires query".to_string())?;
            Ok(fetch_ip_info_query(query)?)
        }
        "fetchBatchIpInfo" => {
            let queries = serde_json::from_value::<Vec<IpInfoQueryInput>>(
                args.first().cloned().unwrap_or_else(|| json!([])),
            )
            .map_err(|e| e.to_string())?;
            Ok(fetch_batch_ip_info(&queries)?)
        }
        "httpGet" => {
            let url = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "httpGet requires url".to_string())?;
            let timeout = args.get(1).and_then(Value::as_u64).unwrap_or(5_000);
            Ok(http_get_value(url, timeout)?)
        }
        "checkStreamingUnlock" => {
            let service = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "checkStreamingUnlock requires service".to_string())?;
            Ok(check_streaming_unlock(service)?)
        }
        "copyEnv" => {
            let shell_type = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "copyEnv requires shell type".to_string())?;
            let command = build_proxy_env_command(&app, shell_type)?;
            copy_text_to_clipboard(&command)?;
            Ok(Value::Null)
        }
        "createHeapSnapshot" => Ok(json!(create_heap_snapshot(&app, &state)?)),
        "importThemes" => {
            let files = serde_json::from_value::<Vec<String>>(
                args.first().cloned().unwrap_or_else(|| json!([])),
            )
            .map_err(|e| e.to_string())?;
            import_theme_files(&app, &files)?;
            Ok(Value::Null)
        }
        "getFilePath" => {
            let extensions = serde_json::from_value::<Vec<String>>(
                args.first().cloned().unwrap_or_else(|| json!([])),
            )
            .map_err(|e| e.to_string())?;
            let extensions = normalize_dialog_extensions(&extensions);
            Ok(json!(pick_open_file_paths_native(&extensions)?))
        }
        "saveFile" => {
            let content = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "saveFile requires content".to_string())?;
            let default_name = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "saveFile requires default name".to_string())?;
            let ext = args
                .get(2)
                .and_then(Value::as_str)
                .ok_or_else(|| "saveFile requires extension".to_string())?;
            Ok(json!(save_text_file_with_dialog(
                content,
                default_name,
                ext
            )?))
        }
        "resetAppConfig" => {
            stop_core_process(&state)?;
            let root = app_storage_root(&app)?;
            if root.exists() {
                let _ = fs::remove_dir_all(root);
            }
            sync_shell_surfaces(&app)?;
            emit_ipc_event(&app, "appConfigUpdated", Value::Null);
            emit_ipc_event(&app, "controledMihomoConfigUpdated", Value::Null);
            emit_ipc_event(&app, "profileConfigUpdated", Value::Null);
            emit_ipc_event(&app, "overrideConfigUpdated", Value::Null);
            emit_ipc_event(&app, "groupsUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        }
        "manualGrantCorePermition" => {
            let cores = serde_json::from_value::<Option<Vec<String>>>(
                args.first().cloned().unwrap_or(Value::Null),
            )
            .map_err(|e| e.to_string())?;
            manual_grant_core_permission(&app, cores)?;
            Ok(Value::Null)
        }
        "checkCorePermission" => Ok(check_core_permission_value(&app)?),
        "checkElevateTask" => Ok(json!(check_elevate_task())),
        "deleteElevateTask" => {
            delete_elevate_task()?;
            Ok(Value::Null)
        }
        "revokeCorePermission" => {
            let cores = serde_json::from_value::<Option<Vec<String>>>(
                args.first().cloned().unwrap_or(Value::Null),
            )
            .map_err(|e| e.to_string())?;
            revoke_core_permission(&app, cores)?;
            Ok(Value::Null)
        }
        "serviceStatus" => service_status_value(&app),
        "testServiceConnection" => Ok(json!(test_service_connection_value(&app))),
        "initService" => {
            init_service(&app, args.first().cloned())?;
            Ok(Value::Null)
        }
        "installService" => {
            install_service(&app)?;
            Ok(Value::Null)
        }
        "uninstallService" => {
            uninstall_service(&app)?;
            Ok(Value::Null)
        }
        "startService" => {
            start_service(&app)?;
            Ok(Value::Null)
        }
        "restartService" => {
            restart_service(&app)?;
            Ok(Value::Null)
        }
        "stopService" => {
            stop_service(&app)?;
            Ok(Value::Null)
        }
        "findSystemMihomo" => Ok(json!(find_system_mihomo_paths())),
        "getImageDataURL" => {
            let url = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getImageDataURL requires url".to_string())?;
            match fetch_image_data_url(url) {
                Ok(value) => Ok(json!(value)),
                Err(_) => Ok(json!(default_icon_data_url())),
            }
        }
        "getIconDataURL" => {
            let app_path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getIconDataURL requires path".to_string())?;
            Ok(json!(resolve_icon_data_url(app_path)))
        }
        "getIconDataURLs" => {
            let app_paths = serde_json::from_value::<Vec<String>>(
                args.first().cloned().unwrap_or_else(|| json!([])),
            )
            .map_err(|e| e.to_string())?;
            Ok(json!(resolve_icon_data_urls(&app_paths)))
        }
        "getInterfaces" => Ok(get_interfaces_value()),
        "getTrafficStats" => Ok(json!(read_traffic_stats_store(&app)?)),
        "getProviderStats" => Ok(json!(get_provider_stats_value(&app)?)),
        "recordTrafficSample" => {
            let sample = serde_json::from_value::<TrafficSampleInput>(
                args.first().cloned().unwrap_or_else(|| json!({})),
            )
            .map_err(|e| e.to_string())?;
            Ok(json!(record_traffic_sample(&app, sample)?))
        }
        "clearTrafficStats" => {
            clear_traffic_stats_store(&app)?;
            Ok(Value::Null)
        }
        "clearProviderStats" => {
            clear_provider_stats_value(&app)?;
            Ok(Value::Null)
        }
        "getProcessTrafficRanking" => {
            let _ranking_type = args.first().and_then(Value::as_str).unwrap_or("session");
            let sort_by = args.get(1).and_then(Value::as_str).unwrap_or("download");
            get_process_traffic_ranking_value(&state, sort_by)
        }
        "startNetworkHealthMonitor" => {
            start_network_health_monitor(&app, &state)?;
            Ok(Value::Null)
        }
        "stopNetworkHealthMonitor" => {
            stop_network_health_monitor(&state)?;
            Ok(Value::Null)
        }
        "getNetworkHealthStats" => Ok(get_network_health_stats_value(&state)?),
        "getAppUptime" => Ok(json!(get_app_uptime_seconds())),
        "getAppMemory" => Ok(json!(get_app_memory_value())),
        "testDNSLatency" => {
            let domain = args.first().and_then(Value::as_str).unwrap_or("google.com");
            Ok(json!(test_dns_latency(domain)))
        }
        "subStorePort" => Ok(json!(0)),
        "subStoreFrontendPort" => Ok(json!(0)),
        "subStoreSubs" => Ok(json!([])),
        "subStoreCollections" => Ok(json!([])),
        "startSubStoreBackendServer" => Ok(Value::Null),
        "stopSubStoreBackendServer" => Ok(Value::Null),
        "startSubStoreFrontendServer" => Ok(Value::Null),
        "stopSubStoreFrontendServer" => Ok(Value::Null),
        "downloadSubStore" => Ok(Value::Null),
        "webdavBackup" => Ok(json!(webdav_backup(&app)?)),
        "listWebdavBackups" => Ok(json!(list_webdav_backup_names(&read_webdav_config(&app)?)?)),
        "webdavRestore" => {
            let filename = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "webdavRestore requires filename".to_string())?;
            webdav_restore(&app, filename)?;
            Ok(Value::Null)
        }
        "webdavDelete" => {
            let filename = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "webdavDelete requires filename".to_string())?;
            webdav_delete(&app, filename)?;
            Ok(Value::Null)
        }
        "openUWPTool" => {
            open_uwp_tool(&app)?;
            Ok(Value::Null)
        }
        "registerShortcut" => {
            let old_shortcut = args.first().and_then(Value::as_str).unwrap_or_default();
            let new_shortcut = args.get(1).and_then(Value::as_str).unwrap_or_default();
            let action = args
                .get(2)
                .and_then(Value::as_str)
                .ok_or_else(|| "registerShortcut requires action".to_string())?;
            Ok(json!(register_global_shortcut(
                &app,
                old_shortcut,
                new_shortcut,
                action
            )?))
        }
        "quitWithoutCore" => {
            shutdown_runtime(&app, &state);
            app.exit(0);
            Ok(Value::Null)
        }
        "quitApp" => {
            shutdown_runtime(&app, &state);
            app.exit(0);
            Ok(Value::Null)
        }
        "notDialogQuit" => {
            shutdown_runtime(&app, &state);
            app.exit(0);
            Ok(Value::Null)
        }
        "showMainWindow" => {
            show_main_window(&app)?;
            Ok(Value::Null)
        }
        "triggerMainWindow" => {
            trigger_main_window(&app)?;
            Ok(Value::Null)
        }
        "closeMainWindow" => {
            let _ = window.close();
            Ok(Value::Null)
        }
        "windowMin" => {
            let _ = window.minimize();
            Ok(Value::Null)
        }
        "windowMax" => {
            let is_maximized = window.is_maximized().map_err(|e| e.to_string())?;
            if is_maximized {
                let _ = window.unmaximize();
            } else {
                let _ = window.maximize();
            }
            Ok(Value::Null)
        }
        "setAlwaysOnTop" => {
            let always_on_top = args
                .first()
                .and_then(Value::as_bool)
                .ok_or_else(|| "setAlwaysOnTop requires a boolean argument".to_string())?;
            let _ = window.set_always_on_top(always_on_top);
            Ok(Value::Null)
        }
        "isAlwaysOnTop" => Ok(json!(window
            .is_always_on_top()
            .map_err(|e| e.to_string())?)),
        "setTitleBarOverlay" => Ok(Value::Null),
        "setDockVisible" => {
            let visible = args
                .first()
                .and_then(Value::as_bool)
                .ok_or_else(|| "setDockVisible requires visible".to_string())?;
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_dock_visibility(visible);
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = visible;
            }
            Ok(Value::Null)
        }
        "showFloatingWindow" => {
            let window = ensure_floating_window(&app)?;
            let _ = window.show();
            let _ = window.set_focus();
            Ok(Value::Null)
        }
        "closeFloatingWindow" => {
            if let Some(window) = app.get_webview_window(FLOATING_WINDOW_LABEL) {
                let _ = window.close();
            }
            Ok(Value::Null)
        }
        "showTrayIcon" => {
            ensure_tray_icon(&app)?;
            Ok(Value::Null)
        }
        "closeTrayIcon" => {
            hide_traymenu_window(&app);
            if let Some(tray) = app.remove_tray_by_id(TRAY_ICON_ID) {
                let _ = tray.set_visible(false);
            }
            Ok(Value::Null)
        }
        "closeTrayMenuWindow" => {
            hide_traymenu_window(&app);
            Ok(Value::Null)
        }
        "updateFloatingWindow" => {
            emit_ipc_event(&app, "appConfigUpdated", Value::Null);
            emit_ipc_event(&app, "controledMihomoConfigUpdated", Value::Null);
            Ok(Value::Null)
        }
        "updateTrayMenu" => {
            update_tray_icon_for_state(&app)?;
            refresh_native_tray_menu(&app)?;
            emit_ipc_event(&app, "appConfigUpdated", Value::Null);
            emit_ipc_event(&app, "controledMihomoConfigUpdated", Value::Null);
            emit_ipc_event(&app, "groupsUpdated", Value::Null);
            Ok(Value::Null)
        }
        "trayIconUpdate" => {
            let data_url = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "trayIconUpdate requires data url".to_string())?;
            apply_tray_icon_data_url(&app, data_url)?;
            Ok(Value::Null)
        }
        "startMonitor" => {
            update_tray_icon_for_state(&app)?;
            refresh_native_tray_menu(&app)?;
            Ok(Value::Null)
        }
        "setupFirewall" => {
            #[cfg(target_os = "windows")]
            {
                let remove_command = r#"
                $rules = @("mihomo", "mihomo-alpha", "RouteX")
                foreach ($rule in $rules) {
                  if (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue) {
                    Remove-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue
                  }
                }
                "#;
                let create_command = format!(
                    r#"
                    New-NetFirewallRule -DisplayName "mihomo" -Direction Inbound -Action Allow -Program "{}" -Enabled True -Profile Any -ErrorAction SilentlyContinue
                    New-NetFirewallRule -DisplayName "RouteX" -Direction Inbound -Action Allow -Program "{}" -Enabled True -Profile Any -ErrorAction SilentlyContinue
                    "#,
                    resolve_core_binary(&app, "mihomo")?.to_string_lossy(),
                    std::env::current_exe()
                        .map_err(|e| e.to_string())?
                        .to_string_lossy()
                );
                let _ = Command::new("powershell")
                    .args(["-Command", remove_command])
                    .status()
                    .map_err(|e| e.to_string())?;
                let _ = Command::new("powershell")
                    .args(["-Command", &create_command])
                    .status()
                    .map_err(|e| e.to_string())?;
            }
            Ok(Value::Null)
        }
        "startNetworkDetection" => {
            start_network_detection(&app, &state)?;
            Ok(Value::Null)
        }
        "stopNetworkDetection" => {
            stop_network_detection(&state)?;
            Ok(Value::Null)
        }
        "triggerSysProxy" => {
            let enable = args
                .first()
                .and_then(Value::as_bool)
                .ok_or_else(|| "triggerSysProxy requires enable".to_string())?;
            let only_active_device = args.get(1).and_then(Value::as_bool).unwrap_or(false);
            trigger_sys_proxy(&app, &state, enable, only_active_device)?;
            Ok(Value::Null)
        }
        "showContextMenu" => {
            if cfg!(target_os = "macos") {
                let position = window
                    .outer_position()
                    .map(|position| (position.x as f64, position.y as f64))
                    .ok();
                show_traymenu_window(&app, position)?;
            } else {
                let menu = build_native_tray_menu(&app)?;
                window.popup_menu(&menu).map_err(|e| e.to_string())?;
            }
            Ok(Value::Null)
        }
        "openDevTools" => {
            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }
            Ok(Value::Null)
        }
        "ensureMihomoCoreAvailable" => {
            let core = args.first().and_then(Value::as_str).unwrap_or("mihomo");
            let path = resolve_core_binary(&app, core)?;
            Ok(json!(path.to_string_lossy().to_string()))
        }
        "mihomoVersion" => core_request(&state, reqwest::Method::GET, "/version", None, None),
        "mihomoConfig" => core_request(&state, reqwest::Method::GET, "/configs", None, None),
        "mihomoConnections" => {
            core_request(&state, reqwest::Method::GET, "/connections", None, None)
        }
        "mihomoRules" => core_request(&state, reqwest::Method::GET, "/rules", None, None),
        "mihomoProxies" => core_request(&state, reqwest::Method::GET, "/proxies", None, None),
        "mihomoGroups" => {
            let proxies = core_request(&state, reqwest::Method::GET, "/proxies", None, None)?;
            let runtime = current_runtime_value(&app, &state)?;
            Ok(build_mihomo_groups_value(&proxies, &runtime))
        }
        "mihomoProxyProviders" => core_request(
            &state,
            reqwest::Method::GET,
            "/providers/proxies",
            None,
            None,
        ),
        "mihomoRuleProviders" => {
            core_request(&state, reqwest::Method::GET, "/providers/rules", None, None)
        }
        "patchMihomoConfig" => core_request(
            &state,
            reqwest::Method::PATCH,
            "/configs",
            None,
            Some(args.first().cloned().unwrap_or(Value::Null)),
        )
        .map(|_| {
            emit_ipc_event(&app, "groupsUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Value::Null
        }),
        "mihomoChangeProxy" => {
            let group = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoChangeProxy requires group".to_string())?;
            let proxy = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoChangeProxy requires proxy".to_string())?;
            core_request(
                &state,
                reqwest::Method::PUT,
                &format!("/proxies/{}", urlencoding::encode(group)),
                None,
                Some(json!({ "name": proxy })),
            )
            .map(|value| {
                emit_ipc_event(&app, "groupsUpdated", Value::Null);
                value
            })
        }
        "mihomoUnfixedProxy" => {
            let group = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoUnfixedProxy requires group".to_string())?;
            core_request(
                &state,
                reqwest::Method::DELETE,
                &format!("/proxies/{}", urlencoding::encode(group)),
                None,
                None,
            )
            .map(|value| {
                emit_ipc_event(&app, "groupsUpdated", Value::Null);
                value
            })
        }
        "mihomoCloseConnection" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoCloseConnection requires connection id".to_string())?;
            core_request(
                &state,
                reqwest::Method::DELETE,
                &format!("/connections/{}", urlencoding::encode(id)),
                None,
                None,
            )
            .map(|_| Value::Null)
        }
        "mihomoCloseAllConnections" => {
            if let Some(name) = args.first().and_then(Value::as_str) {
                close_connections_by_group(&state, name)?;
                Ok(Value::Null)
            } else {
                core_request(&state, reqwest::Method::DELETE, "/connections", None, None)
                    .map(|_| Value::Null)
            }
        }
        "mihomoProxyDelay" => {
            let proxy = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoProxyDelay requires proxy".to_string())?;
            let (url, timeout) =
                resolve_delay_test_options(&app, args.get(1).and_then(Value::as_str))?;
            core_request(
                &state,
                reqwest::Method::GET,
                &format!("/proxies/{}/delay", urlencoding::encode(proxy)),
                Some(&[("url", url), ("timeout", timeout)]),
                None,
            )
        }
        "mihomoGroupDelay" => {
            let group = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoGroupDelay requires group".to_string())?;
            let (url, timeout) =
                resolve_delay_test_options(&app, args.get(1).and_then(Value::as_str))?;
            core_request(
                &state,
                reqwest::Method::GET,
                &format!("/group/{}/delay", urlencoding::encode(group)),
                Some(&[("url", url), ("timeout", timeout)]),
                None,
            )
        }
        "mihomoDnsQuery" => {
            let name = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoDnsQuery requires name".to_string())?
                .to_string();
            let record_type = args
                .get(1)
                .and_then(Value::as_str)
                .unwrap_or("A")
                .to_string();
            core_request(
                &state,
                reqwest::Method::GET,
                "/dns/query",
                Some(&[("name", name), ("type", record_type)]),
                None,
            )
        }
        "mihomoToggleRuleDisabled" => core_request(
            &state,
            reqwest::Method::PATCH,
            "/rules/disable",
            None,
            Some(args.first().cloned().unwrap_or_else(|| json!({}))),
        )
        .map(|_| {
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Value::Null
        }),
        "mihomoUpdateProxyProviders" => {
            let name = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoUpdateProxyProviders requires name".to_string())?;
            core_request(
                &state,
                reqwest::Method::PUT,
                &format!("/providers/proxies/{}", urlencoding::encode(name)),
                None,
                None,
            )
            .map(|_| {
                emit_ipc_event(&app, "groupsUpdated", Value::Null);
                Value::Null
            })
        }
        "mihomoUpdateRuleProviders" => {
            let name = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoUpdateRuleProviders requires name".to_string())?;
            core_request(
                &state,
                reqwest::Method::PUT,
                &format!("/providers/rules/{}", urlencoding::encode(name)),
                None,
                None,
            )
            .map(|_| {
                emit_ipc_event(&app, "rulesUpdated", Value::Null);
                Value::Null
            })
        }
        "mihomoUpgrade" => {
            core_request(&state, reqwest::Method::POST, "/upgrade", None, None).map(|_| Value::Null)
        }
        "mihomoUpgradeGeo" => {
            core_request(&state, reqwest::Method::POST, "/upgrade/geo", None, None)
                .map(|_| Value::Null)
        }
        "mihomoUpgradeUI" => core_request(&state, reqwest::Method::POST, "/upgrade/ui", None, None)
            .map(|_| Value::Null),
        "checkMihomoLatestVersion" => {
            let is_alpha = args.first().and_then(Value::as_bool).unwrap_or(false);
            let url = if is_alpha {
                "https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt"
            } else {
                "https://github.com/MetaCubeX/mihomo/releases/latest/download/version.txt"
            };
            match fetch_text(url, 10) {
                Ok(text) => Ok(json!(text.trim())),
                Err(_) => Ok(Value::Null),
            }
        }
        "restartMihomoConnections" => {
            if current_controller_url(&state)?.is_some() {
                start_core_events_monitor(&app, &state)?;
            } else {
                stop_core_events_monitor(&state)?;
            }
            Ok(Value::Null)
        }
        "restartCore" => restart_core_process(&app, &state, args.first()).map(|value| {
            emit_ipc_event(&app, "core-started", value.clone());
            emit_ipc_event(&app, "groupsUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            value
        }),
        "setNativeTheme" => {
            let theme = args.first().and_then(Value::as_str);
            apply_window_theme(&window, theme);
            Ok(Value::Null)
        }
        "relaunchApp" => {
            relaunch_current_app(&app, &state)?;
            Ok(Value::Null)
        }
        unsupported => Err(format!("Unsupported Tauri desktop channel: {unsupported}")),
    };

    let elapsed_ms = started_at.elapsed().as_millis();
    if elapsed_ms >= 80
        || channel == "getRuntimeConfig"
        || channel == "getRuntimeConfigStr"
        || channel == "mihomoRules"
        || channel == "mihomoRuleProviders"
        || channel == "mihomoProxyProviders"
    {
        match &result {
            Ok(_) => eprintln!("[desktop.invoke] {} {}ms", channel, elapsed_ms),
            Err(error) => eprintln!(
                "[desktop.invoke] {} failed in {}ms: {}",
                channel, elapsed_ms, error
            ),
        }
    }

    result
}

fn main() {
    let _ = APP_STARTED_AT.get_or_init(Instant::now);
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(CoreState::default())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let _ = initialize_traffic_stats_store(&app_handle);
            let _ = init_global_shortcuts(&app_handle);
            let _ = run_startup_alignment(&app_handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![desktop_invoke, desktop_check_update])
        .run(tauri::generate_context!())
        .expect("error while running RouteX Tauri shell");
}
