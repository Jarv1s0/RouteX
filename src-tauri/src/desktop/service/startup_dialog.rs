#![allow(unused_imports)]
use super::*;
use crate::desktop::prelude::*;
use crate::desktop::*;

#[cfg(target_os = "windows")]
pub const TDF_ALLOW_DIALOG_CANCELLATION: u32 = 0x0008;

#[cfg(target_os = "windows")]
pub const TDF_SIZE_TO_CONTENT: u32 = 0x01000000;

#[cfg(target_os = "windows")]
pub const TDCBF_OK_BUTTON: u32 = 0x0001;

#[cfg(target_os = "windows")]
pub const TD_WARNING_ICON: *const u16 = (-1isize) as *const u16;

#[cfg(target_os = "windows")]
#[repr(C)]
pub struct TaskDialogButton {
    button_id: i32,
    button_text: *const u16,
}

#[cfg(target_os = "windows")]
#[repr(C)]
pub struct TaskDialogConfig {
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
    pub fn TaskDialogIndirect(
        config: *const TaskDialogConfig,
        button: *mut i32,
        radio_button: *mut i32,
        verification_flag_checked: *mut i32,
    ) -> i32;
}

#[cfg(target_os = "windows")]
#[link(name = "shell32")]
unsafe extern "system" {
    pub fn ShellExecuteW(
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
    pub fn OpenProcess(
        desired_access: u32,
        inherit_handle: i32,
        process_id: u32,
    ) -> *mut std::ffi::c_void;
    pub fn WaitForSingleObject(handle: *mut std::ffi::c_void, milliseconds: u32) -> u32;
    pub fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
}

#[cfg(target_os = "windows")]
pub fn to_wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(target_os = "windows")]
pub fn startup_task_dialog_config(
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
pub fn show_windows_startup_dialog(
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
pub fn show_windows_startup_admin_relaunch_failed_dialog(error: &str) {
    show_windows_startup_dialog(
        "管理员重启失败",
        "没有成功以管理员身份重启",
        "RouteX 将退出当前非管理员进程。请右键点击应用图标，选择“以管理员身份运行”。",
        Some(&format!("错误详情：{error}")),
    );
}

#[cfg(target_os = "windows")]
pub fn show_windows_startup_task_registration_failed_dialog(create_error: &str) {
    show_windows_startup_dialog(
        "提权任务注册失败",
        "任务计划没有注册成功",
        "请完全退出 RouteX（包括托盘后台），右键点击应用图标，选择“以管理员身份运行”后再打开一次。\r
\r
如果已经按管理员身份运行仍失败，通常是 Windows 任务计划程序创建失败，或被系统策略/安全软件拦截。",
        Some(&format!("错误详情：{create_error}")),
    );
}

#[cfg(target_os = "windows")]
pub fn show_windows_startup_relaunch_failed_dialog(create_error: &str, run_error: &str) {
    show_windows_startup_dialog(
        "自动提权启动失败",
        "没有成功拉起高权限实例",
        "已检测到提权任务，但自动拉起高权限实例失败。\r
\r
请到“内核设置 -> 任务状态”重新注册后再试。",
        Some(&format!(
            "创建任务错误：{create_error}\r
启动任务错误：{run_error}"
        )),
    );
}
