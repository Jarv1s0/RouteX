#[cfg(target_os = "windows")]
const TDF_ALLOW_DIALOG_CANCELLATION: u32 = 0x0008;
#[cfg(target_os = "windows")]
const TDF_SIZE_TO_CONTENT: u32 = 0x01000000;
#[cfg(target_os = "windows")]
const TDCBF_OK_BUTTON: u32 = 0x0001;
#[cfg(target_os = "windows")]
const TD_WARNING_ICON: *const u16 = (-1isize) as *const u16;
#[cfg(target_os = "windows")]
const TD_SHIELD_ICON: *const u16 = (-4isize) as *const u16;
#[cfg(target_os = "windows")]
const STARTUP_ADMIN_RELAUNCH_BUTTON_ID: i32 = 1001;
#[cfg(target_os = "windows")]
const STARTUP_ADMIN_EXIT_BUTTON_ID: i32 = 1002;

#[cfg(target_os = "windows")]
#[repr(C)]
struct TaskDialogButton {
    button_id: i32,
    button_text: *const u16,
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct TaskDialogConfig {
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
    callback: Option<
        unsafe extern "system" fn(
            *mut std::ffi::c_void,
            u32,
            usize,
            isize,
            isize,
        ) -> i32,
    >,
    callback_data: isize,
    width: u32,
}

#[cfg(target_os = "windows")]
#[link(name = "comctl32")]
unsafe extern "system" {
    fn TaskDialogIndirect(
        config: *const TaskDialogConfig,
        button: *mut i32,
        radio_button: *mut i32,
        verification_flag_checked: *mut i32,
    ) -> i32;
}

#[cfg(target_os = "windows")]
fn to_wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(target_os = "windows")]
fn startup_task_dialog_config(
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
fn show_windows_startup_dialog(title: &str, heading: &str, message: &str, detail: Option<&str>) {
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
fn show_windows_startup_admin_required_dialog() -> bool {
    let title = to_wide_null("首次启动需要管理员权限");
    let heading = to_wide_null("需要完成一次管理员授权");
    let message = to_wide_null(
        "RouteX 首次安装后需要以管理员身份启动一次，用于注册提权任务。\r\n注册完成后，后续可以直接双击正常打开，不需要每次手动管理员运行。",
    );
    let relaunch = to_wide_null("以管理员身份重启");
    let exit = to_wide_null("退出");
    let buttons = [
        TaskDialogButton {
            button_id: STARTUP_ADMIN_RELAUNCH_BUTTON_ID,
            button_text: relaunch.as_ptr(),
        },
        TaskDialogButton {
            button_id: STARTUP_ADMIN_EXIT_BUTTON_ID,
            button_text: exit.as_ptr(),
        },
    ];
    let mut config = startup_task_dialog_config(
        title.as_ptr(),
        TD_SHIELD_ICON,
        heading.as_ptr(),
        message.as_ptr(),
    );
    config.button_count = buttons.len() as u32;
    config.buttons = buttons.as_ptr();
    config.default_button = STARTUP_ADMIN_RELAUNCH_BUTTON_ID;
    let mut selected_button = 0;
    let result = unsafe {
        TaskDialogIndirect(
            &config,
            &mut selected_button,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    result == 0 && selected_button == STARTUP_ADMIN_RELAUNCH_BUTTON_ID
}

#[cfg(target_os = "windows")]
fn show_windows_startup_admin_relaunch_failed_dialog(error: &str) {
    show_windows_startup_dialog(
        "管理员重启失败",
        "没有成功以管理员身份重启",
        "RouteX 将退出当前非管理员进程。请右键点击应用图标，选择“以管理员身份运行”。",
        Some(&format!("错误详情：{error}")),
    );
}

#[cfg(target_os = "windows")]
fn relaunch_current_app_as_admin() -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let current_dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let current_pid = std::process::id();
    let argument_list = std::env::args()
        .skip(1)
        .map(|arg| powershell_single_quoted(&arg))
        .collect::<Vec<_>>()
        .join(", ");
    let argument_list = if argument_list.is_empty() {
        String::new()
    } else {
        format!(" -ArgumentList @({argument_list})")
    };
    let script = format!(
        r#"
Wait-Process -Id {current_pid} -Timeout 10 -ErrorAction SilentlyContinue
Start-Process -FilePath {}{} -WorkingDirectory {} -Verb RunAs
"#,
        powershell_single_quoted(&exe_path.to_string_lossy()),
        argument_list,
        powershell_single_quoted(&current_dir.to_string_lossy())
    );
    let encoded = encode_powershell_script(&script);

    powershell_command()
        .args(["-NoProfile", "-EncodedCommand", &encoded])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn handle_windows_unregistered_elevate_task(create_error: &str) {
    if !looks_like_windows_permission_error(create_error) {
        show_windows_startup_task_registration_failed_dialog(create_error);
        return;
    }

    if let Err(error) = relaunch_current_app_as_admin() {
        if show_windows_startup_admin_required_dialog() {
            show_windows_startup_admin_relaunch_failed_dialog(&error);
        }
    }
}

#[cfg(target_os = "windows")]
fn show_windows_startup_task_registration_failed_dialog(create_error: &str) {
    show_windows_startup_dialog(
        "提权任务注册失败",
        "任务计划没有注册成功",
        "请完全退出 RouteX（包括托盘后台），右键点击应用图标，选择“以管理员身份运行”后再打开一次。\r\n\r\n如果已经按管理员身份运行仍失败，通常是 Windows 任务计划程序创建失败，或被系统策略/安全软件拦截。",
        Some(&format!("错误详情：{create_error}")),
    );
}

#[cfg(target_os = "windows")]
fn show_windows_startup_relaunch_failed_dialog(create_error: &str, run_error: &str) {
    show_windows_startup_dialog(
        "自动提权启动失败",
        "没有成功拉起高权限实例",
        "已检测到提权任务，但自动拉起高权限实例失败。\r\n\r\n请到“内核设置 -> 任务状态”重新注册后再试。",
        Some(&format!("创建任务错误：{create_error}\r\n启动任务错误：{run_error}")),
    );
}

fn run_elevate_task(app: &tauri::AppHandle) -> Result<(), String> {
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

fn ensure_elevated_startup(app: &tauri::AppHandle) -> Result<bool, String> {
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

        match create_elevate_task(app) {
            Ok(()) => Ok(true),
            Err(create_error) => {
                if !check_elevate_task_matches_current_app(app) {
                    handle_windows_unregistered_elevate_task(&create_error);
                    return Ok(false);
                }

                match run_elevate_task(app) {
                    Ok(()) => Ok(false),
                    Err(run_error) => {
                        show_windows_startup_relaunch_failed_dialog(&create_error, &run_error);
                        Ok(true)
                    }
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
