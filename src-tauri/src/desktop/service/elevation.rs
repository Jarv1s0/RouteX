use super::*;
use crate::desktop::prelude::*;
use crate::desktop::*;

#[cfg(target_os = "windows")]
pub fn looks_like_windows_permission_error(error: &str) -> bool {
    let lower = error.to_ascii_lowercase();
    lower.contains("access is denied")
        || lower.contains("elevation")
        || lower.contains("privilege")
        || error.contains("拒绝访问")
        || error.contains("权限")
        || error.contains("提升")
}

#[cfg(target_os = "windows")]
struct WindowsHandle(windows_sys::Win32::Foundation::HANDLE);

#[cfg(target_os = "windows")]
impl Drop for WindowsHandle {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe {
                windows_sys::Win32::Foundation::CloseHandle(self.0);
            }
        }
    }
}

#[cfg(target_os = "windows")]
pub fn check_windows_process_elevated() -> Result<bool, String> {
    use windows_sys::Win32::{
        Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY},
        System::Threading::{GetCurrentProcess, OpenProcessToken},
    };

    let mut token = std::ptr::null_mut();
    let opened = unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) };
    if opened == 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    let token = WindowsHandle(token);

    let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
    let mut return_length = 0u32;
    let queried = unsafe {
        GetTokenInformation(
            token.0,
            TokenElevation,
            &mut elevation as *mut TOKEN_ELEVATION as *mut std::ffi::c_void,
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut return_length,
        )
    };
    if queried == 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }

    Ok(elevation.TokenIsElevated != 0)
}

#[cfg(target_os = "windows")]
pub fn require_windows_process_elevated_for_task_registration() -> Result<(), String> {
    match check_windows_process_elevated() {
        Ok(true) => Ok(()),
        Ok(false) => Err(
            "当前 RouteX 进程没有管理员权限，无法注册提权任务。请先完全退出 RouteX（包括托盘后台），再右键应用图标选择“以管理员身份运行”。"
                .to_string(),
        ),
        Err(error) => Err(format!("无法确认当前 RouteX 进程是否具有管理员权限: {error}")),
    }
}

pub fn create_elevate_task(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        require_windows_process_elevated_for_task_registration()?;

        let task_file_path = routex_run_task_xml_path(app)?;
        let task_xml = build_routex_run_task_xml(app)?;

        fs::write(&task_file_path, encode_utf16le_with_bom(&task_xml))
            .map_err(|e| e.to_string())?;
        copy_routex_run_binary_for_task(app)?;
        schtasks_command(&[
            "/create",
            "/tn",
            routex_run_task_name(),
            "/xml",
            task_file_path
                .to_str()
                .ok_or_else(|| "invalid task xml path".to_string())?,
            "/f",
        ])?;
        cleanup_legacy_runtime_tasks(&app_data_root(app)?)?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("当前平台未实现任务计划授权".to_string())
    }
}

pub fn delete_elevate_task() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        match schtasks_command(&["/delete", "/tn", routex_run_task_name(), "/f"]) {
            Ok(()) => Ok(()),
            Err(error) if error.to_ascii_lowercase().contains("cannot find") => Ok(()),
            Err(error) if error.contains("找不到") => Ok(()),
            Err(error) => Err(error),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

pub fn check_elevate_task() -> bool {
    #[cfg(target_os = "windows")]
    {
        schtasks_command(&["/query", "/tn", routex_run_task_name()]).is_ok()
    }

    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[cfg(target_os = "windows")]
pub fn check_elevate_task_matches_current_app(app: &tauri::AppHandle) -> bool {
    check_windows_task_matches_current_app(routex_run_task_name(), app, None)
}
