use crate::desktop::prelude::*;
use crate::desktop::*;

pub(crate) fn check_runtime_profile(
    binary_path: &Path,
    config_path: &Path,
    test_dir: &Path,
    safe_paths: &[String],
) -> Result<(), String> {
    let mut command = Command::new(binary_path);
    apply_background_command(&mut command);
    command
        .arg("-t")
        .arg("-f")
        .arg(config_path)
        .arg("-d")
        .arg(test_dir);

    if !safe_paths.is_empty() {
        command.env("SAFE_PATHS", safe_paths.join(path_delimiter()));
    }

    let output = command.output();
    cleanup_runtime_check_cache(test_dir);
    let output = output.map_err(|e| e.to_string())?;
    if output.status.success() {
        return Ok(());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let error_lines = stdout
        .lines()
        .filter(|line| line.contains("level=error"))
        .map(|line| {
            line.split("level=error")
                .nth(1)
                .unwrap_or(line)
                .trim()
                .to_string()
        })
        .collect::<Vec<_>>();

    if !error_lines.is_empty() {
        let err_msg = error_lines.join("\n");
        let runtime_config = serde_yaml::from_str::<Value>(
            &fs::read_to_string(config_path).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        if is_missing_geo_data_error(&err_msg, &runtime_config) {
            return Err(format!(
                "启动失败：当前配置依赖地理位置数据库 (GeoData)，但未找到相关文件。\n\n👉 请前往「规则 - GeoData」页面手动下载这些文件，或从配置中移除相关规则。\n\n内核原始报错：\n{}",
                err_msg
            ));
        }
        return Err(format!("Profile Check Failed:\n{}", err_msg));
    }

    let fallback = if !stderr.trim().is_empty() {
        stderr.trim().to_string()
    } else if !stdout.trim().is_empty() {
        stdout.trim().to_string()
    } else {
        format!("Mihomo exited with status {}", output.status)
    };

    Err(fallback)
}

pub(crate) fn normalize_runtime_config(input: Option<&Value>, controller_address: &str) -> Value {
    let mut config = input
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();

    config.insert(
        "external-controller".to_string(),
        Value::String(controller_address.to_string()),
    );
    config.remove("external-controller-pipe");
    config.remove("external-controller-unix");
    config
        .entry("allow-lan".to_string())
        .or_insert_with(|| Value::Bool(false));
    config
        .entry("mode".to_string())
        .or_insert_with(|| Value::String("rule".to_string()));
    config
        .entry("log-level".to_string())
        .or_insert_with(|| Value::String("info".to_string()));
    config
        .entry("mixed-port".to_string())
        .or_insert_with(|| Value::Number(7890.into()));
    config
        .entry("ipv6".to_string())
        .or_insert_with(|| Value::Bool(true));
    config
        .entry("proxies".to_string())
        .or_insert_with(|| Value::Array(vec![]));
    config
        .entry("proxy-groups".to_string())
        .or_insert_with(|| Value::Array(vec![]));
    config
        .entry("rules".to_string())
        .or_insert_with(|| Value::Array(vec![Value::String("MATCH,DIRECT".to_string())]));

    Value::Object(config)
}
