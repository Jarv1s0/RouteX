use super::*;

pub(super) const ROUTEX_STORE_DIR_NAME: &str = "routex-store";
pub(super) const APP_CONFIG_FILE: &str = "app-config.json";
pub(super) const CHAINS_CONFIG_FILE: &str = "chains-config.json";
pub(super) const CONTROLLED_CONFIG_FILE: &str = "controlled-mihomo-config.json";
pub(super) const PROFILE_CONFIG_FILE: &str = "profile-config.json";
pub(super) const OVERRIDE_CONFIG_FILE: &str = "override-config.json";
pub(super) const QUICK_RULES_CONFIG_FILE: &str = "quick-rules-config.json";
pub(super) const GLOBAL_QUICK_RULES_PROFILE_ID: &str = "__global__";
pub(super) const TRAFFIC_STATS_FILE: &str = "traffic-stats.json";
pub(super) const PROFILE_DIR_NAME: &str = "profiles";
pub(super) const OVERRIDE_DIR_NAME: &str = "overrides";
pub(super) const THEME_DIR_NAME: &str = "themes";
pub(super) const DEFAULT_THEME_FILE_NAME: &str = "default.css";
pub(super) const ROUTEX_BLUE_GLASS_THEME_FILE_NAME: &str = "routex-blue-glass.css";
pub(super) const ROUTEX_BLUE_GLASS_THEME_CSS: &str = r#"/* RouteX Blue Glass */

:root {
  --heroui-background: 210 38% 97%;
  --heroui-foreground: 218 24% 17%;

  --heroui-content1: 0 0% 100%;
  --heroui-content2: 210 32% 96%;
  --heroui-content3: 210 26% 92%;
  --heroui-content4: 210 20% 88%;

  --heroui-default-50: 210 36% 98%;
  --heroui-default-100: 210 30% 95%;
  --heroui-default-200: 212 22% 88%;
  --heroui-default-300: 212 18% 78%;
  --heroui-default-400: 214 14% 60%;
  --heroui-default-500: 215 14% 46%;
  --heroui-default-600: 216 18% 35%;
  --heroui-default-700: 217 22% 27%;
  --heroui-default-800: 218 25% 20%;
  --heroui-default-900: 220 30% 13%;

  --heroui-primary-50: 204 100% 97%;
  --heroui-primary-100: 204 92% 92%;
  --heroui-primary-200: 204 86% 83%;
  --heroui-primary-300: 204 82% 70%;
  --heroui-primary-400: 205 82% 56%;
  --heroui-primary-500: 205 88% 46%;
  --heroui-primary-600: 207 88% 39%;
  --heroui-primary-700: 209 82% 32%;
  --heroui-primary-800: 211 72% 26%;
  --heroui-primary-900: 213 64% 20%;
  --heroui-primary: 205 88% 46%;
  --heroui-primary-foreground: 0 0% 100%;
  --heroui-focus: 205 88% 46%;

  --heroui-success: 164 64% 38%;
  --heroui-warning: 38 86% 50%;
  --heroui-danger: 4 58% 52%;
  --heroui-danger-foreground: 0 0% 100%;

  --stats-download-gradient: linear-gradient(90deg, #0ea5e9 0%, #14b8a6 100%);
}

.dark {
  --heroui-background: 222 34% 8%;
  --heroui-foreground: 210 24% 94%;

  --heroui-content1: 220 28% 12%;
  --heroui-content2: 219 24% 15%;
  --heroui-content3: 218 21% 19%;
  --heroui-content4: 217 18% 24%;

  --heroui-default-50: 221 30% 12%;
  --heroui-default-100: 220 26% 15%;
  --heroui-default-200: 218 22% 22%;
  --heroui-default-300: 217 18% 31%;
  --heroui-default-400: 216 14% 46%;
  --heroui-default-500: 215 16% 64%;
  --heroui-default-600: 214 18% 74%;
  --heroui-default-700: 213 20% 82%;
  --heroui-default-800: 212 24% 90%;
  --heroui-default-900: 210 30% 96%;

  --heroui-primary-50: 206 56% 13%;
  --heroui-primary-100: 206 58% 18%;
  --heroui-primary-200: 206 60% 25%;
  --heroui-primary-300: 205 64% 34%;
  --heroui-primary-400: 205 72% 45%;
  --heroui-primary-500: 204 88% 58%;
  --heroui-primary-600: 202 92% 66%;
  --heroui-primary-700: 200 94% 74%;
  --heroui-primary-800: 198 96% 82%;
  --heroui-primary-900: 196 96% 90%;
  --heroui-primary: 204 88% 58%;
  --heroui-primary-foreground: 222 36% 9%;
  --heroui-focus: 204 88% 58%;

  --heroui-success: 166 58% 48%;
  --heroui-warning: 40 82% 58%;
  --heroui-danger: 4 42% 58%;
  --heroui-danger-foreground: 0 0% 98%;

  --app-danger-text: #d99a95;
  --app-danger-fill: #9f5753;
  --app-danger-border: rgba(217, 154, 149, 0.34);
  --app-danger-ring: rgba(217, 154, 149, 0.38);

  --stats-download-gradient: linear-gradient(90deg, #38bdf8 0%, #2dd4bf 100%);
}

body,
#root,
.main {
  background:
    linear-gradient(135deg, hsl(var(--heroui-primary) / 0.08), transparent 38%),
    hsl(var(--heroui-background)) !important;
  color: hsl(var(--heroui-foreground)) !important;
}

.dark body,
.dark #root,
.dark .main {
  background:
    linear-gradient(135deg, hsl(var(--heroui-primary) / 0.16), transparent 34%),
    hsl(var(--heroui-background)) !important;
}

.side {
  background: hsl(var(--heroui-content1) / 0.72) !important;
  border-right-color: hsl(var(--heroui-default-200) / 0.58) !important;
  box-shadow: inset -1px 0 0 hsl(0 0% 100% / 0.28);
  backdrop-filter: blur(18px) saturate(1.08);
}

.dark .side {
  background: hsl(var(--heroui-content1) / 0.76) !important;
  border-right-color: hsl(0 0% 100% / 0.08) !important;
  box-shadow: inset -1px 0 0 hsl(0 0% 100% / 0.04);
}

.title > div:first-child {
  background: hsl(var(--heroui-primary)) !important;
  box-shadow: 0 0 12px hsl(var(--heroui-primary) / 0.32) !important;
}

.proxy-card [data-slot='base'],
.conn-card [data-slot='base'] {
  background:
    linear-gradient(180deg, hsl(0 0% 100% / 0.34), hsl(0 0% 100% / 0.08)),
    hsl(var(--heroui-content1) / 0.74) !important;
  border-color: hsl(var(--heroui-default-200) / 0.62) !important;
  box-shadow:
    inset 0 1px 0 hsl(0 0% 100% / 0.34),
    0 8px 22px hsl(214 30% 24% / 0.08) !important;
}

.dark .proxy-card [data-slot='base'],
.dark .conn-card [data-slot='base'] {
  background:
    linear-gradient(180deg, hsl(0 0% 100% / 0.07), hsl(0 0% 100% / 0.02)),
    hsl(var(--heroui-content1) / 0.72) !important;
  border-color: hsl(0 0% 100% / 0.08) !important;
  box-shadow:
    inset 0 1px 0 hsl(0 0% 100% / 0.05),
    0 10px 26px hsl(222 45% 4% / 0.22) !important;
}

.sysproxy-card,
.tun-card {
  background: hsl(var(--heroui-content1) / 0.58) !important;
  border: 1px solid hsl(var(--heroui-default-200) / 0.54) !important;
  box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.26);
}

.dark .sysproxy-card,
.dark .tun-card {
  background: hsl(var(--heroui-content2) / 0.38) !important;
  border-color: hsl(0 0% 100% / 0.07) !important;
  box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.04);
}

.sysproxy-card:hover,
.tun-card:hover,
.proxy-card [data-slot='base']:hover,
.conn-card [data-slot='base']:hover {
  border-color: hsl(var(--heroui-primary) / 0.3) !important;
  background-color: hsl(var(--heroui-primary) / 0.08) !important;
}

[data-slot='input-wrapper'],
[data-slot='trigger'] {
  background: hsl(var(--heroui-default-100) / 0.7) !important;
  border-color: hsl(var(--heroui-default-200) / 0.62) !important;
}

.dark [data-slot='input-wrapper'],
.dark [data-slot='trigger'] {
  background: hsl(var(--heroui-content2) / 0.62) !important;
  border-color: hsl(0 0% 100% / 0.08) !important;
}

[data-slot='input-wrapper']:focus-within,
[data-slot='trigger'][data-open='true'] {
  border-color: hsl(var(--heroui-primary) / 0.62) !important;
  box-shadow: 0 0 0 2px hsl(var(--heroui-primary) / 0.18) !important;
}

[data-slot='content'][role='tooltip'] {
  background: hsl(var(--heroui-content1) / 0.92) !important;
  border: 1px solid hsl(var(--heroui-default-200) / 0.62) !important;
  color: hsl(var(--heroui-foreground)) !important;
  box-shadow: 0 12px 30px hsl(214 30% 24% / 0.14) !important;
}

.dark [data-slot='content'][role='tooltip'] {
  background: hsl(var(--heroui-content2) / 0.94) !important;
  border-color: hsl(0 0% 100% / 0.08) !important;
  box-shadow: 0 14px 34px hsl(222 45% 4% / 0.34) !important;
}

.outbound-mode-card [data-slot='cursor'] {
  background: hsl(var(--heroui-content1) / 0.94) !important;
  border: 1px solid hsl(var(--heroui-primary) / 0.22) !important;
  box-shadow: 0 6px 16px hsl(var(--heroui-primary) / 0.14) !important;
}

.dark .outbound-mode-card [data-slot='cursor'] {
  background: hsl(var(--heroui-primary) / 0.2) !important;
  border-color: hsl(var(--heroui-primary) / 0.24) !important;
}

.stats-download-accent {
  color: #0284c7 !important;
}

.stats-download-dot,
.stats-download-bar {
  background: #0ea5e9 !important;
}

.stats-download-dot {
  box-shadow: 0 0 6px rgba(14, 165, 233, 0.24) !important;
}

.stats-download-icon-soft {
  background: rgba(14, 165, 233, 0.1) !important;
  color: #0284c7 !important;
}

.dark .stats-download-accent {
  color: #7dd3fc !important;
}

.dark .stats-download-dot,
.dark .stats-download-bar {
  background: #38bdf8 !important;
}

.dark .stats-download-dot {
  box-shadow: 0 0 6px rgba(56, 189, 248, 0.18) !important;
}

.dark .stats-download-icon-soft {
  background: rgba(56, 189, 248, 0.12) !important;
  color: #7dd3fc !important;
}
"#;
pub(super) const RUNTIME_DIR_NAME: &str = "runtime-files";
pub(super) const MIHOMO_RUNTIME_DIR_NAME: &str = "mihomo-runtime";
pub(super) const UPDATES_DIR_NAME: &str = "updates";
pub(super) const TASKS_DIR_NAME: &str = "tasks";
pub(super) const RUNTIME_ASSETS_DIR_NAME: &str = "runtime-assets";
pub(super) const TRAFFIC_MONITOR_REPO: &str = "zhongyang219/TrafficMonitor";
pub(super) const TRAFFIC_MONITOR_PID_FILE: &str = "traffic-monitor.pid";
#[cfg(target_os = "windows")]
pub(super) const WINDOWS_APP_DATA_DIR_NAME: &str = "routex.app";
#[cfg(target_os = "windows")]
pub(super) const CREATE_NO_WINDOW: u32 = 0x08000000;
pub(super) const DEFAULT_PROFILE_TEXT: &str = "proxies: []\nproxy-groups: []\nrules: []\n";
pub(super) const FLOATING_WINDOW_LABEL: &str = "floating";
pub(super) const FLOATING_WINDOW_STATE_FILE: &str = "floating-window-state.json";
pub(super) const TRAYMENU_WINDOW_LABEL: &str = "traymenu";
pub(super) const TRAYMENU_WINDOW_WIDTH: f64 = 392.0;
pub(super) const TRAYMENU_WINDOW_HEIGHT: f64 = 548.0;
pub(super) const TRAYMENU_WINDOW_GAP: f64 = 10.0;
pub(super) const TRAY_ICON_ID: &str = "main";
pub(super) const TRAY_MENU_SHOW_WINDOW_ID: &str = "tray.show-window";
pub(super) const TRAY_MENU_TOGGLE_FLOATING_ID: &str = "tray.toggle-floating";
pub(super) const TRAY_MENU_TOGGLE_SYS_PROXY_ID: &str = "tray.toggle-sysproxy";
pub(super) const TRAY_MENU_TOGGLE_TUN_ID: &str = "tray.toggle-tun";
pub(super) const TRAY_MENU_MODE_RULE_ID: &str = "tray.mode.rule";
pub(super) const TRAY_MENU_MODE_GLOBAL_ID: &str = "tray.mode.global";
pub(super) const TRAY_MENU_MODE_DIRECT_ID: &str = "tray.mode.direct";
pub(super) const TRAY_MENU_PROFILE_EMPTY_ID: &str = "tray.profile.empty";
pub(super) const TRAY_MENU_PROFILE_CURRENT_EMPTY_ID: &str = "tray.profile.current.empty";
pub(super) const TRAY_MENU_OPEN_APP_DIR_ID: &str = "tray.open-dir.app";
pub(super) const TRAY_MENU_OPEN_WORK_DIR_ID: &str = "tray.open-dir.work";
pub(super) const TRAY_MENU_OPEN_CORE_DIR_ID: &str = "tray.open-dir.core";
pub(super) const TRAY_MENU_OPEN_LOG_DIR_ID: &str = "tray.open-dir.log";
pub(super) const TRAY_MENU_QUIT_WITHOUT_CORE_ID: &str = "tray.quit-without-core";
pub(super) const TRAY_MENU_RESTART_APP_ID: &str = "tray.restart-app";
pub(super) const TRAY_MENU_QUIT_ID: &str = "tray.quit";
pub(super) const TRAY_MENU_GROUP_TEST_PREFIX: &str = "tray.group.test::";
pub(super) const TRAY_MENU_GROUP_PROXY_PREFIX: &str = "tray.group.proxy::";
pub(super) const TRAY_MENU_PROFILE_TOGGLE_PREFIX: &str = "tray.profile.toggle::";
pub(super) const TRAY_MENU_PROFILE_CURRENT_PREFIX: &str = "tray.profile.current::";
pub(super) const TRAY_MENU_COPY_ENV_PREFIX: &str = "tray.copy-env::";
#[cfg(target_os = "macos")]
pub(super) const APP_MENU_QUIT_WITHOUT_CORE_ID: &str = "app.quit-without-core";
#[cfg(target_os = "macos")]
pub(super) const APP_MENU_RESTART_APP_ID: &str = "app.restart-app";
#[cfg(target_os = "macos")]
pub(super) const APP_MENU_QUIT_ID: &str = "app.quit";
#[cfg(target_os = "macos")]
pub(super) const APP_MENU_OPEN_APP_DIR_ID: &str = "app.open-dir.app";
#[cfg(target_os = "macos")]
pub(super) const APP_MENU_OPEN_WORK_DIR_ID: &str = "app.open-dir.work";
#[cfg(target_os = "macos")]
pub(super) const APP_MENU_OPEN_CORE_DIR_ID: &str = "app.open-dir.core";
#[cfg(target_os = "macos")]
pub(super) const APP_MENU_OPEN_LOG_DIR_ID: &str = "app.open-dir.log";
#[cfg(target_os = "macos")]
pub(super) const APP_MENU_RELOAD_ID: &str = "app.reload";
#[cfg(target_os = "macos")]
pub(super) const APP_MENU_OPEN_DEVTOOLS_ID: &str = "app.open-devtools";
#[cfg(target_os = "macos")]
pub(super) const APP_MENU_LEARN_MORE_ID: &str = "app.help.learn-more";
#[cfg(target_os = "macos")]
pub(super) const APP_MENU_REPORT_ISSUE_ID: &str = "app.help.report-issue";
pub(super) const SHORTCUT_ACTION_KEYS: [&str; 9] = [
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
pub(super) const ROUTEX_RUN_TASK_NAME: &str = "routex-run";
pub(super) const ROUTEX_RUN_BINARY: &str = "routex-run.exe";
pub(super) const ROUTEX_RUN_XML: &str = "routex-run.xml";
pub(super) const ROUTEX_RUN_ARGS_FILE: &str = "param.txt";
pub(super) const ROUTEX_AUTORUN_TASK_NAME: &str = "routex";
pub(super) const ROUTEX_AUTORUN_XML: &str = "routex-autorun.xml";
pub(super) const ROUTEX_STARTUP_ARG: &str = "--routex-startup";
pub(super) const ROUTEX_ADMIN_RELAUNCH_PARENT_ARG: &str = "--routex-admin-relaunch-parent";
#[cfg(target_os = "linux")]
pub(super) const ROUTEX_DESKTOP_NAME: &str = "routex.desktop";
pub(super) const ENABLE_LOOPBACK_URL: &str =
    "https://github.com/Kuingsmile/uwp-tool/releases/download/latest/enableLoopback.exe";
pub(super) const THEME_ZIP_URL: &str =
    "https://github.com/Jarv1s0/theme-hub/releases/latest/download/themes.zip";
pub(super) const NETWORK_CONNECTIVITY_CHECK_URL: &str = "http://cp.cloudflare.com/generate_204";
pub(super) const NETWORK_HEALTH_TEST_INTERVAL: Duration = Duration::from_secs(15);
pub(super) const NETWORK_HEALTH_TIMEOUT: Duration = Duration::from_secs(5);
pub(super) const NETWORK_HEALTH_MAX_HISTORY: usize = 60;
pub(super) const MIN_CONNECTION_INTERVAL_MS: u64 = 250;
pub(super) const MAX_TRAFFIC_HOURLY_RECORDS: usize = 24 * 7;
pub(super) const MAX_TRAFFIC_DAILY_RECORDS: usize = 30;

pub(super) static APP_STARTED_AT: OnceLock<Instant> = OnceLock::new();
pub(super) static ICON_DATA_URL_CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
pub(super) static MIHOMO_HTTP_CLIENT: OnceLock<Result<Client, String>> = OnceLock::new();
pub(super) static PROFILE_RUNTIME_CONFIG_CACHE: OnceLock<Mutex<Option<ProfileRuntimeConfigCache>>> =
    OnceLock::new();
pub(super) static PROFILE_RUNTIME_CONFIG_REVISION: AtomicU64 = AtomicU64::new(0);
// 最后一次成功通过 `mihomo -t` 检查的 config yaml 内容哈希（SHA-256 hex）。
// 若本次写入的 config_yaml 哈希与缓存相同，则跳过 check_runtime_profile，节省 ~0.5-2s。
pub(super) static PROFILE_CHECK_CACHE: OnceLock<Mutex<Option<String>>> = OnceLock::new();
