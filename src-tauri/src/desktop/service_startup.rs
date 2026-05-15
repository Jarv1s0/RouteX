#[cfg(target_os = "windows")]
const MB_OK: u32 = 0x00000000;
#[cfg(target_os = "windows")]
const MB_ICONWARNING: u32 = 0x00000030;
#[cfg(target_os = "windows")]
const MB_SETFOREGROUND: u32 = 0x00010000;
#[cfg(target_os = "windows")]
const MB_TOPMOST: u32 = 0x00040000;

#[cfg(target_os = "windows")]
#[link(name = "user32")]
unsafe extern "system" {
    fn MessageBoxW(
        hwnd: *mut std::ffi::c_void,
        text: *const u16,
        caption: *const u16,
        message_type: u32,
    ) -> i32;
}

#[cfg(target_os = "windows")]
fn to_wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(target_os = "windows")]
fn show_windows_startup_dialog(title: &str, heading: &str, message: &str, detail: Option<&str>) {
    let text = match detail.filter(|value| !value.trim().is_empty()) {
        Some(detail) => format!("{heading}\r\n\r\n{message}\r\n\r\n{detail}"),
        None => format!("{heading}\r\n\r\n{message}"),
    };
    let title = to_wide_null(title);
    let text = to_wide_null(&text);

    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            text.as_ptr(),
            title.as_ptr(),
            MB_OK | MB_ICONWARNING | MB_SETFOREGROUND | MB_TOPMOST,
        );
    }
}

#[cfg(target_os = "windows")]
fn show_windows_startup_admin_required_dialog() -> bool {
    let script = r#"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = '首次启动需要管理员权限'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(460, 245)
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true
$form.ShowIcon = $false

$title = New-Object System.Windows.Forms.Label
$title.Text = '需要完成一次管理员授权'
$title.Font = New-Object System.Drawing.Font($form.Font.FontFamily, 11, [System.Drawing.FontStyle]::Bold)
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(24, 22)
$form.Controls.Add($title)

$message = New-Object System.Windows.Forms.Label
$message.Text = 'RouteX 首次安装后需要以管理员身份启动一次，用于注册提权任务。注册完成后，后续可以直接双击正常打开，不需要每次手动管理员运行。'
$message.Location = New-Object System.Drawing.Point(24, 58)
$message.Size = New-Object System.Drawing.Size(400, 80)
$form.Controls.Add($message)

$restartButton = New-Object System.Windows.Forms.Button
$restartButton.Text = '以管理员身份重启'
$restartButton.Size = New-Object System.Drawing.Size(136, 32)
$restartButton.Location = New-Object System.Drawing.Point(164, 156)
$restartButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.Controls.Add($restartButton)

$exitButton = New-Object System.Windows.Forms.Button
$exitButton.Text = '退出'
$exitButton.Size = New-Object System.Drawing.Size(92, 32)
$exitButton.Location = New-Object System.Drawing.Point(316, 156)
$exitButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($exitButton)

$form.AcceptButton = $restartButton
$form.CancelButton = $exitButton

if ($form.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  'relaunch'
} else {
  'exit'
}
"#;

    match run_powershell_script(script) {
        Ok(output) => output.trim().eq_ignore_ascii_case("relaunch"),
        Err(error) => {
            show_windows_startup_dialog(
                "首次启动需要管理员权限",
                "需要完成一次管理员授权",
                "RouteX 首次安装后需要以管理员身份启动一次。请退出后右键点击应用图标，选择“以管理员身份运行”。",
                Some(&format!("弹窗显示失败：{error}")),
            );
            false
        }
    }
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
    let args = std::env::args()
        .skip(1)
        .map(|arg| powershell_single_quoted(&arg))
        .collect::<Vec<_>>()
        .join(", ");
    let argument_list = if args.is_empty() {
        "@()".to_string()
    } else {
        format!("@({args})")
    };
    let script = format!(
        r#"
try {{
  Wait-Process -Id {current_pid} -Timeout 10 -ErrorAction SilentlyContinue
}} catch {{}}
Start-Process -FilePath {} -ArgumentList {} -WorkingDirectory {} -Verb RunAs
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

    if show_windows_startup_admin_required_dialog() {
        if let Err(error) = relaunch_current_app_as_admin() {
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
