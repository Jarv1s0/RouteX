use super::prelude::*;
use super::*;

pub(crate) fn normalize_dialog_extensions(extensions: &[String]) -> Vec<String> {
    extensions
        .iter()
        .map(|ext| ext.trim().trim_start_matches('.').to_ascii_lowercase())
        .filter(|ext| !ext.is_empty())
        .collect()
}

pub(crate) fn normalize_save_file_name(default_name: &str, ext: &str) -> (String, String) {
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

    (normalized_name, normalized_ext)
}

pub(crate) fn ensure_save_path_extension(path: PathBuf, ext: &str) -> PathBuf {
    if ext.is_empty()
        || path
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value.eq_ignore_ascii_case(ext))
    {
        path
    } else {
        path.with_extension(ext)
    }
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn normalize_dialog_result(
    output: std::process::Output,
) -> Result<Option<String>, String> {
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
pub(crate) fn encode_powershell_script(script: &str) -> String {
    let utf16 = script
        .encode_utf16()
        .flat_map(|unit| unit.to_le_bytes())
        .collect::<Vec<_>>();
    BASE64_STANDARD.encode(utf16)
}

#[cfg(target_os = "windows")]
pub(crate) fn run_powershell_script(script: &str) -> Result<String, String> {
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
#[allow(dead_code)]
pub(crate) fn run_interactive_powershell_script(
    script: &str,
) -> Result<std::process::Output, String> {
    let encoded = encode_powershell_script(script);
    powershell_command()
        .args(["-NoProfile", "-EncodedCommand", &encoded])
        .output()
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
pub(crate) fn pick_open_file_paths_native(
    extensions: &[String],
) -> Result<Option<Vec<String>>, String> {
    let mut dialog = rfd::FileDialog::new().set_title("选择文件");
    if !extensions.is_empty() {
        let extension_refs = extensions.iter().map(String::as_str).collect::<Vec<_>>();
        dialog = dialog.add_filter("支持的文件", &extension_refs);
    }

    Ok(dialog
        .pick_file()
        .map(|path| vec![path.to_string_lossy().to_string()]))
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn pick_open_file_paths_native(
    extensions: &[String],
) -> Result<Option<Vec<String>>, String> {
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

        let run_backend = |backend: &str| -> Result<Option<Vec<String>>, String> {
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
pub(crate) fn pick_save_file_path_native(
    default_name: &str,
    ext: &str,
) -> Result<Option<PathBuf>, String> {
    let (normalized_name, normalized_ext) = normalize_save_file_name(default_name, ext);

    let mut dialog = rfd::FileDialog::new()
        .set_title("保存文件")
        .set_file_name(&normalized_name);
    if !normalized_ext.is_empty() {
        dialog = dialog.add_filter("支持的文件", &[normalized_ext.as_str()]);
    }

    Ok(dialog
        .save_file()
        .map(|path| ensure_save_path_extension(path, &normalized_ext)))
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn pick_save_file_path_native(
    default_name: &str,
    ext: &str,
) -> Result<Option<PathBuf>, String> {
    let (normalized_name, normalized_ext) = normalize_save_file_name(default_name, ext);

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

        let run_backend = |backend: &str| -> Result<Option<PathBuf>, String> {
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

pub(crate) fn save_text_file_with_dialog(
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

pub(crate) fn relaunch_current_app(
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
