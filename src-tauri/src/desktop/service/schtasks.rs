#![allow(unused_imports)]
use super::*;
use crate::desktop::prelude::*;
use crate::desktop::*;

pub fn encode_utf16le_with_bom(value: &str) -> Vec<u8> {
    let mut bytes = vec![0xFF, 0xFE];
    for code_unit in value.encode_utf16() {
        bytes.extend_from_slice(&code_unit.to_le_bytes());
    }
    bytes
}

#[cfg(target_os = "windows")]
pub fn resolve_windows_system_binary(binary: &str) -> PathBuf {
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
pub fn schtasks_output(args: &[&str]) -> Result<std::process::Output, String> {
    let schtasks_path = resolve_windows_system_binary("schtasks.exe");
    let mut command = Command::new(&schtasks_path);
    apply_background_command(&mut command);
    command
        .args(args)
        .output()
        .map_err(|e| format!("{}: {e}", schtasks_path.display()))
}

#[cfg(target_os = "windows")]
pub fn decode_windows_code_page_output(bytes: &[u8], code_page: u32) -> Option<String> {
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
pub fn decode_windows_process_output(bytes: &[u8]) -> String {
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
pub fn schtasks_command(args: &[&str]) -> Result<(), String> {
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
