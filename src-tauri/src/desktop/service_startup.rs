#[allow(unused_imports)]
use super::prelude::*;
#[allow(unused_imports)]
use super::*;

#[cfg(target_os = "windows")]
pub(crate) const TDF_ALLOW_DIALOG_CANCELLATION: u32 = 0x0008;
#[cfg(target_os = "windows")]
pub(crate) const TDF_SIZE_TO_CONTENT: u32 = 0x01000000;
#[cfg(target_os = "windows")]
pub(crate) const TDCBF_OK_BUTTON: u32 = 0x0001;
#[cfg(target_os = "windows")]
pub(crate) const TD_WARNING_ICON: *const u16 = (-1isize) as *const u16;
#[cfg(target_os = "windows")]
pub(crate) const SW_SHOWNORMAL: i32 = 1;
#[cfg(target_os = "windows")]
pub(crate) const SYNCHRONIZE: u32 = 0x00100000;
#[cfg(target_os = "windows")]
pub(crate) const ADMIN_RELAUNCH_PARENT_WAIT_MS: u32 = 15_000;

#[cfg(target_os = "windows")]
#[repr(C)]
pub(crate) struct TaskDialogButton {
    button_id: i32,
    button_text: *const u16,
}

#[cfg(target_os = "windows")]
#[repr(C)]
pub(crate) struct TaskDialogConfig {
    size: u32,
    parent: *mut std::ffi::c_void,
    instance: *mut std::ffi::c_void,
    flags: u32,
    common_buttons: u32,
    window_title: *const u16,
    main_icon: *const u16,
    main_instruction: *const u16,
    content: *const u16,
    button_count: u32,
    buttons: *const TaskDialogButton,
    default_button: i32,
    radio_button_count: u32,
    radio_buttons: *const TaskDialogButton,
    default_radio_button: i32,
    verification_text: *const u16,
    expanded_information: *const u16,
    expanded_control_text: *const u16,
    collapsed_control_text: *const u16,
    footer_icon: *const u16,
    footer: *const u16,
    callback:
        Option<unsafe extern "system" fn(*mut std::ffi::c_void, u32, usize, isize, isize) -> i32>,
    callback_data: isize,
    width: u32,
}

#[cfg(target_os = "windows")]
#[link(name = "comctl32")]
unsafe extern "system" {
    pub(crate) fn TaskDialogIndirect(
        config: *const TaskDialogConfig,
        button: *mut i32,
        radio_button: *mut i32,
        verification_flag_checked: *mut i32,
    ) -> i32;
}

#[cfg(target_os = "windows")]
#[link(name = "shell32")]
unsafe extern "system" {
    pub(crate) fn ShellExecuteW(
        hwnd: *mut std::ffi::c_void,
        operation: *const u16,
        file: *const u16,
        parameters: *const u16,
        directory: *const u16,
        show_cmd: i32,
    ) -> *mut std::ffi::c_void;
}

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
unsafe extern "system" {
    pub(crate) fn OpenProcess(
        desired_access: u32,
        inherit_handle: i32,
        process_id: u32,
    ) -> *mut std::ffi::c_void;
    pub(crate) fn WaitForSingleObject(handle: *mut std::ffi::c_void, milliseconds: u32) -> u32;
    pub(crate) fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
}

#[cfg(target_os = "windows")]
pub(crate) fn to_wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(target_os = "windows")]
pub(crate) fn startup_task_dialog_config(
    window_title: *const u16,
    main_icon: *const u16,
    main_instruction: *const u16,
    content: *const u16,
) -> TaskDialogConfig {
    TaskDialogConfig {
        size: std::mem::size_of::<TaskDialogConfig>() as u32,
        parent: std::ptr::null_mut(),
        instance: std::ptr::null_mut(),
        flags: TDF_ALLOW_DIALOG_CANCELLATION | TDF_SIZE_TO_CONTENT,
        common_buttons: 0,
        window_title,
        main_icon,
        main_instruction,
        content,
        button_count: 0,
        buttons: std::ptr::null(),
        default_button: 0,
        radio_button_count: 0,
        radio_buttons: std::ptr::null(),
        default_radio_button: 0,
        verification_text: std::ptr::null(),
        expanded_information: std::ptr::null(),
        expanded_control_text: std::ptr::null(),
        collapsed_control_text: std::ptr::null(),
        footer_icon: std::ptr::null(),
        footer: std::ptr::null(),
        callback: None,
        callback_data: 0,
        width: 0,
    }
}

#[cfg(target_os = "windows")]
pub(crate) fn show_windows_startup_dialog(
    title: &str,
    heading: &str,
    message: &str,
    detail: Option<&str>,
) {
    let title_wide = to_wide_null(title);
    let heading_wide = to_wide_null(heading);
    let message_wide = to_wide_null(message);
    let detail_wide = detail
        .filter(|value| !value.trim().is_empty())
        .map(to_wide_null);
    let collapsed_control_text = to_wide_null("显示详细信息");
    let expanded_control_text = to_wide_null("隐藏详细信息");
    let mut config = startup_task_dialog_config(
        title_wide.as_ptr(),
        TD_WARNING_ICON,
        heading_wide.as_ptr(),
        message_wide.as_ptr(),
    );
    config.common_buttons = TDCBF_OK_BUTTON;
    if let Some(detail_wide) = &detail_wide {
        config.expanded_information = detail_wide.as_ptr();
        config.expanded_control_text = expanded_control_text.as_ptr();
        config.collapsed_control_text = collapsed_control_text.as_ptr();
    }
    let _ = unsafe {
        TaskDialogIndirect(
            &config,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
}

#[cfg(target_os = "windows")]
pub(crate) fn shell_execute_quote_arg(value: &str) -> String {
    if value.is_empty() {
        return "\"\"".to_string();
    }

    if !value.chars().any(|ch| ch.is_whitespace() || ch == '"') {
        return value.to_string();
    }

    format!("\"{}\"", value.replace('"', "\\\""))
}

#[cfg(target_os = "windows")]
pub(crate) fn shell_execute_parameters(args: impl IntoIterator<Item = String>) -> String {
    args.into_iter()
        .map(|arg| shell_execute_quote_arg(&arg))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(target_os = "windows")]
pub(crate) fn admin_relaunch_args(
    args: impl IntoIterator<Item = String>,
    parent_pid: u32,
) -> Vec<String> {
    let mut values = vec![
        ROUTEX_ADMIN_RELAUNCH_PARENT_ARG.to_string(),
        parent_pid.to_string(),
    ];
    let mut skip_next = false;
    for arg in args {
        if skip_next {
            skip_next = false;
            continue;
        }
        if arg.eq_ignore_ascii_case(ROUTEX_ADMIN_RELAUNCH_PARENT_ARG) {
            skip_next = true;
            continue;
        }
        values.push(arg);
    }
    values
}

#[cfg(target_os = "windows")]
pub(crate) fn admin_relaunch_parent_pid() -> Option<u32> {
    let mut args = std::env::args();
    while let Some(arg) = args.next() {
        if arg.eq_ignore_ascii_case(ROUTEX_ADMIN_RELAUNCH_PARENT_ARG) {
            return args.next().and_then(|value| value.parse::<u32>().ok());
        }
    }
    None
}

#[cfg(target_os = "windows")]
pub(crate) fn wait_for_process_exit(process_id: u32) {
    let handle = unsafe { OpenProcess(SYNCHRONIZE, 0, process_id) };
    if handle.is_null() {
        return;
    }

    unsafe {
        let _ = WaitForSingleObject(handle, ADMIN_RELAUNCH_PARENT_WAIT_MS);
        let _ = CloseHandle(handle);
    }
}

#[cfg(target_os = "windows")]
pub(crate) fn wait_for_admin_relaunch_parent_exit() {
    if let Some(process_id) = admin_relaunch_parent_pid() {
        wait_for_process_exit(process_id);
    }
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn wait_for_admin_relaunch_parent_exit() {}

#[cfg(target_os = "windows")]
pub(crate) fn app_data_root_before_tauri() -> Result<PathBuf, String> {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|base| base.join(WINDOWS_APP_DATA_DIR_NAME))
        .ok_or_else(|| "无法解析 APPDATA 目录".to_string())
}

#[cfg(target_os = "windows")]
pub(crate) fn task_dir_before_tauri() -> Result<PathBuf, String> {
    ensure_dir(app_runtime_tasks_root_path(&app_data_root_before_tauri()?))
}

#[cfg(target_os = "windows")]
pub(crate) fn routex_run_binary_task_path_before_tauri() -> Result<PathBuf, String> {
    Ok(task_dir_before_tauri()?.join(ROUTEX_RUN_BINARY))
}

#[cfg(target_os = "windows")]
pub(crate) fn routex_run_args_path_before_tauri() -> Result<PathBuf, String> {
    Ok(task_dir_before_tauri()?.join(ROUTEX_RUN_ARGS_FILE))
}

#[cfg(target_os = "windows")]
pub(crate) fn read_core_permission_mode_before_tauri() -> Result<String, String> {
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
pub(crate) fn resolve_routex_run_binary_before_tauri() -> Result<PathBuf, String> {
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
pub(crate) fn copy_routex_run_binary_for_task_before_tauri() -> Result<(), String> {
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
pub(crate) fn write_elevate_task_params_before_tauri() -> Result<(), String> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    let value = serde_json::to_string(&args).map_err(|e| e.to_string())?;
    fs::write(routex_run_args_path_before_tauri()?, value).map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
pub(crate) fn check_elevate_task_matches_current_app_before_tauri() -> bool {
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
pub(crate) fn run_elevate_task_before_tauri() -> Result<(), String> {
    write_elevate_task_params_before_tauri()?;
    copy_routex_run_binary_for_task_before_tauri()?;
    schtasks_command(&["/run", "/tn", routex_run_task_name()])
}

#[cfg(target_os = "windows")]
pub(crate) fn run_matching_elevate_task_before_tauri(create_error: &str) -> Result<bool, String> {
    match run_elevate_task_before_tauri() {
        Ok(()) => Ok(false),
        Err(run_error) => {
            show_windows_startup_relaunch_failed_dialog(create_error, &run_error);
            Ok(true)
        }
    }
}

#[cfg(target_os = "windows")]
pub(crate) fn single_instance_window_exists_before_tauri(app_identifier: &str) -> bool {
    #[link(name = "user32")]
    unsafe extern "system" {
        pub(crate) fn FindWindowW(
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
pub(crate) fn ensure_windows_elevated_startup_before_tauri(
    app_identifier: &str,
) -> Result<bool, String> {
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
pub(crate) fn prepare_windows_elevated_startup_before_tauri(app_identifier: &str) -> bool {
    match ensure_windows_elevated_startup_before_tauri(app_identifier) {
        Ok(continue_startup) => continue_startup,
        Err(error) => {
            eprintln!("pre-tauri elevated startup skipped: {error}");
            true
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn prepare_windows_elevated_startup_before_tauri(_app_identifier: &str) -> bool {
    true
}

#[cfg(target_os = "windows")]
pub(crate) fn show_windows_startup_admin_relaunch_failed_dialog(error: &str) {
    show_windows_startup_dialog(
        "管理员重启失败",
        "没有成功以管理员身份重启",
        "RouteX 将退出当前非管理员进程。请右键点击应用图标，选择“以管理员身份运行”。",
        Some(&format!("错误详情：{error}")),
    );
}

#[cfg(target_os = "windows")]
pub(crate) fn relaunch_current_app_as_admin() -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let current_dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let operation = to_wide_null("runas");
    let file = to_wide_null(&exe_path.to_string_lossy());
    let parameters = shell_execute_parameters(admin_relaunch_args(
        std::env::args().skip(1),
        std::process::id(),
    ));
    let parameters = to_wide_null(&parameters);
    let directory = to_wide_null(&current_dir.to_string_lossy());

    let result_code = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            operation.as_ptr(),
            file.as_ptr(),
            parameters.as_ptr(),
            directory.as_ptr(),
            SW_SHOWNORMAL,
        )
    } as isize;

    if result_code <= 32 {
        return Err(format!(
            "ShellExecuteW runas failed with code {result_code}"
        ));
    }

    Ok(())
}

#[cfg(target_os = "windows")]
pub(crate) fn handle_windows_unregistered_elevate_task(create_error: &str) {
    if !looks_like_windows_permission_error(create_error) {
        show_windows_startup_task_registration_failed_dialog(create_error);
        return;
    }

    if let Err(error) = relaunch_current_app_as_admin() {
        show_windows_startup_admin_relaunch_failed_dialog(&error);
    }
}

#[cfg(target_os = "windows")]
pub(crate) fn show_windows_startup_task_registration_failed_dialog(create_error: &str) {
    show_windows_startup_dialog(
        "提权任务注册失败",
        "任务计划没有注册成功",
        "请完全退出 RouteX（包括托盘后台），右键点击应用图标，选择“以管理员身份运行”后再打开一次。\r\n\r\n如果已经按管理员身份运行仍失败，通常是 Windows 任务计划程序创建失败，或被系统策略/安全软件拦截。",
        Some(&format!("错误详情：{create_error}")),
    );
}

#[cfg(target_os = "windows")]
pub(crate) fn show_windows_startup_relaunch_failed_dialog(create_error: &str, run_error: &str) {
    show_windows_startup_dialog(
        "自动提权启动失败",
        "没有成功拉起高权限实例",
        "已检测到提权任务，但自动拉起高权限实例失败。\r\n\r\n请到“内核设置 -> 任务状态”重新注册后再试。",
        Some(&format!("创建任务错误：{create_error}\r\n启动任务错误：{run_error}")),
    );
}

pub(crate) fn run_elevate_task(app: &tauri::AppHandle) -> Result<(), String> {
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
pub(crate) enum WindowsUnelevatedStartupAction {
    RunElevateTask,
    RequestAdminRegistration,
}

pub(crate) fn choose_windows_unelevated_startup_action(
    elevate_task_matches_current_app: bool,
) -> WindowsUnelevatedStartupAction {
    if elevate_task_matches_current_app {
        WindowsUnelevatedStartupAction::RunElevateTask
    } else {
        WindowsUnelevatedStartupAction::RequestAdminRegistration
    }
}

#[cfg(target_os = "windows")]
pub(crate) fn handle_windows_elevated_process_startup(
    app: &tauri::AppHandle,
) -> Result<bool, String> {
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
pub(crate) fn handle_windows_unelevated_process_startup(
    app: &tauri::AppHandle,
) -> Result<bool, String> {
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

pub(crate) fn ensure_elevated_startup(app: &tauri::AppHandle) -> Result<bool, String> {
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
