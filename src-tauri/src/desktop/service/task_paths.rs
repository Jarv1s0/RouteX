#![allow(unused_imports)]
use super::*;
use crate::desktop::prelude::*;
use crate::desktop::*;

pub fn task_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    ensure_dir(app_runtime_tasks_root_path(&app_data_root(app)?))
}

pub fn routex_run_binary_task_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(task_dir(app)?.join(ROUTEX_RUN_BINARY))
}

pub fn routex_run_task_xml_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(task_dir(app)?.join(ROUTEX_RUN_XML))
}

pub fn routex_run_args_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(task_dir(app)?.join(ROUTEX_RUN_ARGS_FILE))
}

pub fn routex_autorun_task_xml_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(task_dir(app)?.join(ROUTEX_AUTORUN_XML))
}

pub fn resolve_routex_run_binary(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    resolve_resource_binary(app, "tools", ROUTEX_RUN_BINARY)
        .map_err(|_| format!("RouteX run helper not found: {ROUTEX_RUN_BINARY}"))
}

pub fn write_elevate_task_params(app: &tauri::AppHandle) -> Result<(), String> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    let value = serde_json::to_string(&args).map_err(|e| e.to_string())?;
    fs::write(routex_run_args_path(app)?, value).map_err(|e| e.to_string())
}

pub fn file_sha256(path: &Path) -> Result<[u8; 32], String> {
    let mut file =
        fs::File::open(path).map_err(|e| format!("读取文件失败 {}: {e}", path.display()))?;
    let mut hasher = ring::digest::Context::new(&ring::digest::SHA256);
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

    let digest = hasher.finish();
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(digest.as_ref());
    Ok(bytes)
}

pub fn copy_routex_run_binary_for_task(app: &tauri::AppHandle) -> Result<(), String> {
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

pub fn ensure_routex_run_binary_for_task(app: &tauri::AppHandle) -> Result<(), String> {
    copy_routex_run_binary_for_task(app)
}
