use crate::desktop::prelude::*;
use crate::desktop::*;

pub(crate) fn validate_runtime_start_log(
    log_path: &Path,
    log_start_offset: u64,
    runtime_config: &Value,
) -> Result<(), String> {
    let expected_tun_enabled = runtime_tun_enabled(runtime_config);

    let mut file = fs::File::open(log_path).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(log_start_offset))
        .map_err(|e| e.to_string())?;
    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|e| e.to_string())?;

    for line in content.lines() {
        if line.contains("Start Mixed(http+socks) server error")
            || line.contains("Start HTTP server error")
            || line.contains("Start SOCKS server error")
            || line.contains("Start Redir server error")
        {
            return Err("核心启动失败：入站端口仍被其他实例占用".to_string());
        }

        if line.contains("External controller listen error") {
            return Err("核心启动失败：控制器端口仍被其他实例占用".to_string());
        }

        if expected_tun_enabled && line.contains("Start TUN listening error") {
            if line.contains("Access is denied") {
                return Err("TUN 启动失败：当前实例没有获得虚拟网卡所需权限".to_string());
            }
            if line.contains("Cannot create a file when that file already exists") {
                return Err("TUN 启动失败：现有虚拟网卡状态残留，请先关闭旧实例后重试".to_string());
            }
            return Err("TUN 启动失败：核心未成功接管虚拟网卡".to_string());
        }
    }

    Ok(())
}

pub(crate) fn refine_core_start_error(
    startup_error: String,
    log_path: &Path,
    log_start_offset: u64,
    runtime_config: &Value,
) -> String {
    match validate_runtime_start_log(log_path, log_start_offset, runtime_config) {
        Err(error) => error,
        Ok(()) => startup_error,
    }
}
