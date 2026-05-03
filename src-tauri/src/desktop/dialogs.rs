fn normalize_dialog_extensions(extensions: &[String]) -> Vec<String> {
    extensions
        .iter()
        .map(|ext| ext.trim().trim_start_matches('.').to_ascii_lowercase())
        .filter(|ext| !ext.is_empty())
        .collect()
}

#[cfg(not(target_os = "windows"))]
fn normalize_dialog_result(output: std::process::Output) -> Result<Option<String>, String> {
    match collect_command_error(output) {
        Ok(stdout) => {
            let value = stdout.trim().trim_matches('\0').to_string();
            if value.is_empty() {
                Ok(None)
            } else {
                Ok(Some(value))
            }
        }
        Err(error) if error == "UserCancelledError" => Ok(None),
        Err(error) => Err(error),
    }
}

#[cfg(target_os = "windows")]
fn powershell_single_quoted(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(target_os = "windows")]
fn encode_powershell_script(script: &str) -> String {
    let utf16 = script
        .encode_utf16()
        .flat_map(|unit| unit.to_le_bytes())
        .collect::<Vec<_>>();
    BASE64_STANDARD.encode(utf16)
}

#[cfg(target_os = "windows")]
fn run_powershell_script(script: &str) -> Result<String, String> {
    let encoded = encode_powershell_script(script);
    let output = powershell_command()
        .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &encoded])
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if output.status.success() {
        return Ok(stdout);
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !stderr.is_empty() {
        return Err(stderr);
    }
    if !stdout.is_empty() {
        return Err(stdout);
    }

    Err(format!("PowerShell 执行失败: {}", output.status))
}

#[cfg(target_os = "windows")]
fn run_interactive_powershell_script(script: &str) -> Result<std::process::Output, String> {
    let encoded = encode_powershell_script(script);
    powershell_command()
        .args(["-NoProfile", "-EncodedCommand", &encoded])
        .output()
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn windows_dialog_filter(extensions: &[String]) -> String {
    if extensions.is_empty() {
        return "所有文件 (*.*)|*.*".to_string();
    }

    let patterns = extensions
        .iter()
        .map(|ext| format!("*.{ext}"))
        .collect::<Vec<_>>();
    let joined_patterns = patterns.join(";");
    format!("支持的文件 ({joined_patterns})|{joined_patterns}|所有文件 (*.*)|*.*")
}

#[cfg(target_os = "windows")]
fn pick_open_file_paths_native(extensions: &[String]) -> Result<Option<Vec<String>>, String> {
    let filter = powershell_single_quoted(&windows_dialog_filter(extensions));
    let script = format!(
        r#"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '选择文件'
$dialog.Filter = {filter}
$dialog.Multiselect = $false
$dialog.CheckFileExists = $true
$dialog.RestoreDirectory = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{
  @($dialog.FileName) | ConvertTo-Json -Compress
}}
"#
    );

    let stdout = run_powershell_script(&script)?;
    if stdout.is_empty() {
        return Ok(None);
    }

    let files = serde_json::from_str::<Vec<String>>(&stdout).map_err(|e| e.to_string())?;
    let files = files
        .into_iter()
        .filter(|path| !path.trim().is_empty())
        .collect::<Vec<_>>();

    if files.is_empty() {
        return Ok(None);
    }

    Ok(Some(files))
}

#[cfg(not(target_os = "windows"))]
fn pick_open_file_paths_native(extensions: &[String]) -> Result<Option<Vec<String>>, String> {
    #[cfg(target_os = "macos")]
    {
        let _ = extensions;
        let output = Command::new("osascript")
            .args([
                "-e",
                r#"POSIX path of (choose file with prompt "选择文件")"#,
            ])
            .output()
            .map_err(|e| e.to_string())?;
        return Ok(normalize_dialog_result(output)?.map(|path| vec![path]));
    }

    #[cfg(target_os = "linux")]
    {
        let patterns = extensions
            .iter()
            .map(|ext| format!("*.{ext}"))
            .collect::<Vec<_>>();

        let mut run_backend = |backend: &str| -> Result<Option<Vec<String>>, String> {
            match backend {
                "kdialog" => {
                    let mut command = Command::new("kdialog");
                    command.arg("--getopenfilename").arg(".");
                    if !patterns.is_empty() {
                        command.arg(format!("{}|支持的文件", patterns.join(" ")));
                    }
                    let output = command.output().map_err(|e| e.to_string())?;
                    Ok(normalize_dialog_result(output)?.map(|path| vec![path]))
                }
                "zenity" | "qarma" => {
                    let mut command = Command::new(backend);
                    command.args(["--file-selection", "--title=选择文件"]);
                    if !patterns.is_empty() {
                        command.arg(format!("--file-filter=支持的文件 | {}", patterns.join(" ")));
                        command.arg("--file-filter=所有文件 | *");
                    }
                    let output = command.output().map_err(|e| e.to_string())?;
                    Ok(normalize_dialog_result(output)?.map(|path| vec![path]))
                }
                _ => Err("当前平台未实现原生打开文件对话框".to_string()),
            }
        };

        for backend in ["zenity", "qarma", "kdialog"] {
            if Command::new("sh")
                .args(["-c", &format!("command -v {backend} >/dev/null 2>&1")])
                .status()
                .map(|status| status.success())
                .unwrap_or(false)
            {
                return run_backend(backend);
            }
        }

        return Err(
            "当前 Linux 环境缺少可用的原生文件对话框命令（zenity/qarma/kdialog）".to_string(),
        );
    }

    #[allow(unreachable_code)]
    Err("当前平台未实现原生打开文件对话框".to_string())
}

#[cfg(target_os = "windows")]
fn pick_save_file_path_native(default_name: &str, ext: &str) -> Result<Option<PathBuf>, String> {
    let normalized_ext = ext.trim().trim_start_matches('.').to_ascii_lowercase();
    let normalized_name = if normalized_ext.is_empty()
        || default_name
            .to_ascii_lowercase()
            .ends_with(&format!(".{normalized_ext}"))
    {
        default_name.to_string()
    } else {
        format!("{default_name}.{normalized_ext}")
    };
    let filter = powershell_single_quoted(&windows_dialog_filter(&[normalized_ext.clone()]));
    let file_name = powershell_single_quoted(&normalized_name);
    let default_ext = powershell_single_quoted(&normalized_ext);
    let script = format!(
        r#"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.SaveFileDialog
$dialog.Title = '保存文件'
$dialog.Filter = {filter}
$dialog.FileName = {file_name}
$dialog.DefaultExt = {default_ext}
$dialog.AddExtension = $true
$dialog.OverwritePrompt = $true
$dialog.RestoreDirectory = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{
  $dialog.FileName
}}
"#
    );

    let stdout = run_powershell_script(&script)?;
    if stdout.is_empty() {
        return Ok(None);
    }

    Ok(Some(PathBuf::from(stdout)))
}

#[cfg(not(target_os = "windows"))]
fn pick_save_file_path_native(default_name: &str, ext: &str) -> Result<Option<PathBuf>, String> {
    let normalized_ext = ext.trim().trim_start_matches('.').to_ascii_lowercase();
    let normalized_name = if normalized_ext.is_empty()
        || default_name
            .to_ascii_lowercase()
            .ends_with(&format!(".{normalized_ext}"))
    {
        default_name.to_string()
    } else {
        format!("{default_name}.{normalized_ext}")
    };

    #[cfg(target_os = "macos")]
    {
        let escaped_name = normalized_name.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!(
            r#"POSIX path of (choose file name with prompt "保存文件" default name "{}")"#,
            escaped_name
        );
        let output = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| e.to_string())?;
        return Ok(normalize_dialog_result(output)?.map(PathBuf::from));
    }

    #[cfg(target_os = "linux")]
    {
        let initial_path = std::env::current_dir()
            .map_err(|e| e.to_string())?
            .join(&normalized_name);
        let initial_path = initial_path.to_string_lossy().to_string();
        let patterns = if normalized_ext.is_empty() {
            Vec::new()
        } else {
            vec![format!("*.{normalized_ext}")]
        };

        let mut run_backend = |backend: &str| -> Result<Option<PathBuf>, String> {
            match backend {
                "kdialog" => {
                    let mut command = Command::new("kdialog");
                    command.arg("--getsavefilename").arg(&initial_path);
                    if !patterns.is_empty() {
                        command.arg(format!("{}|支持的文件", patterns.join(" ")));
                    }
                    let output = command.output().map_err(|e| e.to_string())?;
                    Ok(normalize_dialog_result(output)?.map(PathBuf::from))
                }
                "zenity" | "qarma" => {
                    let mut command = Command::new(backend);
                    command.args([
                        "--file-selection",
                        "--save",
                        "--confirm-overwrite",
                        "--title=保存文件",
                    ]);
                    command.arg(format!("--filename={initial_path}"));
                    if !patterns.is_empty() {
                        command.arg(format!("--file-filter=支持的文件 | {}", patterns.join(" ")));
                        command.arg("--file-filter=所有文件 | *");
                    }
                    let output = command.output().map_err(|e| e.to_string())?;
                    Ok(normalize_dialog_result(output)?.map(PathBuf::from))
                }
                _ => Err("当前平台未实现原生保存文件对话框".to_string()),
            }
        };

        for backend in ["zenity", "qarma", "kdialog"] {
            if Command::new("sh")
                .args(["-c", &format!("command -v {backend} >/dev/null 2>&1")])
                .status()
                .map(|status| status.success())
                .unwrap_or(false)
            {
                return run_backend(backend);
            }
        }

        return Err(
            "当前 Linux 环境缺少可用的原生文件对话框命令（zenity/qarma/kdialog）".to_string(),
        );
    }

    #[allow(unreachable_code)]
    Err("当前平台未实现原生保存文件对话框".to_string())
}

fn save_text_file_with_dialog(
    content: &str,
    default_name: &str,
    ext: &str,
) -> Result<bool, String> {
    let Some(path) = pick_save_file_path_native(default_name, ext)? else {
        return Ok(false);
    };

    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(true)
}

fn relaunch_current_app(
    app: &tauri::AppHandle,
    _state: &State<'_, CoreState>,
) -> Result<(), String> {
    shutdown_runtime_once(app);

    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let current_dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let args = std::env::args_os().skip(1).collect::<Vec<_>>();

    Command::new(current_exe)
        .args(args)
        .current_dir(current_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    app.exit(0);
    Ok(())
}

