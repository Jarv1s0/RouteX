use super::*;
use crate::desktop::prelude::*;
use crate::desktop::*;

pub fn config_bool_string(config: &Value, key: &str) -> String {
    config
        .get(key)
        .and_then(Value::as_bool)
        .unwrap_or(false)
        .to_string()
}

pub fn create_autorun_task(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let task_file_path = routex_autorun_task_xml_path(app)?;
        let task_xml = build_routex_autorun_task_xml(app)?;

        fs::write(&task_file_path, encode_utf16le_with_bom(&task_xml))
            .map_err(|e| e.to_string())?;
        copy_routex_run_binary_for_task(app)?;
        schtasks_command(&[
            "/create",
            "/tn",
            routex_autorun_task_name(),
            "/xml",
            task_file_path
                .to_str()
                .ok_or_else(|| "invalid autorun task xml path".to_string())?,
            "/f",
        ])?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("当前平台未实现开机自启".to_string())
    }
}

pub fn delete_autorun_task() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        match schtasks_command(&["/delete", "/tn", routex_autorun_task_name(), "/f"]) {
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

pub fn check_autorun_task() -> bool {
    #[cfg(target_os = "windows")]
    {
        schtasks_command(&["/query", "/tn", routex_autorun_task_name()]).is_ok()
    }

    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[cfg(target_os = "windows")]
pub fn check_autorun_task_matches_current_app(app: &tauri::AppHandle) -> bool {
    check_windows_task_matches_current_app(
        routex_autorun_task_name(),
        app,
        Some(ROUTEX_STARTUP_ARG),
    )
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
pub fn user_home_dir() -> Result<PathBuf, String> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "无法解析用户主目录".to_string())
}

#[cfg(target_os = "macos")]
pub fn macos_login_item_name() -> Result<String, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(exe_path
        .to_string_lossy()
        .split(".app")
        .next()
        .unwrap_or_default()
        .replace("/Applications/", ""))
}

#[cfg(target_os = "macos")]
pub fn check_autorun_macos() -> Result<bool, String> {
    let login_item_name = macos_login_item_name()?;
    let output = Command::new("osascript")
        .args([
            "-e",
            r#"tell application "System Events" to get the name of every login item"#,
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("osascript 执行失败: {}", output.status)
        } else {
            stderr
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.contains(&login_item_name))
}

#[cfg(target_os = "macos")]
pub fn enable_autorun_macos() -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let app_path = format!(
        "{}.app",
        exe_path
            .to_string_lossy()
            .split(".app")
            .next()
            .unwrap_or_default()
    );
    let script = format!(
        r#"tell application "System Events" to make login item at end with properties {{path:"{}", hidden:false}}"#,
        app_path.replace('\\', "\\\\").replace('"', "\\\"")
    );
    let status = Command::new("osascript")
        .args(["-e", &script])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("osascript 执行失败: {status}"))
    }
}

#[cfg(target_os = "macos")]
pub fn disable_autorun_macos() -> Result<(), String> {
    let login_item_name = macos_login_item_name()?;
    let script = format!(
        r#"tell application "System Events" to delete login item "{}""#,
        login_item_name.replace('\\', "\\\\").replace('"', "\\\"")
    );
    let status = Command::new("osascript")
        .args(["-e", &script])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("osascript 执行失败: {status}"))
    }
}

#[cfg(target_os = "linux")]
pub fn linux_autostart_file_path() -> Result<PathBuf, String> {
    Ok(user_home_dir()?
        .join(".config")
        .join("autostart")
        .join(ROUTEX_DESKTOP_NAME))
}

#[cfg(target_os = "linux")]
pub fn escape_desktop_exec_arg(value: &str) -> String {
    let needs_quotes = value.chars().any(|ch| {
        matches!(
            ch,
            ' ' | '\t'
                | '\n'
                | '"'
                | '\''
                | '\\'
                | '>'
                | '<'
                | '~'
                | '|'
                | '&'
                | ';'
                | '$'
                | '*'
                | '?'
                | '#'
                | '('
                | ')'
                | '`'
        )
    });

    if !needs_quotes {
        return value.to_string();
    }

    format!(
        "\"{}\"",
        value
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('`', "\\`")
            .replace('$', "\\$")
    )
}

#[cfg(target_os = "linux")]
pub fn linux_autostart_desktop_entry() -> Result<String, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(format!(
        "[Desktop Entry]\nName=RouteX\nExec={} {} %U\nTerminal=false\nType=Application\nIcon=routex\nStartupWMClass=routex\nComment=RouteX\nCategories=Utility;\n",
        escape_desktop_exec_arg(exe_path.to_string_lossy().as_ref()),
        ROUTEX_STARTUP_ARG
    ))
}

pub fn check_auto_run_enabled(app: &tauri::AppHandle) -> Result<bool, String> {
    #[cfg(not(target_os = "windows"))]
    let _ = app;

    #[cfg(target_os = "windows")]
    {
        return Ok(check_autorun_task() && check_autorun_task_matches_current_app(app));
    }

    #[cfg(target_os = "macos")]
    {
        return check_autorun_macos();
    }

    #[cfg(target_os = "linux")]
    {
        let desktop_file_path = linux_autostart_file_path()?;
        if !desktop_file_path.exists() {
            return Ok(false);
        }

        let current = fs::read_to_string(desktop_file_path).map_err(|e| e.to_string())?;
        let expected = linux_autostart_desktop_entry()?;
        return Ok(current.trim() == expected.trim());
    }

    #[allow(unreachable_code)]
    Ok(false)
}

pub fn enable_auto_run(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        return create_autorun_task(app);
    }

    #[cfg(target_os = "macos")]
    {
        let _ = app;
        return enable_autorun_macos();
    }

    #[cfg(target_os = "linux")]
    {
        let _ = app;
        let desktop_file_path = linux_autostart_file_path()?;
        if let Some(parent) = desktop_file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(desktop_file_path, linux_autostart_desktop_entry()?)
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("当前平台未实现开机自启".to_string())
}

pub fn disable_auto_run() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        return delete_autorun_task();
    }

    #[cfg(target_os = "macos")]
    {
        return disable_autorun_macos();
    }

    #[cfg(target_os = "linux")]
    {
        let desktop_file_path = linux_autostart_file_path()?;
        if desktop_file_path.exists() {
            fs::remove_file(desktop_file_path).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("当前平台未实现开机自启".to_string())
}
