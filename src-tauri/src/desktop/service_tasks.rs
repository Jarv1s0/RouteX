fn config_bool_string(config: &Value, key: &str) -> String {
    config
        .get(key)
        .and_then(Value::as_bool)
        .unwrap_or(false)
        .to_string()
}

fn task_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    ensure_dir(app_data_root(app)?.join(TASKS_DIR_NAME))
}

fn routex_run_binary_task_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(task_dir(app)?.join(ROUTEX_RUN_BINARY))
}

fn routex_run_task_xml_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(task_dir(app)?.join(ROUTEX_RUN_XML))
}

fn routex_run_args_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(task_dir(app)?.join(ROUTEX_RUN_ARGS_FILE))
}

fn routex_autorun_task_xml_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(task_dir(app)?.join(ROUTEX_AUTORUN_XML))
}

fn resolve_routex_run_binary(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    resolve_resource_binary(app, "files", ROUTEX_RUN_BINARY)
        .map_err(|_| format!("RouteX run helper not found: {ROUTEX_RUN_BINARY}"))
}

fn write_elevate_task_params(app: &tauri::AppHandle) -> Result<(), String> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    let value = serde_json::to_string(&args).map_err(|e| e.to_string())?;
    fs::write(routex_run_args_path(app)?, value).map_err(|e| e.to_string())
}

fn file_sha256(path: &Path) -> Result<[u8; 32], String> {
    let mut file =
        fs::File::open(path).map_err(|e| format!("读取文件失败 {}: {e}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let read_len = file
            .read(&mut buffer)
            .map_err(|e| format!("读取文件失败 {}: {e}", path.display()))?;
        if read_len == 0 {
            break;
        }
        hasher.update(&buffer[..read_len]);
    }

    let digest = hasher.finalize();
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(&digest);
    Ok(bytes)
}

fn copy_routex_run_binary_for_task(app: &tauri::AppHandle) -> Result<(), String> {
    let routex_run_dest = routex_run_binary_task_path(app)?;
    let routex_run_source = resolve_routex_run_binary(app)?;
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

fn ensure_routex_run_binary_for_task(app: &tauri::AppHandle) -> Result<(), String> {
    copy_routex_run_binary_for_task(app)
}

fn encode_utf16le_with_bom(value: &str) -> Vec<u8> {
    let mut bytes = vec![0xFF, 0xFE];
    for code_unit in value.encode_utf16() {
        bytes.extend_from_slice(&code_unit.to_le_bytes());
    }
    bytes
}

#[cfg(target_os = "windows")]
fn resolve_windows_system_binary(binary: &str) -> PathBuf {
    for key in ["SystemRoot", "windir", "WINDIR"] {
        if let Some(root) = std::env::var_os(key) {
            let candidate = PathBuf::from(root).join("System32").join(binary);
            if candidate.exists() {
                return candidate;
            }
        }
    }

    PathBuf::from(binary)
}

#[cfg(target_os = "windows")]
fn schtasks_output(args: &[&str]) -> Result<std::process::Output, String> {
    let schtasks_path = resolve_windows_system_binary("schtasks.exe");
    let mut command = Command::new(&schtasks_path);
    apply_background_command(&mut command);
    command
        .args(args)
        .output()
        .map_err(|e| format!("{}: {e}", schtasks_path.display()))
}

#[cfg(target_os = "windows")]
fn decode_windows_code_page_output(bytes: &[u8], code_page: u32) -> Option<String> {
    if bytes.is_empty() || code_page == 0 {
        return Some(String::new());
    }

    let input_len = i32::try_from(bytes.len()).ok()?;
    let output_len = unsafe {
        MultiByteToWideChar(
            code_page,
            0,
            bytes.as_ptr() as *const i8,
            input_len,
            std::ptr::null_mut(),
            0,
        )
    };
    if output_len <= 0 {
        return None;
    }

    let mut buffer = vec![0u16; output_len as usize];
    let written = unsafe {
        MultiByteToWideChar(
            code_page,
            0,
            bytes.as_ptr() as *const i8,
            input_len,
            buffer.as_mut_ptr(),
            output_len,
        )
    };
    if written <= 0 {
        return None;
    }

    Some(String::from_utf16_lossy(&buffer[..written as usize]))
}

#[cfg(target_os = "windows")]
fn decode_windows_process_output(bytes: &[u8]) -> String {
    if bytes.is_empty() {
        return String::new();
    }

    if let Ok(text) = std::str::from_utf8(bytes) {
        return text.trim().trim_matches('\0').to_string();
    }

    let mut code_pages = vec![unsafe { GetOEMCP() }, unsafe { GetACP() }, 936];
    code_pages.dedup();
    for code_page in code_pages {
        if let Some(text) = decode_windows_code_page_output(bytes, code_page) {
            let text = text.trim().trim_matches('\0').to_string();
            if !text.is_empty() {
                return text;
            }
        }
    }

    let preview = bytes
        .iter()
        .take(64)
        .map(|byte| format!("{byte:02X}"))
        .collect::<Vec<_>>()
        .join(" ");
    format!("无法解码错误输出（{} 字节）：{preview}", bytes.len())
}

#[cfg(target_os = "windows")]
fn schtasks_command(args: &[&str]) -> Result<(), String> {
    let output = schtasks_output(args)?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = decode_windows_process_output(&output.stderr);
    let stdout = decode_windows_process_output(&output.stdout);
    if !stderr.is_empty() {
        Err(stderr)
    } else if !stdout.is_empty() {
        Err(stdout)
    } else {
        Err(format!("schtasks failed: {}", output.status))
    }
}

#[cfg(target_os = "windows")]
fn looks_like_windows_permission_error(error: &str) -> bool {
    let lower = error.to_ascii_lowercase();
    lower.contains("access is denied")
        || lower.contains("elevation")
        || lower.contains("privilege")
        || error.contains("拒绝访问")
        || error.contains("权限")
        || error.contains("提升")
}

#[cfg(target_os = "windows")]
fn check_windows_process_elevated() -> Result<bool, String> {
    let output = run_powershell_script(
        r#"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal -ArgumentList $identity
$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
"#,
    )?;
    Ok(output.trim().eq_ignore_ascii_case("true"))
}

#[cfg(target_os = "windows")]
fn require_windows_process_elevated_for_task_registration() -> Result<(), String> {
    match check_windows_process_elevated() {
        Ok(true) => Ok(()),
        Ok(false) => Err(
            "当前 RouteX 进程没有管理员权限，无法注册提权任务。请先完全退出 RouteX（包括托盘后台），再右键应用图标选择“以管理员身份运行”。"
                .to_string(),
        ),
        Err(error) => Err(format!("无法确认当前 RouteX 进程是否具有管理员权限: {error}")),
    }
}

fn build_routex_run_task_xml(app: &tauri::AppHandle) -> Result<String, String> {
    let routex_run_path = routex_run_binary_task_path(app)?;
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers />
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>3</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>"{}"</Command>
      <Arguments>"{}"</Arguments>
    </Exec>
  </Actions>
</Task>
"#,
        routex_run_path.display(),
        exe_path.display()
    ))
}

fn build_routex_autorun_task_xml(app: &tauri::AppHandle) -> Result<String, String> {
    let routex_run_path = routex_run_binary_task_path(app)?;
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <Delay>PT3S</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>3</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>"{}"</Command>
      <Arguments>"{}" {}</Arguments>
    </Exec>
  </Actions>
</Task>
"#,
        routex_run_path.display(),
        exe_path.display(),
        ROUTEX_STARTUP_ARG
    ))
}

#[cfg(target_os = "windows")]
fn check_windows_task_matches_current_app(
    task_name: &str,
    app: &tauri::AppHandle,
    required_argument: Option<&str>,
) -> bool {
    let routex_run_path = match routex_run_binary_task_path(app) {
        Ok(path) => path,
        Err(_) => return false,
    };
    let exe_path = match std::env::current_exe() {
        Ok(path) => path,
        Err(_) => return false,
    };
    let output = match schtasks_output(&["/query", "/tn", task_name, "/xml"]) {
        Ok(output) if output.status.success() => output,
        _ => return false,
    };
    let xml = String::from_utf8_lossy(&output.stdout);
    let routex_run_path = routex_run_path.to_string_lossy();
    let exe_path = exe_path.to_string_lossy();

    xml.contains(routex_run_path.as_ref())
        && xml.contains(exe_path.as_ref())
        && required_argument
            .map(|argument| xml.contains(argument))
            .unwrap_or(true)
}

fn create_autorun_task(app: &tauri::AppHandle) -> Result<(), String> {
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

fn delete_autorun_task() -> Result<(), String> {
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

fn check_autorun_task() -> bool {
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
fn check_autorun_task_matches_current_app(app: &tauri::AppHandle) -> bool {
    check_windows_task_matches_current_app(
        routex_autorun_task_name(),
        app,
        Some(ROUTEX_STARTUP_ARG),
    )
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn user_home_dir() -> Result<PathBuf, String> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "无法解析用户主目录".to_string())
}

#[cfg(target_os = "macos")]
fn macos_login_item_name() -> Result<String, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(exe_path
        .to_string_lossy()
        .split(".app")
        .next()
        .unwrap_or_default()
        .replace("/Applications/", ""))
}

#[cfg(target_os = "macos")]
fn check_autorun_macos() -> Result<bool, String> {
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
fn enable_autorun_macos() -> Result<(), String> {
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
fn disable_autorun_macos() -> Result<(), String> {
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
fn linux_autostart_file_path() -> Result<PathBuf, String> {
    Ok(user_home_dir()?
        .join(".config")
        .join("autostart")
        .join(ROUTEX_DESKTOP_NAME))
}

#[cfg(target_os = "linux")]
fn escape_desktop_exec_arg(value: &str) -> String {
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
fn linux_autostart_desktop_entry() -> Result<String, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(format!(
        "[Desktop Entry]\nName=RouteX\nExec={} {} %U\nTerminal=false\nType=Application\nIcon=routex\nStartupWMClass=routex\nComment=RouteX\nCategories=Utility;\n",
        escape_desktop_exec_arg(exe_path.to_string_lossy().as_ref()),
        ROUTEX_STARTUP_ARG
    ))
}

fn check_auto_run_enabled(app: &tauri::AppHandle) -> Result<bool, String> {
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

fn enable_auto_run(app: &tauri::AppHandle) -> Result<(), String> {
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

fn disable_auto_run() -> Result<(), String> {
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

fn create_elevate_task(app: &tauri::AppHandle) -> Result<(), String> {
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
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("当前平台未实现任务计划授权".to_string())
    }
}

fn delete_elevate_task() -> Result<(), String> {
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

fn check_elevate_task() -> bool {
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
fn check_elevate_task_matches_current_app(app: &tauri::AppHandle) -> bool {
    check_windows_task_matches_current_app(routex_run_task_name(), app, None)
}

