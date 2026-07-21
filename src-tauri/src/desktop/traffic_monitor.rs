use super::prelude::*;
use super::*;

use std::net::IpAddr;

pub(crate) fn get_interfaces_value() -> Value {
    let mut interfaces = serde_json::Map::new();

    let Ok(addrs) = get_if_addrs::get_if_addrs() else {
        return Value::Object(interfaces);
    };

    for iface in addrs {
        let name = iface.name;
        let (ip, family) = match iface.addr {
            get_if_addrs::IfAddr::V4(v4) => (IpAddr::V4(v4.ip), "IPv4"),
            get_if_addrs::IfAddr::V6(v6) => (IpAddr::V6(v6.ip), "IPv6"),
        };

        if ip.is_loopback() {
            continue;
        }

        // Filter out link-local and APIPA (169.254.* and fe80::*)
        match ip {
            IpAddr::V4(ipv4) => {
                if ipv4.is_link_local() {
                    continue;
                }
            }
            IpAddr::V6(ipv6) => {
                if (ipv6.segments()[0] & 0xffc0) == 0xfe80 {
                    continue;
                }
            }
        }

        let address = ip.to_string();

        let entry = interfaces
            .entry(name)
            .or_insert_with(|| Value::Array(Vec::new()));

        if let Some(items) = entry.as_array_mut() {
            items.push(json!({
                "address": address,
                "family": family,
                "internal": false,
                "cidr": Value::Null,
                "mac": Value::Null,
                "netmask": Value::Null,
            }));
        }
    }

    Value::Object(interfaces)
}

pub(crate) fn runtime_files_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    ensure_dir(app_runtime_tools_root_path(&app_data_root(app)?))
}

pub(crate) fn download_binary_file(url: &str, target_path: &Path) -> Result<(), String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
        .send()
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("下载失败: {}", response.status()));
    }

    let bytes = response.bytes().map_err(|e| e.to_string())?;
    ensure_parent(target_path)?;
    fs::write(target_path, bytes).map_err(|e| e.to_string())
}

pub(crate) fn ensure_enable_loopback_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = resolve_resource_binary(app, "tools", "enableLoopback.exe") {
        return Ok(path);
    }

    let runtime_path = runtime_files_dir(app)?.join("enableLoopback.exe");
    if runtime_path.exists() {
        return Ok(runtime_path);
    }

    download_binary_file(ENABLE_LOOPBACK_URL, &runtime_path)?;
    Ok(runtime_path)
}

pub(crate) fn open_uwp_tool(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let tool_path = ensure_enable_loopback_path(app)?;
        Command::new(tool_path).spawn().map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("当前平台不支持 UWP 工具".to_string())
    }
}
