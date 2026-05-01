use super::*;

#[derive(Debug, Clone)]
pub(super) struct CachedRuntimeConfig {
    pub(super) path: PathBuf,
    pub(super) modified_at_ms: Option<u64>,
    pub(super) value: Value,
}

#[derive(Default)]
pub(super) struct CoreRuntime {
    pub(super) child: Option<Child>,
    pub(super) service_managed: bool,
    pub(super) binary_path: Option<PathBuf>,
    pub(super) work_dir: Option<PathBuf>,
    pub(super) log_path: Option<PathBuf>,
    pub(super) controller_url: Option<String>,
    pub(super) config_path: Option<PathBuf>,
    pub(super) cached_runtime_config: Option<CachedRuntimeConfig>,
}

pub(super) struct PacServerHandle {
    pub(super) shutdown: mpsc::Sender<()>,
}

pub(super) struct NetworkDetectionHandle {
    pub(super) shutdown: mpsc::Sender<()>,
}

pub(super) struct NetworkHealthMonitorHandle {
    pub(super) shutdown: mpsc::Sender<()>,
}

pub(super) struct CoreEventsMonitorHandle {
    pub(super) shutdown: mpsc::Sender<()>,
}

pub(super) struct LightweightModeHandle {
    pub(super) shutdown: mpsc::Sender<()>,
}

pub(super) struct SsidCheckHandle {
    pub(super) shutdown: mpsc::Sender<()>,
}

#[derive(Debug, Clone, Default)]
pub(super) struct NetworkHealthState {
    pub(super) latency_history: Vec<i64>,
    pub(super) dns_latency_history: Vec<i64>,
    pub(super) test_count: u64,
    pub(super) fail_count: u64,
}

#[derive(Default)]
pub(super) struct CoreState {
    pub(super) runtime: Mutex<CoreRuntime>,
    pub(super) restart_lock: Mutex<()>,
    pub(super) last_sysproxy_signature: Mutex<Option<String>>,
    pub(super) pac_server: Mutex<Option<PacServerHandle>>,
    pub(super) lightweight_mode: Mutex<Option<LightweightModeHandle>>,
    pub(super) network_detection: Mutex<Option<NetworkDetectionHandle>>,
    pub(super) ssid_check: Mutex<Option<SsidCheckHandle>>,
    pub(super) core_events_monitor: Mutex<Option<CoreEventsMonitorHandle>>,
    pub(super) network_health_monitor: Mutex<Option<NetworkHealthMonitorHandle>>,
    pub(super) network_health_state: Mutex<NetworkHealthState>,
    pub(super) network_down_handled: Mutex<bool>,
    pub(super) update_download_cancel: Mutex<Option<Arc<AtomicBool>>>,
    pub(super) quit_confirm_sender: Mutex<Option<mpsc::Sender<bool>>>,
    pub(super) allow_main_window_close: Mutex<bool>,
    pub(super) shutdown_started: AtomicBool,
    pub(super) preserve_core_on_exit: AtomicBool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(super) struct ProfileConfigData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) current: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) actives: Option<Vec<String>>,
    #[serde(default)]
    pub(super) items: Vec<ProfileItemData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(super) struct ProfileItemData {
    pub(super) id: String,
    #[serde(rename = "type")]
    pub(super) item_type: String,
    pub(super) name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) fingerprint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) ua: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) verify: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) interval: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) home: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) updated: Option<u64>,
    #[serde(rename = "override", skip_serializing_if = "Option::is_none")]
    pub(super) override_ids: Option<Vec<String>>,
    #[serde(rename = "useProxy", skip_serializing_if = "Option::is_none")]
    pub(super) use_proxy: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) extra: Option<Value>,
    #[serde(rename = "resetDay", skip_serializing_if = "Option::is_none")]
    pub(super) reset_day: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) locked: Option<bool>,
    #[serde(rename = "autoUpdate", skip_serializing_if = "Option::is_none")]
    pub(super) auto_update: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(super) struct ProfileItemInput {
    pub(super) id: Option<String>,
    #[serde(rename = "type")]
    pub(super) item_type: Option<String>,
    pub(super) name: Option<String>,
    pub(super) url: Option<String>,
    pub(super) fingerprint: Option<String>,
    pub(super) ua: Option<String>,
    pub(super) file: Option<String>,
    pub(super) verify: Option<bool>,
    pub(super) interval: Option<u64>,
    pub(super) home: Option<String>,
    pub(super) updated: Option<u64>,
    #[serde(rename = "override")]
    pub(super) override_ids: Option<Vec<String>>,
    #[serde(rename = "useProxy")]
    pub(super) use_proxy: Option<bool>,
    pub(super) extra: Option<Value>,
    #[serde(rename = "resetDay")]
    pub(super) reset_day: Option<u64>,
    pub(super) locked: Option<bool>,
    #[serde(rename = "autoUpdate")]
    pub(super) auto_update: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(super) struct OverrideConfigData {
    #[serde(default)]
    pub(super) items: Vec<OverrideItemData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(super) struct OverrideItemData {
    pub(super) id: String,
    #[serde(rename = "type")]
    pub(super) item_type: String,
    pub(super) ext: String,
    pub(super) name: String,
    pub(super) updated: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) global: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) fingerprint: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(super) struct OverrideItemInput {
    pub(super) id: Option<String>,
    #[serde(rename = "type")]
    pub(super) item_type: Option<String>,
    pub(super) ext: Option<String>,
    pub(super) name: Option<String>,
    pub(super) global: Option<bool>,
    pub(super) url: Option<String>,
    pub(super) file: Option<String>,
    pub(super) fingerprint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(super) struct QuickRulesConfigData {
    pub(super) version: u8,
    #[serde(rename = "migratedLegacyQuickRules", default)]
    pub(super) migrated_legacy_quick_rules: bool,
    #[serde(default)]
    pub(super) profiles: HashMap<String, QuickRuleProfileConfig>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(super) struct QuickRuleProfileConfig {
    #[serde(default = "default_true")]
    pub(super) enabled: bool,
    #[serde(default)]
    pub(super) rules: Vec<QuickRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(super) struct QuickRule {
    pub(super) id: String,
    #[serde(rename = "type")]
    pub(super) rule_type: String,
    pub(super) value: String,
    pub(super) target: String,
    #[serde(rename = "noResolve", skip_serializing_if = "Option::is_none")]
    pub(super) no_resolve: Option<bool>,
    pub(super) enabled: bool,
    pub(super) source: String,
    #[serde(rename = "createdAt")]
    pub(super) created_at: u64,
    #[serde(rename = "updatedAt")]
    pub(super) updated_at: u64,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(super) struct QuickRuleInput {
    pub(super) id: Option<String>,
    #[serde(rename = "type")]
    pub(super) rule_type: Option<String>,
    pub(super) value: Option<String>,
    pub(super) target: Option<String>,
    #[serde(rename = "noResolve")]
    pub(super) no_resolve: Option<bool>,
    pub(super) enabled: Option<bool>,
    pub(super) source: Option<String>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Default)]
pub(super) struct WebdavConfig {
    pub(super) url: String,
    pub(super) username: String,
    pub(super) password: String,
    pub(super) dir: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(super) struct IpInfoQueryInput {
    pub(super) query: String,
    pub(super) lang: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(super) struct GitHubReleaseAsset {
    pub(super) name: String,
    pub(super) browser_download_url: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(super) struct GitHubReleaseResponse {
    pub(super) assets: Option<Vec<GitHubReleaseAsset>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(super) struct GistInfo {
    pub(super) html_url: String,
    pub(super) description: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(super) struct ProviderSnapshotData {
    pub(super) date: String,
    pub(super) provider: String,
    pub(super) used: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(super) struct ProviderStatsData {
    #[serde(default)]
    pub(super) snapshots: Vec<ProviderSnapshotData>,
    #[serde(rename = "lastUpdate")]
    pub(super) last_update: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(super) struct TrafficHourlyStats {
    pub(super) hour: String,
    pub(super) upload: u64,
    pub(super) download: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(super) struct TrafficDailyStats {
    pub(super) date: String,
    pub(super) upload: u64,
    pub(super) download: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(super) struct TrafficStatsStore {
    #[serde(default)]
    pub(super) hourly: Vec<TrafficHourlyStats>,
    #[serde(default)]
    pub(super) daily: Vec<TrafficDailyStats>,
    #[serde(rename = "lastUpdate")]
    pub(super) last_update: u64,
    #[serde(rename = "sessionUpload")]
    pub(super) session_upload: u64,
    #[serde(rename = "sessionDownload")]
    pub(super) session_download: u64,
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
pub(super) struct TrafficSampleInput {
    pub(super) up: Option<u64>,
    pub(super) down: Option<u64>,
    pub(super) hour: Option<String>,
    pub(super) date: Option<String>,
    pub(super) timestamp: Option<u64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(super) struct ChainsConfigData {
    #[serde(default)]
    pub(super) items: Vec<ChainItemData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(super) struct ChainItemData {
    pub(super) id: String,
    pub(super) name: String,
    #[serde(rename = "dialerProxy")]
    pub(super) dialer_proxy: String,
    #[serde(rename = "targetProxy")]
    pub(super) target_proxy: String,
    #[serde(rename = "targetGroups", default)]
    pub(super) target_groups: Vec<String>,
    pub(super) enabled: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(super) struct ChainItemInput {
    pub(super) id: Option<String>,
    pub(super) name: Option<String>,
    #[serde(rename = "dialerProxy")]
    pub(super) dialer_proxy: Option<String>,
    #[serde(rename = "targetProxy")]
    pub(super) target_proxy: Option<String>,
    #[serde(rename = "targetGroups")]
    pub(super) target_groups: Option<Vec<String>>,
    pub(super) enabled: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(super) struct FloatingWindowState {
    pub(super) x: i32,
    pub(super) y: i32,
}
