use super::prelude::*;
use super::*;

#[cfg(not(target_os = "windows"))]
pub(crate) fn has_elevated_permission_flag(permissions: &str) -> bool {
    permissions.contains('s') || permissions.contains('S')
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn parse_ls_permissions(stdout: &str) -> &str {
    stdout.split_whitespace().next().unwrap_or_default()
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn is_user_cancelled_error(message: &str) -> bool {
    message.contains("用户已取消")
        || message.contains("用户取消操作")
        || message.contains("User canceled")
        || message.contains("UserCancelledError")
        || message.contains("(-128)")
        || message.contains("user cancelled")
        || message.contains("dismissed")
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn collect_command_error(output: std::process::Output) -> Result<String, String> {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        return Ok(stdout);
    }

    if is_user_cancelled_error(&stderr) || is_user_cancelled_error(&stdout) {
        return Err("UserCancelledError".to_string());
    }

    if !stderr.is_empty() {
        Err(stderr)
    } else if !stdout.is_empty() {
        Err(stdout)
    } else {
        Err(format!("命令执行失败: {}", output.status))
    }
}

pub(crate) fn check_core_permission_value(app: &tauri::AppHandle) -> Result<Value, String> {
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        Ok(json!({
            "mihomo": false,
            "mihomo-alpha": false,
        }))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let check_permission = |core_name: &str| -> bool {
            let Ok(core_path) = resolve_core_binary(app, core_name) else {
                return false;
            };
            let Ok(output) = Command::new("ls")
                .args(["-l", &core_path.to_string_lossy()])
                .output()
            else {
                return false;
            };
            if !output.status.success() {
                return false;
            }
            let stdout = String::from_utf8_lossy(&output.stdout);
            has_elevated_permission_flag(parse_ls_permissions(&stdout))
        };

        Ok(json!({
            "mihomo": check_permission("mihomo"),
            "mihomo-alpha": check_permission("mihomo-alpha"),
        }))
    }
}

pub(crate) fn validate_core_permission_targets(
    cores: Option<Vec<String>>,
) -> Result<Vec<String>, String> {
    let targets = cores.unwrap_or_else(|| vec!["mihomo".to_string(), "mihomo-alpha".to_string()]);
    for core_name in &targets {
        if !matches!(core_name.as_str(), "mihomo" | "mihomo-alpha") {
            return Err(format!("不支持的内核名称: {core_name}"));
        }
    }
    Ok(targets)
}

pub(crate) fn manual_grant_core_permission(
    app: &tauri::AppHandle,
    cores: Option<Vec<String>>,
) -> Result<(), String> {
    let target_cores = validate_core_permission_targets(cores)?;
    #[cfg(target_os = "windows")]
    {
        let _ = target_cores;
        return create_elevate_task(app);
    }

    #[cfg(target_os = "macos")]
    {
        for core_name in target_cores {
            let core_path = resolve_core_binary(app, &core_name)?;
            let core_path_str = core_path
                .to_str()
                .ok_or_else(|| "内核路径包含无效编码".to_string())?;
            let output = Command::new("osascript")
                .args([
                    "-e",
                    "on run argv",
                    "-e",
                    r#"do shell script "chown root:admin " & quoted form of item 1 of argv & " && chmod +sx " & quoted form of item 1 of argv with administrator privileges"#,
                    "-e",
                    "end run",
                    core_path_str,
                ])
                .output()
                .map_err(|e| e.to_string())?;
            collect_command_error(output)?;
        }
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        for core_name in target_cores {
            let core_path = resolve_core_binary(app, &core_name)?;
            let core_path_str = core_path
                .to_str()
                .ok_or_else(|| "内核路径包含无效编码".to_string())?;
            let output = Command::new("pkexec")
                .args([
                    "bash",
                    "-c",
                    r#"chown root:root "$1" && chmod +sx "$1""#,
                    "_",
                    core_path_str,
                ])
                .output()
                .map_err(|e| e.to_string())?;
            collect_command_error(output)?;
        }
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("当前平台未实现内核授权".to_string())
}

pub(crate) fn revoke_core_permission(
    app: &tauri::AppHandle,
    cores: Option<Vec<String>>,
) -> Result<(), String> {
    let target_cores = validate_core_permission_targets(cores)?;
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        let _ = target_cores;
        return delete_elevate_task();
    }

    #[cfg(target_os = "macos")]
    {
        for core_name in target_cores {
            let core_path = resolve_core_binary(app, &core_name)?;
            let core_path_str = core_path
                .to_str()
                .ok_or_else(|| "内核路径包含无效编码".to_string())?;
            let output = Command::new("osascript")
                .args([
                    "-e",
                    "on run argv",
                    "-e",
                    r#"do shell script "chmod a-s " & quoted form of item 1 of argv with administrator privileges"#,
                    "-e",
                    "end run",
                    core_path_str,
                ])
                .output()
                .map_err(|e| e.to_string())?;
            collect_command_error(output)?;
        }
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        for core_name in target_cores {
            let core_path = resolve_core_binary(app, &core_name)?;
            let core_path_str = core_path
                .to_str()
                .ok_or_else(|| "内核路径包含无效编码".to_string())?;
            let output = Command::new("pkexec")
                .args(["bash", "-c", r#"chmod a-s "$1""#, "_", core_path_str])
                .output()
                .map_err(|e| e.to_string())?;
            collect_command_error(output)?;
        }
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("当前平台未实现撤销内核授权".to_string())
}
