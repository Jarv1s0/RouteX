#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
mod windows_launcher {
    use std::{env, ffi::c_void, fs, path::PathBuf, process::Command};

    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    const SW_SHOWNORMAL: i32 = 1;

    #[link(name = "shell32")]
    unsafe extern "system" {
        fn ShellExecuteW(
            hwnd: *mut c_void,
            operation: *const u16,
            file: *const u16,
            parameters: *const u16,
            directory: *const u16,
            show_cmd: i32,
        ) -> *mut c_void;
    }

    pub fn run() {
        if !is_service_mode_configured() && run_elevate_task() {
            return;
        }

        let _ = launch_main_exe();
    }

    fn is_service_mode_configured() -> bool {
        read_app_config_text()
            .as_deref()
            .is_some_and(core_permission_mode_is_service)
    }

    fn read_app_config_text() -> Option<String> {
        let appdata = env::var_os("APPDATA").map(PathBuf::from)?;
        let config_path = appdata
            .join("routex.app")
            .join("routex-store")
            .join("app-config.json");
        fs::read_to_string(config_path).ok()
    }

    fn core_permission_mode_is_service(text: &str) -> bool {
        let Ok(value) = serde_json::from_str::<serde_json::Value>(text) else {
            return false;
        };
        matches!(
            value
                .get("corePermissionMode")
                .and_then(serde_json::Value::as_str),
            Some("service")
        )
    }

    fn run_elevate_task() -> bool {
        Command::new(resolve_system_binary("schtasks.exe"))
            .creation_flags(CREATE_NO_WINDOW)
            .args(["/run", "/tn", routex_run_task_name()])
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }

    fn launch_main_exe() -> bool {
        let Some(exe_path) = resolve_main_exe_path() else {
            return false;
        };
        let Some(parent_dir) = exe_path.parent() else {
            return false;
        };

        let params = env::args()
            .skip(1)
            .map(|arg| shell_execute_quote(&arg))
            .collect::<Vec<_>>()
            .join(" ");
        let file = wide_null(exe_path.to_string_lossy());
        let params = wide_null(&params);
        let directory = wide_null(parent_dir.to_string_lossy());

        let result = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                std::ptr::null(),
                file.as_ptr(),
                params.as_ptr(),
                directory.as_ptr(),
                SW_SHOWNORMAL,
            )
        };

        (result as usize) > 32
    }

    fn resolve_main_exe_path() -> Option<PathBuf> {
        let current_exe = env::current_exe().ok()?;
        let current_dir = current_exe.parent()?;
        let candidates = [
            current_dir.join("routex.exe"),
            current_dir.join("..").join("..").join("routex.exe"),
            current_dir.join("..").join("routex.exe"),
        ];

        candidates
            .into_iter()
            .find(|candidate| candidate.is_file())
            .and_then(|candidate| candidate.canonicalize().ok().or(Some(candidate)))
    }

    fn routex_run_task_name() -> &'static str {
        match option_env!("ROUTEX_TAURI_BUILD_VARIANT") {
            Some("dev") => "routex-run-dev",
            Some("autobuild") => "routex-run-autobuild",
            _ => "routex-run",
        }
    }

    fn resolve_system_binary(binary: &str) -> PathBuf {
        for key in ["SystemRoot", "windir", "WINDIR"] {
            if let Some(root) = env::var_os(key) {
                let candidate = PathBuf::from(root).join("System32").join(binary);
                if candidate.exists() {
                    return candidate;
                }
            }
        }

        PathBuf::from(binary)
    }

    fn shell_execute_quote(value: &str) -> String {
        if !value.chars().any(|ch| ch.is_whitespace() || ch == '"') {
            return value.to_string();
        }

        format!("\"{}\"", value.replace('"', "\\\""))
    }

    fn wide_null(value: impl AsRef<str>) -> Vec<u16> {
        value
            .as_ref()
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect()
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn quotes_shell_execute_arguments_with_spaces() {
            assert_eq!(shell_execute_quote("plain"), "plain");
            assert_eq!(shell_execute_quote("has space"), "\"has space\"");
        }

        #[test]
        fn selects_task_name_from_build_variant() {
            assert!(!routex_run_task_name().is_empty());
        }

        #[test]
        fn parses_service_permission_mode() {
            let config = r#"{"corePermissionMode":"service"}"#;
            assert!(core_permission_mode_is_service(config));
        }

        #[test]
        fn missing_permission_mode_is_not_service() {
            let config = r#"{"silentStart":false}"#;
            assert!(!core_permission_mode_is_service(config));
        }

        #[test]
        fn candidate_paths_include_installed_resource_layout() {
            let resource_dir = std::path::Path::new(r"C:\Program Files\RouteX\extra\files");
            let expected = resource_dir.join("..").join("..").join("routex.exe");
            assert!(expected.ends_with("routex.exe"));
        }
    }
}

#[cfg(target_os = "windows")]
fn main() {
    windows_launcher::run();
}

#[cfg(not(target_os = "windows"))]
fn main() {}
