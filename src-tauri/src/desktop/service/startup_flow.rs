use super::*;
use crate::desktop::prelude::*;
use crate::desktop::*;

#[cfg(target_os = "windows")]
pub fn app_data_root_before_tauri() -> Result<PathBuf, String> {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|base| base.join(WINDOWS_APP_DATA_DIR_NAME))
        .ok_or_else(|| "无法解析 APPDATA 目录".to_string())
}

#[cfg(target_os = "windows")]
pub fn task_dir_before_tauri() -> Result<PathBuf, String> {
    ensure_dir(app_runtime_tasks_root_path(&app_data_root_before_tauri()?))
}

#[cfg(target_os = "windows")]
pub fn routex_run_binary_task_path_before_tauri() -> Result<PathBuf, String> {
    Ok(task_dir_before_tauri()?.join(ROUTEX_RUN_BINARY))
}

#[cfg(target_os = "windows")]
pub fn routex_run_args_path_before_tauri() -> Result<PathBuf, String> {
    Ok(task_dir_before_tauri()?.join(ROUTEX_RUN_ARGS_FILE))
}

#[cfg(target_os = "windows")]
pub fn read_core_permission_mode_before_tauri() -> Result<String, String> {
    let app_root = app_data_root_before_tauri()?;
    let config_path = app_config_root_path(&app_root).join(APP_CONFIG_FILE);
    let config = read_json_file::<Value>(&config_path)?.unwrap_or_else(|| json!({}));
    Ok(config
        .get("corePermissionMode")
        .and_then(Value::as_str)
        .unwrap_or("elevated")
        .to_string())
}

#[cfg(target_os = "windows")]
pub fn resolve_routex_run_binary_before_tauri() -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();
    let dir_names = ["tools"];

    if cfg!(debug_assertions) {
        push_resource_candidate(
            &mut candidates,
            &mut seen,
            dev_root()?
                .join("extra")
                .join("files")
                .join(ROUTEX_RUN_BINARY),
        );
    }

    if let Some(exe_dir) = current_exe_dir() {
        for base in [
            exe_dir.clone(),
            exe_dir.join("resources"),
            exe_dir
                .parent()
                .map(|path| path.join("Resources"))
                .unwrap_or_default(),
        ] {
            if !base.as_os_str().is_empty() {
                for dir_name in dir_names {
                    push_resource_candidate(
                        &mut candidates,
                        &mut seen,
                        base.join(dir_name).join(ROUTEX_RUN_BINARY),
                    );
                }
            }
        }
    }

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
        "RouteX run helper not found: {ROUTEX_RUN_BINARY}. searched: {searched}"
    ))
}

#[cfg(target_os = "windows")]
pub fn copy_routex_run_binary_for_task_before_tauri() -> Result<(), String> {
    let routex_run_dest = routex_run_binary_task_path_before_tauri()?;
    let routex_run_source = resolve_routex_run_binary_before_tauri()?;
    let source_digest = file_sha256(&routex_run_source)?;

    if routex_run_dest.exists() {
        if let Ok(dest_digest) = file_sha256(&routex_run_dest) {
            if dest_digest == source_digest {
                return Ok(());
            }
        }
    }

    fs::copy(&routex_run_source, &routex_run_dest)
        .map(|_| ())
        .map_err(|e| {
            format!(
                "复制提权启动器失败 {} -> {}: {e}",
                routex_run_source.display(),
                routex_run_dest.display()
            )
        })
}

#[cfg(target_os = "windows")]
pub fn write_elevate_task_params_before_tauri() -> Result<(), String> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    let value = serde_json::to_string(&args).map_err(|e| e.to_string())?;
    fs::write(routex_run_args_path_before_tauri()?, value).map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
pub fn check_elevate_task_matches_current_app_before_tauri() -> bool {
    let routex_run_path = match routex_run_binary_task_path_before_tauri() {
        Ok(path) => path,
        Err(_) => return false,
    };
    let exe_path = match std::env::current_exe() {
        Ok(path) => path,
        Err(_) => return false,
    };
    let output = match schtasks_output(&["/query", "/tn", routex_run_task_name(), "/xml"]) {
        Ok(output) if output.status.success() => output,
        _ => return false,
    };
    let xml = String::from_utf8_lossy(&output.stdout);
    task_xml_matches_current_exec(&xml, &routex_run_path, &exe_path, None)
}

#[cfg(target_os = "windows")]
pub fn run_elevate_task_before_tauri() -> Result<(), String> {
    write_elevate_task_params_before_tauri()?;
    copy_routex_run_binary_for_task_before_tauri()?;
    schtasks_command(&["/run", "/tn", routex_run_task_name()])
}

#[cfg(target_os = "windows")]
pub fn run_matching_elevate_task_before_tauri(create_error: &str) -> Result<bool, String> {
    match run_elevate_task_before_tauri() {
        Ok(()) => Ok(false),
        Err(run_error) => {
            show_windows_startup_relaunch_failed_dialog(create_error, &run_error);
            Ok(true)
        }
    }
}

#[cfg(target_os = "windows")]
pub fn single_instance_window_exists_before_tauri(app_identifier: &str) -> bool {
    #[link(name = "user32")]
    unsafe extern "system" {
        pub fn FindWindowW(
            class_name: *const u16,
            window_name: *const u16,
        ) -> *mut std::ffi::c_void;
    }

    let class_name = to_wide_null(&format!("{app_identifier}-sic"));
    let window_name = to_wide_null(&format!("{app_identifier}-siw"));
    let hwnd = unsafe { FindWindowW(class_name.as_ptr(), window_name.as_ptr()) };
    !hwnd.is_null()
}

#[cfg(target_os = "windows")]
pub fn ensure_windows_elevated_startup_before_tauri(app_identifier: &str) -> Result<bool, String> {
    if cfg!(debug_assertions) {
        return Ok(true);
    }

    if std::env::args().any(|arg| arg.eq_ignore_ascii_case("noadmin")) {
        return Ok(true);
    }

    if read_core_permission_mode_before_tauri()? == "service" {
        return Ok(true);
    }

    match check_windows_process_elevated() {
        Ok(true) => Ok(true),
        Ok(false) => {
            if single_instance_window_exists_before_tauri(app_identifier) {
                return Ok(true);
            }

            if check_elevate_task_matches_current_app_before_tauri() {
                return run_matching_elevate_task_before_tauri("已存在匹配当前安装路径的提权任务");
            }

            handle_windows_unregistered_elevate_task(
                "当前 RouteX 进程没有管理员权限，无法注册提权任务。",
            );
            Ok(false)
        }
        Err(error) => {
            if check_elevate_task_matches_current_app_before_tauri() {
                return run_matching_elevate_task_before_tauri(&error);
            }

            show_windows_startup_task_registration_failed_dialog(&format!(
                "无法确认当前 RouteX 进程是否具有管理员权限: {error}"
            ));
            Ok(false)
        }
    }
}

#[cfg(target_os = "windows")]
pub fn prepare_windows_elevated_startup_before_tauri(app_identifier: &str) -> bool {
    match ensure_windows_elevated_startup_before_tauri(app_identifier) {
        Ok(continue_startup) => continue_startup,
        Err(error) => {
            eprintln!("pre-tauri elevated startup skipped: {error}");
            true
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn prepare_windows_elevated_startup_before_tauri(_app_identifier: &str) -> bool {
    true
}

#[cfg(target_os = "windows")]
pub fn handle_windows_unregistered_elevate_task(create_error: &str) {
    if !looks_like_windows_permission_error(create_error) {
        show_windows_startup_task_registration_failed_dialog(create_error);
        return;
    }

    if let Err(error) = relaunch_current_app_as_admin() {
        show_windows_startup_admin_relaunch_failed_dialog(&error);
    }
}

pub fn run_elevate_task(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        write_elevate_task_params(app)?;
        ensure_routex_run_binary_for_task(app)?;
        schtasks_command(&["/run", "/tn", routex_run_task_name()])
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("当前平台未实现任务计划启动".to_string())
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum WindowsUnelevatedStartupAction {
    RunElevateTask,
    RequestAdminRegistration,
}

pub fn choose_windows_unelevated_startup_action(
    elevate_task_matches_current_app: bool,
) -> WindowsUnelevatedStartupAction {
    if elevate_task_matches_current_app {
        WindowsUnelevatedStartupAction::RunElevateTask
    } else {
        WindowsUnelevatedStartupAction::RequestAdminRegistration
    }
}

#[cfg(target_os = "windows")]
pub fn handle_windows_elevated_process_startup(app: &tauri::AppHandle) -> Result<bool, String> {
    match create_elevate_task(app) {
        Ok(()) => Ok(true),
        Err(create_error) => {
            if check_elevate_task_matches_current_app(app) {
                eprintln!("refresh elevated task failed, using existing task: {create_error}");
                return Ok(true);
            }

            show_windows_startup_task_registration_failed_dialog(&create_error);
            Ok(false)
        }
    }
}

#[cfg(target_os = "windows")]
pub fn handle_windows_unelevated_process_startup(app: &tauri::AppHandle) -> Result<bool, String> {
    match choose_windows_unelevated_startup_action(check_elevate_task_matches_current_app(app)) {
        WindowsUnelevatedStartupAction::RunElevateTask => match run_elevate_task(app) {
            Ok(()) => Ok(false),
            Err(run_error) => {
                show_windows_startup_relaunch_failed_dialog(
                    "已存在匹配当前安装路径的提权任务",
                    &run_error,
                );
                Ok(true)
            }
        },
        WindowsUnelevatedStartupAction::RequestAdminRegistration => {
            handle_windows_unregistered_elevate_task(
                "当前 RouteX 进程没有管理员权限，无法注册提权任务。",
            );
            Ok(false)
        }
    }
}

pub fn ensure_elevated_startup(app: &tauri::AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        if cfg!(debug_assertions) {
            return Ok(true);
        }

        if std::env::args().any(|arg| arg.eq_ignore_ascii_case("noadmin")) {
            return Ok(true);
        }

        if read_core_permission_mode(app)? == "service" {
            return Ok(true);
        }

        match check_windows_process_elevated() {
            Ok(true) => handle_windows_elevated_process_startup(app),
            Ok(false) => handle_windows_unelevated_process_startup(app),
            Err(error) => {
                if check_elevate_task_matches_current_app(app) {
                    match run_elevate_task(app) {
                        Ok(()) => Ok(false),
                        Err(run_error) => {
                            show_windows_startup_relaunch_failed_dialog(&error, &run_error);
                            Ok(true)
                        }
                    }
                } else {
                    show_windows_startup_task_registration_failed_dialog(&format!(
                        "无法确认当前 RouteX 进程是否具有管理员权限: {error}"
                    ));
                    Ok(false)
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Ok(true)
    }
}
