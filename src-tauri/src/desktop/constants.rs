use super::prelude::*;
use super::*;

pub(crate) const APP_CONFIG_DIR_NAME: &str = "config";
pub(crate) const APP_CONFIG_FILE: &str = "app-config.json";
pub(crate) const CHAINS_CONFIG_FILE: &str = "chains-config.json";
pub(crate) const CONTROLLED_CONFIG_FILE: &str = "controlled-mihomo-config.json";
pub(crate) const PROFILE_CONFIG_FILE: &str = "profile-config.json";
pub(crate) const OVERRIDE_CONFIG_FILE: &str = "override-config.json";
pub(crate) const QUICK_RULES_CONFIG_FILE: &str = "quick-rules-config.json";
pub(crate) const GLOBAL_QUICK_RULES_PROFILE_ID: &str = "__global__";
pub(crate) const TRAFFIC_STATS_FILE: &str = "traffic-stats.json";
pub(crate) const PROFILE_DIR_NAME: &str = "profiles";
pub(crate) const OVERRIDE_DIR_NAME: &str = "overrides";
pub(crate) const THEME_DIR_NAME: &str = "themes";
pub(crate) const DEFAULT_THEME_FILE_NAME: &str = "default.css";
pub(crate) const RUNTIME_DIR_NAME: &str = "runtime-files";
pub(crate) const APP_RUNTIME_DIR_NAME: &str = "runtime";
pub(crate) const APP_CORE_DIR_NAME: &str = "core";
pub(crate) const APP_RUNTIME_LOGS_DIR_NAME: &str = "logs";
pub(crate) const APP_RUNTIME_TASKS_DIR_NAME: &str = "tasks";
pub(crate) const APP_RUNTIME_TOOLS_DIR_NAME: &str = "tools";
pub(crate) const TRAFFIC_MONITOR_REPO: &str = "zhongyang219/TrafficMonitor";
pub(crate) const TRAFFIC_MONITOR_PID_FILE: &str = "traffic-monitor.pid";
#[cfg(target_os = "windows")]
pub(crate) const WINDOWS_APP_DATA_DIR_NAME: &str = "routex.app";
#[cfg(target_os = "windows")]
pub(crate) const CREATE_NO_WINDOW: u32 = 0x08000000;
pub(crate) const DEFAULT_PROFILE_TEXT: &str = "proxies: []\nproxy-groups: []\nrules: []\n";
pub(crate) const FLOATING_WINDOW_LABEL: &str = "floating";
pub(crate) const FLOATING_WINDOW_STATE_FILE: &str = "floating-window-state.json";
pub(crate) const TRAYMENU_WINDOW_LABEL: &str = "traymenu";
pub(crate) const TRAYMENU_WINDOW_WIDTH: f64 = 392.0;
pub(crate) const TRAYMENU_WINDOW_HEIGHT: f64 = 548.0;
pub(crate) const TRAYMENU_WINDOW_GAP: f64 = 10.0;
pub(crate) const TRAY_ICON_ID: &str = "main";
pub(crate) const TRAY_MENU_SHOW_WINDOW_ID: &str = "tray.show-window";
pub(crate) const TRAY_MENU_TOGGLE_FLOATING_ID: &str = "tray.toggle-floating";
pub(crate) const TRAY_MENU_TOGGLE_SYS_PROXY_ID: &str = "tray.toggle-sysproxy";
pub(crate) const TRAY_MENU_TOGGLE_TUN_ID: &str = "tray.toggle-tun";
pub(crate) const TRAY_MENU_MODE_RULE_ID: &str = "tray.mode.rule";
pub(crate) const TRAY_MENU_MODE_GLOBAL_ID: &str = "tray.mode.global";
pub(crate) const TRAY_MENU_MODE_DIRECT_ID: &str = "tray.mode.direct";
pub(crate) const TRAY_MENU_PROFILE_EMPTY_ID: &str = "tray.profile.empty";
pub(crate) const TRAY_MENU_PROFILE_CURRENT_EMPTY_ID: &str = "tray.profile.current.empty";
pub(crate) const TRAY_MENU_OPEN_APP_DIR_ID: &str = "tray.open-dir.app";
pub(crate) const TRAY_MENU_OPEN_WORK_DIR_ID: &str = "tray.open-dir.work";
pub(crate) const TRAY_MENU_OPEN_CORE_DIR_ID: &str = "tray.open-dir.core";
pub(crate) const TRAY_MENU_OPEN_LOG_DIR_ID: &str = "tray.open-dir.log";
pub(crate) const TRAY_MENU_QUIT_WITHOUT_CORE_ID: &str = "tray.quit-without-core";
pub(crate) const TRAY_MENU_RESTART_APP_ID: &str = "tray.restart-app";
pub(crate) const TRAY_MENU_QUIT_ID: &str = "tray.quit";
pub(crate) const TRAY_MENU_GROUP_TEST_PREFIX: &str = "tray.group.test::";
pub(crate) const TRAY_MENU_GROUP_PROXY_PREFIX: &str = "tray.group.proxy::";
pub(crate) const TRAY_MENU_PROFILE_TOGGLE_PREFIX: &str = "tray.profile.toggle::";
pub(crate) const TRAY_MENU_PROFILE_CURRENT_PREFIX: &str = "tray.profile.current::";
pub(crate) const TRAY_MENU_COPY_ENV_PREFIX: &str = "tray.copy-env::";
#[cfg(target_os = "macos")]
pub(crate) const APP_MENU_QUIT_WITHOUT_CORE_ID: &str = "app.quit-without-core";
#[cfg(target_os = "macos")]
pub(crate) const APP_MENU_RESTART_APP_ID: &str = "app.restart-app";
#[cfg(target_os = "macos")]
pub(crate) const APP_MENU_QUIT_ID: &str = "app.quit";
#[cfg(target_os = "macos")]
pub(crate) const APP_MENU_OPEN_APP_DIR_ID: &str = "app.open-dir.app";
#[cfg(target_os = "macos")]
pub(crate) const APP_MENU_OPEN_WORK_DIR_ID: &str = "app.open-dir.work";
#[cfg(target_os = "macos")]
pub(crate) const APP_MENU_OPEN_CORE_DIR_ID: &str = "app.open-dir.core";
#[cfg(target_os = "macos")]
pub(crate) const APP_MENU_OPEN_LOG_DIR_ID: &str = "app.open-dir.log";
#[cfg(target_os = "macos")]
pub(crate) const APP_MENU_RELOAD_ID: &str = "app.reload";
#[cfg(target_os = "macos")]
pub(crate) const APP_MENU_OPEN_DEVTOOLS_ID: &str = "app.open-devtools";
#[cfg(target_os = "macos")]
pub(crate) const APP_MENU_LEARN_MORE_ID: &str = "app.help.learn-more";
#[cfg(target_os = "macos")]
pub(crate) const APP_MENU_REPORT_ISSUE_ID: &str = "app.help.report-issue";
pub(crate) const SHORTCUT_ACTION_KEYS: [&str; 9] = [
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
pub(crate) const ROUTEX_RUN_TASK_NAME: &str = "routex-run";
pub(crate) const ROUTEX_RUN_BINARY: &str = "routex-run.exe";
pub(crate) const ROUTEX_RUN_XML: &str = "routex-run.xml";
pub(crate) const ROUTEX_RUN_ARGS_FILE: &str = "param.txt";
pub(crate) const ROUTEX_AUTORUN_TASK_NAME: &str = "routex";
pub(crate) const ROUTEX_AUTORUN_XML: &str = "routex-autorun.xml";
pub(crate) const ROUTEX_STARTUP_ARG: &str = "--routex-startup";
pub(crate) const ROUTEX_ADMIN_RELAUNCH_PARENT_ARG: &str = "--routex-admin-relaunch-parent";
#[cfg(target_os = "linux")]
pub(crate) const ROUTEX_DESKTOP_NAME: &str = "routex.desktop";
pub(crate) const ENABLE_LOOPBACK_URL: &str =
    "https://github.com/Kuingsmile/uwp-tool/releases/download/latest/enableLoopback.exe";
pub(crate) const THEME_ZIP_URL: &str =
    "https://github.com/Jarv1s0/theme-hub/releases/latest/download/themes.zip";
pub(crate) const NETWORK_CONNECTIVITY_CHECK_URL: &str = "http://cp.cloudflare.com/generate_204";
pub(crate) const NETWORK_HEALTH_TEST_INTERVAL: Duration = Duration::from_secs(15);
pub(crate) const NETWORK_HEALTH_TIMEOUT: Duration = Duration::from_secs(5);
pub(crate) const NETWORK_HEALTH_MAX_HISTORY: usize = 60;
pub(crate) const MIN_CONNECTION_INTERVAL_MS: u64 = 250;
pub(crate) const MAX_TRAFFIC_HOURLY_RECORDS: usize = 24 * 7;
pub(crate) const MAX_TRAFFIC_DAILY_RECORDS: usize = 30;

pub(crate) static APP_STARTED_AT: OnceLock<Instant> = OnceLock::new();
pub(crate) static ICON_DATA_URL_CACHE: OnceLock<Mutex<lru::LruCache<String, String>>> =
    OnceLock::new();
pub(crate) static MIHOMO_HTTP_CLIENT: OnceLock<Result<Client, String>> = OnceLock::new();
pub(crate) static PROFILE_RUNTIME_CONFIG_CACHE: OnceLock<Mutex<Option<ProfileRuntimeConfigCache>>> =
    OnceLock::new();
pub(crate) static PROFILE_RUNTIME_CONFIG_REVISION: AtomicU64 = AtomicU64::new(0);
// 最后一次成功通过 `mihomo -t` 检查的 config yaml 内容哈希（SHA-256 hex）。
// 若本次写入的 config_yaml 哈希与缓存相同，则跳过 check_runtime_profile，节省 ~0.5-2s。
pub(crate) static PROFILE_CHECK_CACHE: OnceLock<Mutex<Option<String>>> = OnceLock::new();
