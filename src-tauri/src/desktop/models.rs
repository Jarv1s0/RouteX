use super::prelude::*;
use super::*;

#[derive(Debug, Clone)]
pub(crate) struct CachedRuntimeConfig {
    pub(crate) path: PathBuf,
    pub(crate) modified_at_ms: Option<u64>,
    pub(crate) value: Value,
}

#[derive(Default)]
pub(crate) struct CoreRuntime {
    pub(crate) child: Option<Child>,
    pub(crate) service_managed: bool,
    pub(crate) binary_path: Option<PathBuf>,
    pub(crate) work_dir: Option<PathBuf>,
    pub(crate) log_path: Option<PathBuf>,
    pub(crate) controller_url: Option<String>,
    pub(crate) config_path: Option<PathBuf>,
    pub(crate) cached_runtime_config: Option<CachedRuntimeConfig>,
}

pub(crate) struct PacServerHandle {
    pub(crate) shutdown: mpsc::Sender<()>,
}

pub(crate) struct NetworkDetectionHandle {
    pub(crate) shutdown: mpsc::Sender<()>,
}

pub(crate) struct NetworkHealthMonitorHandle {
    pub(crate) shutdown: mpsc::Sender<()>,
}

pub(crate) struct CoreEventsMonitorHandle {
    pub(crate) shutdown: mpsc::Sender<()>,
}

pub(crate) struct LightweightModeHandle {
    pub(crate) shutdown: mpsc::Sender<()>,
}

pub(crate) struct SsidCheckHandle {
    pub(crate) shutdown: mpsc::Sender<()>,
}

pub(crate) struct ProfileUpdaterHandle {
    pub(crate) shutdown: mpsc::Sender<()>,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct NetworkHealthState {
    pub(crate) latency_history: Vec<i64>,
    pub(crate) dns_latency_history: Vec<i64>,
    pub(crate) test_count: u64,
    pub(crate) fail_count: u64,
}

#[derive(Default)]
pub(crate) struct CoreState {
    pub(crate) runtime: Mutex<CoreRuntime>,
    pub(crate) restart_lock: Mutex<()>,
    pub(crate) last_sysproxy_signature: Mutex<Option<String>>,
    pub(crate) pac_server: Mutex<Option<PacServerHandle>>,
    pub(crate) lightweight_mode: Mutex<Option<LightweightModeHandle>>,
    pub(crate) network_detection: Mutex<Option<NetworkDetectionHandle>>,
    pub(crate) ssid_check: Mutex<Option<SsidCheckHandle>>,
    pub(crate) core_events_monitor: Mutex<Option<CoreEventsMonitorHandle>>,
    pub(crate) network_health_monitor: Mutex<Option<NetworkHealthMonitorHandle>>,
    pub(crate) profile_updater: Mutex<Option<ProfileUpdaterHandle>>,
    pub(crate) network_health_state: Mutex<NetworkHealthState>,
    pub(crate) network_down_handled: Mutex<bool>,
    pub(crate) update_download_cancel: Mutex<Option<Arc<AtomicBool>>>,
    pub(crate) quit_confirm_sender: Mutex<Option<mpsc::Sender<bool>>>,
    pub(crate) allow_main_window_close: Mutex<bool>,
    pub(crate) shutdown_started: AtomicBool,
    pub(crate) preserve_core_on_exit: AtomicBool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(crate) struct ProfileConfigData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) current: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) actives: Option<Vec<String>>,
    #[serde(default)]
    pub(crate) items: Vec<ProfileItemData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct ProfileItemData {
    pub(crate) id: String,
    #[serde(rename = "type")]
    pub(crate) item_type: String,
    pub(crate) name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) fingerprint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) ua: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) verify: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) interval: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) home: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) updated: Option<u64>,
    #[serde(rename = "override", skip_serializing_if = "Option::is_none")]
    pub(crate) override_ids: Option<Vec<String>>,
    #[serde(rename = "useProxy", skip_serializing_if = "Option::is_none")]
    pub(crate) use_proxy: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) extra: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) locked: Option<bool>,
    #[serde(rename = "autoUpdate", skip_serializing_if = "Option::is_none")]
    pub(crate) auto_update: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct ProfileItemInput {
    pub(crate) id: Option<String>,
    #[serde(rename = "type")]
    pub(crate) item_type: Option<String>,
    pub(crate) name: Option<String>,
    pub(crate) url: Option<String>,
    pub(crate) fingerprint: Option<String>,
    pub(crate) ua: Option<String>,
    pub(crate) file: Option<String>,
    pub(crate) verify: Option<bool>,
    pub(crate) interval: Option<u64>,
    pub(crate) home: Option<String>,
    pub(crate) updated: Option<u64>,
    #[serde(rename = "override")]
    pub(crate) override_ids: Option<Vec<String>>,
    #[serde(rename = "useProxy")]
    pub(crate) use_proxy: Option<bool>,
    pub(crate) extra: Option<Value>,
    pub(crate) locked: Option<bool>,
    #[serde(rename = "autoUpdate")]
    pub(crate) auto_update: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(crate) struct OverrideConfigData {
    #[serde(default)]
    pub(crate) items: Vec<OverrideItemData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct OverrideItemData {
    pub(crate) id: String,
    #[serde(rename = "type")]
    pub(crate) item_type: String,
    pub(crate) ext: String,
    pub(crate) name: String,
    pub(crate) updated: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) global: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) fingerprint: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct OverrideItemInput {
    pub(crate) id: Option<String>,
    #[serde(rename = "type")]
    pub(crate) item_type: Option<String>,
    pub(crate) ext: Option<String>,
    pub(crate) name: Option<String>,
    pub(crate) global: Option<bool>,
    pub(crate) url: Option<String>,
    pub(crate) file: Option<String>,
    pub(crate) fingerprint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct QuickRulesConfigData {
    pub(crate) version: u8,
    #[serde(rename = "migratedProfileQuickRulesToGlobal", default)]
    pub(crate) migrated_profile_quick_rules_to_global: bool,
    #[serde(default)]
    pub(crate) profiles: HashMap<String, QuickRuleProfileConfig>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(crate) struct QuickRuleProfileConfig {
    #[serde(default = "default_true")]
    pub(crate) enabled: bool,
    #[serde(default)]
    pub(crate) rules: Vec<QuickRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct QuickRule {
    pub(crate) id: String,
    #[serde(rename = "type")]
    pub(crate) rule_type: String,
    pub(crate) value: String,
    pub(crate) target: String,
    #[serde(rename = "noResolve", skip_serializing_if = "Option::is_none")]
    pub(crate) no_resolve: Option<bool>,
    pub(crate) enabled: bool,
    pub(crate) source: String,
    #[serde(rename = "createdAt")]
    pub(crate) created_at: u64,
    #[serde(rename = "updatedAt")]
    pub(crate) updated_at: u64,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct QuickRuleInput {
    pub(crate) id: Option<String>,
    #[serde(rename = "type")]
    pub(crate) rule_type: Option<String>,
    pub(crate) value: Option<String>,
    pub(crate) target: Option<String>,
    #[serde(rename = "noResolve")]
    pub(crate) no_resolve: Option<bool>,
    pub(crate) enabled: Option<bool>,
    pub(crate) source: Option<String>,
}

pub(crate) fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Default)]
pub(crate) struct WebdavConfig {
    pub(crate) url: String,
    pub(crate) username: String,
    pub(crate) password: String,
    pub(crate) dir: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct IpInfoQueryInput {
    pub(crate) query: String,
    pub(crate) lang: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct GitHubReleaseAsset {
    pub(crate) name: String,
    pub(crate) browser_download_url: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct GitHubReleaseResponse {
    pub(crate) tag_name: Option<String>,
    pub(crate) assets: Option<Vec<GitHubReleaseAsset>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct GistInfo {
    pub(crate) html_url: String,
    pub(crate) description: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(crate) struct TrafficHourlyStats {
    pub(crate) hour: String,
    pub(crate) upload: u64,
    pub(crate) download: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(crate) struct TrafficDailyStats {
    pub(crate) date: String,
    pub(crate) upload: u64,
    pub(crate) download: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct TrafficStatsStore {
    #[serde(default)]
    pub(crate) hourly: Vec<TrafficHourlyStats>,
    #[serde(default)]
    pub(crate) daily: Vec<TrafficDailyStats>,
    #[serde(rename = "lastUpdate")]
    pub(crate) last_update: u64,
    #[serde(rename = "sessionUpload")]
    pub(crate) session_upload: u64,
    #[serde(rename = "sessionDownload")]
    pub(crate) session_download: u64,
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
pub(crate) struct TrafficSampleInput {
    pub(crate) up: Option<u64>,
    pub(crate) down: Option<u64>,
    pub(crate) hour: Option<String>,
    pub(crate) date: Option<String>,
    pub(crate) timestamp: Option<u64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(crate) struct ChainsConfigData {
    #[serde(default)]
    pub(crate) items: Vec<ChainItemData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct ChainItemData {
    pub(crate) id: String,
    pub(crate) name: String,
    #[serde(rename = "dialerProxy")]
    pub(crate) dialer_proxy: String,
    #[serde(rename = "targetProxy")]
    pub(crate) target_proxy: String,
    #[serde(rename = "targetGroups", default)]
    pub(crate) target_groups: Vec<String>,
    pub(crate) enabled: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct ChainItemInput {
    pub(crate) id: Option<String>,
    pub(crate) name: Option<String>,
    #[serde(rename = "dialerProxy")]
    pub(crate) dialer_proxy: Option<String>,
    #[serde(rename = "targetProxy")]
    pub(crate) target_proxy: Option<String>,
    #[serde(rename = "targetGroups")]
    pub(crate) target_groups: Option<Vec<String>>,
    pub(crate) enabled: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(crate) struct FloatingWindowState {
    pub(crate) x: i32,
    pub(crate) y: i32,
}
