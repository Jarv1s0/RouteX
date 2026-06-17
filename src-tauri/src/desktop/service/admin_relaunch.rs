#![allow(unused_imports)]
use crate::desktop::prelude::*;
use crate::desktop::*;
use super::*;

#[cfg(target_os = "windows")]
pub const SW_SHOWNORMAL: i32 = 1;

#[cfg(target_os = "windows")]
pub const SYNCHRONIZE: u32 = 0x00100000;

#[cfg(target_os = "windows")]
pub const ADMIN_RELAUNCH_PARENT_WAIT_MS: u32 = 15_000;

#[cfg(target_os = "windows")]
pub fn shell_execute_quote_arg(value: &str) -> String {
    if value.is_empty() {
        return "\"\"".to_string();
    }

    if !value.chars().any(|ch| ch.is_whitespace() || ch == '"') {
        return value.to_string();
    }

    format!("\"{}\"", value.replace('"', "\\\""))
}

#[cfg(target_os = "windows")]
pub fn shell_execute_parameters(args: impl IntoIterator<Item = String>) -> String {
    args.into_iter()
        .map(|arg| shell_execute_quote_arg(&arg))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(target_os = "windows")]
pub fn admin_relaunch_args(
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
pub fn admin_relaunch_parent_pid() -> Option<u32> {
    let mut args = std::env::args();
    while let Some(arg) = args.next() {
        if arg.eq_ignore_ascii_case(ROUTEX_ADMIN_RELAUNCH_PARENT_ARG) {
            return args.next().and_then(|value| value.parse::<u32>().ok());
        }
    }
    None
}

#[cfg(target_os = "windows")]
pub fn wait_for_process_exit(process_id: u32) {
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
pub fn wait_for_admin_relaunch_parent_exit() {
    if let Some(process_id) = admin_relaunch_parent_pid() {
        wait_for_process_exit(process_id);
    }
}

#[cfg(not(target_os = "windows"))]
pub fn wait_for_admin_relaunch_parent_exit() {}

#[cfg(target_os = "windows")]
pub fn relaunch_current_app_as_admin() -> Result<(), String> {
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
