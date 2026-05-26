fn emit_mihomo_config_updated(app: &tauri::AppHandle) {
    emit_ipc_event(app, "groupsUpdated", Value::Null);
    emit_ipc_event(app, "rulesUpdated", Value::Null);
}

fn upgrade_mihomo_core(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    is_alpha: bool,
) -> Result<Value, String> {
    let latest = latest_mihomo_version(app, is_alpha)?;
    let current = core_request(state, reqwest::Method::GET, "/version", None, None)?;
    let current_version = current
        .get("version")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if current_version.contains(&latest) {
        return Err(format!("already using latest version {latest}"));
    }

    let target_path = mihomo_core_target_path(app, is_alpha)?;
    let (asset, bytes) = fetch_mihomo_core_archive(app, &latest, is_alpha)?;
    stop_core_process(app, state)?;
    write_mihomo_core_archive(&asset, bytes, &target_path)?;
    restart_core_process(app, state, None).inspect(|value| {
        emit_ipc_event(app, "core-started", value.clone());
        emit_mihomo_config_updated(app);
    })
}

fn geo_data_file_name(key: &str) -> Result<&'static str, String> {
    match key {
        "geoip" => Ok("geoip.dat"),
        "geosite" => Ok("geosite.dat"),
        "mmdb" => Ok("geoip.metadb"),
        "asn" => Ok("ASN.mmdb"),
        other => Err(format!("不支持的 Geo 数据库类型: {other}")),
    }
}

fn read_protobuf_varint(bytes: &[u8], offset: &mut usize) -> Result<u64, String> {
    let mut value = 0u64;
    for shift in (0..64).step_by(7) {
        let byte = *bytes
            .get(*offset)
            .ok_or_else(|| "Geo dat 文件 protobuf 数据不完整".to_string())?;
        *offset += 1;
        value |= ((byte & 0x7f) as u64) << shift;
        if byte & 0x80 == 0 {
            return Ok(value);
        }
    }
    Err("Geo dat 文件 protobuf varint 无效".to_string())
}

fn validate_geo_dat_bytes(bytes: &[u8]) -> Result<(), String> {
    let mut offset = 0usize;
    let mut entry_count = 0usize;

    while offset < bytes.len() {
        let tag = read_protobuf_varint(bytes, &mut offset)?;
        let field_number = tag >> 3;
        let wire_type = tag & 0x07;
        if field_number == 0 {
            return Err("Geo dat 文件 protobuf 字段编号无效".to_string());
        }

        match wire_type {
            0 => {
                read_protobuf_varint(bytes, &mut offset)?;
            }
            1 => {
                offset = offset
                    .checked_add(8)
                    .ok_or_else(|| "Geo dat 文件长度溢出".to_string())?;
            }
            2 => {
                let len = read_protobuf_varint(bytes, &mut offset)? as usize;
                if field_number == 1 && len > 0 {
                    entry_count += 1;
                }
                offset = offset
                    .checked_add(len)
                    .ok_or_else(|| "Geo dat 文件长度溢出".to_string())?;
            }
            5 => {
                offset = offset
                    .checked_add(4)
                    .ok_or_else(|| "Geo dat 文件长度溢出".to_string())?;
            }
            _ => return Err("Geo dat 文件 protobuf wire type 无效".to_string()),
        }

        if offset > bytes.len() {
            return Err("Geo dat 文件 protobuf 数据长度无效".to_string());
        }
    }

    if entry_count == 0 {
        return Err("Geo dat 文件未包含有效条目".to_string());
    }

    Ok(())
}

fn validate_mmdb_bytes(bytes: &[u8]) -> Result<(), String> {
    const MMDB_METADATA_MARKER: &[u8] = b"\xAB\xCD\xEFMaxMind.com";
    let search_start = bytes.len().saturating_sub(128 * 1024);
    if bytes[search_start..]
        .windows(MMDB_METADATA_MARKER.len())
        .any(|window| window == MMDB_METADATA_MARKER)
    {
        Ok(())
    } else {
        Err("MMDB 文件缺少 MaxMind metadata marker".to_string())
    }
}

pub(super) fn validate_geo_data_bytes(key: &str, bytes: &[u8]) -> Result<(), String> {
    if bytes.is_empty() {
        return Err("Geo 数据库下载结果为空".to_string());
    }

    match key {
        "geoip" | "geosite" => validate_geo_dat_bytes(bytes),
        "mmdb" | "asn" => validate_mmdb_bytes(bytes),
        _ => geo_data_file_name(key).map(|_| ()),
    }
}

fn replace_geo_data_file(temp_path: &Path, target_path: &Path, backup_path: &Path) -> Result<(), String> {
    if backup_path.exists() {
        fs::remove_file(backup_path).map_err(|e| format!("清理旧 Geo 数据库备份失败: {e}"))?;
    }

    let had_existing = target_path.exists();
    if had_existing {
        fs::rename(target_path, backup_path).map_err(|e| format!("备份旧 Geo 数据库失败: {e}"))?;
    }

    match fs::rename(temp_path, target_path) {
        Ok(()) => {
            if had_existing && backup_path.exists() {
                let _ = fs::remove_file(backup_path);
            }
            Ok(())
        }
        Err(error) => {
            if had_existing {
                let rollback_result = fs::rename(backup_path, target_path);
                if let Err(rollback_error) = rollback_result {
                    return Err(format!(
                        "替换 Geo 数据库失败: {error}; 回滚旧文件失败: {rollback_error}"
                    ));
                }
            }
            Err(format!("替换 Geo 数据库失败，已保留原文件: {error}"))
        }
    }
}

fn upgrade_geo_data_file(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    key: &str,
    url: &str,
) -> Result<Value, String> {
    let file_name = geo_data_file_name(key)?;
    let url = url.trim();
    if url.is_empty() {
        return Err("Geo 数据库下载地址不能为空".to_string());
    }

    let parsed_url = reqwest::Url::parse(url).map_err(|e| format!("Geo 数据库下载地址无效: {e}"))?;
    if !matches!(parsed_url.scheme(), "http" | "https") {
        return Err("Geo 数据库下载地址只支持 http 或 https".to_string());
    }

    let work_dir = {
        let runtime = state.runtime.lock().map_err(|e| e.to_string())?;
        runtime
            .work_dir
            .clone()
            .ok_or_else(|| "Mihomo work dir is not available".to_string())?
    };

    let target_path = work_dir.join(file_name);
    let temp_path = target_path.with_file_name(format!("{file_name}.download"));
    let backup_path = target_path.with_file_name(format!("{file_name}.backup"));
    let bytes = download_with_update_client(app, parsed_url.as_str(), 120)?;
    validate_geo_data_bytes(key, &bytes)?;

    ensure_parent(&temp_path)?;
    fs::write(&temp_path, bytes).map_err(|e| e.to_string())?;
    replace_geo_data_file(&temp_path, &target_path, &backup_path)?;
    Ok(Value::Null)
}

pub(crate) fn register_mihomo_handlers(map: &mut std::collections::HashMap<&'static str, crate::desktop::ipc::IpcHandler>) {
    map.insert("ensureMihomoCoreAvailable", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let core = args.first().and_then(Value::as_str).unwrap_or("mihomo");
            let path = ensure_mihomo_core_available(app, core)?;
            Ok(json!(path.to_string_lossy().to_string()))
        
    });
    map.insert("mihomoVersion", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         core_request(state, reqwest::Method::GET, "/version", None, None) 
    });
    map.insert("mihomoConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         core_request(state, reqwest::Method::GET, "/configs", None, None) 
    });
    map.insert("mihomoConnections", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            core_request(state, reqwest::Method::GET, "/connections", None, None)
        
    });
    map.insert("mihomoRules", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         core_request(state, reqwest::Method::GET, "/rules", None, None) 
    });
    map.insert("mihomoProxies", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         core_request(state, reqwest::Method::GET, "/proxies", None, None) 
    });
    map.insert("mihomoGroups", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let proxies = core_request(state, reqwest::Method::GET, "/proxies", None, None)?;
            let runtime = current_runtime_value(app, state)?;
            Ok(build_mihomo_groups_value(&proxies, &runtime))
        
    });
    map.insert("mihomoProxyProviders", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         core_request(
            state,
            reqwest::Method::GET,
            "/providers/proxies",
            None,
            None,
        ) 
    });
    map.insert("mihomoRuleProviders", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            core_request(state, reqwest::Method::GET, "/providers/rules", None, None)
        
    });
    map.insert("patchMihomoConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         core_request(
            state,
            reqwest::Method::PATCH,
            "/configs",
            None,
            Some(args.first().cloned().unwrap_or(Value::Null)),
        )
        .map(|_| {
            emit_mihomo_config_updated(app);
            Value::Null
        }) 
    });
    map.insert("reloadCoreConfig", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let close_connections = args.first().and_then(Value::as_bool).unwrap_or(false);
            reload_core_config_process(app, state, close_connections).inspect(|_value| {
                emit_mihomo_config_updated(app);
            })
        
    });
    map.insert("mihomoChangeProxy", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let group = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoChangeProxy requires group".to_string())?;
            let proxy = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoChangeProxy requires proxy".to_string())?;
            core_request(
                state,
                reqwest::Method::PUT,
                &format!("/proxies/{}", urlencoding::encode(group)),
                None,
                Some(json!({ "name": proxy })),
            )
            .inspect(|_value| {
                emit_ipc_event(app, "groupsUpdated", Value::Null);
            })
        
    });
    map.insert("mihomoUnfixedProxy", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let group = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoUnfixedProxy requires group".to_string())?;
            core_request(
                state,
                reqwest::Method::DELETE,
                &format!("/proxies/{}", urlencoding::encode(group)),
                None,
                None,
            )
            .inspect(|_value| {
                emit_ipc_event(app, "groupsUpdated", Value::Null);
            })
        
    });
    map.insert("mihomoCloseConnection", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoCloseConnection requires connection id".to_string())?;
            core_request(
                state,
                reqwest::Method::DELETE,
                &format!("/connections/{}", urlencoding::encode(id)),
                None,
                None,
            )
            .map(|_| Value::Null)
        
    });
    map.insert("mihomoCloseAllConnections", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            if let Some(name) = args.first().and_then(Value::as_str) {
                close_connections_by_group(state, name)?;
                Ok(Value::Null)
            } else {
                core_request(state, reqwest::Method::DELETE, "/connections", None, None)
                    .map(|_| Value::Null)
            }
        
    });
    map.insert("mihomoProxyDelay", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let proxy = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoProxyDelay requires proxy".to_string())?;
            let (url, timeout) =
                resolve_delay_test_options(app, args.get(1).and_then(Value::as_str))?;
            core_request(
                state,
                reqwest::Method::GET,
                &format!("/proxies/{}/delay", urlencoding::encode(proxy)),
                Some(&[("url", url), ("timeout", timeout)]),
                None,
            )
        
    });
    map.insert("mihomoGroupDelay", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let group = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoGroupDelay requires group".to_string())?;
            let (url, timeout) =
                resolve_delay_test_options(app, args.get(1).and_then(Value::as_str))?;
            core_request(
                state,
                reqwest::Method::GET,
                &format!("/group/{}/delay", urlencoding::encode(group)),
                Some(&[("url", url), ("timeout", timeout)]),
                None,
            )
        
    });
    map.insert("mihomoDnsQuery", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let name = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoDnsQuery requires name".to_string())?
                .to_string();
            let record_type = args
                .get(1)
                .and_then(Value::as_str)
                .unwrap_or("A")
                .to_string();
            core_request(
                state,
                reqwest::Method::GET,
                "/dns/query",
                Some(&[("name", name), ("type", record_type)]),
                None,
            )
        
    });
    map.insert("mihomoToggleRuleDisabled", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         core_request(
            state,
            reqwest::Method::PATCH,
            "/rules/disable",
            None,
            Some(args.first().cloned().unwrap_or_else(|| json!({}))),
        )
        .map(|_| {
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Value::Null
        }) 
    });
    map.insert("mihomoUpdateProxyProviders", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let name = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoUpdateProxyProviders requires name".to_string())?;
            core_request(
                state,
                reqwest::Method::PUT,
                &format!("/providers/proxies/{}", urlencoding::encode(name)),
                None,
                None,
            )
            .map(|_| {
                emit_ipc_event(app, "groupsUpdated", Value::Null);
                Value::Null
            })
        
    });
    map.insert("mihomoUpdateRuleProviders", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let name = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoUpdateRuleProviders requires name".to_string())?;
            core_request(
                state,
                reqwest::Method::PUT,
                &format!("/providers/rules/{}", urlencoding::encode(name)),
                None,
                None,
            )
            .map(|_| {
                emit_ipc_event(app, "rulesUpdated", Value::Null);
                Value::Null
            })
        
    });
    map.insert("mihomoUpgrade", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         upgrade_mihomo_core(app, state, read_core_name(app)? == "mihomo-alpha") 
    });
    map.insert("mihomoUpgradeGeo", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            core_request(state, reqwest::Method::POST, "/upgrade/geo", None, None)
                .map(|_| Value::Null)
        
    });
    map.insert("mihomoUpgradeGeoFile", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let key = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoUpgradeGeoFile requires file key".to_string())?;
            let url = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoUpgradeGeoFile requires url".to_string())?;
            upgrade_geo_data_file(app, state, key, url)
        
    });
    map.insert("mihomoUpgradeUI", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         core_request(state, reqwest::Method::POST, "/upgrade/ui", None, None)
            .map(|_| Value::Null) 
    });
    map.insert("checkMihomoLatestVersion", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let is_alpha = args.first().and_then(Value::as_bool).unwrap_or(false);
            let url = if is_alpha {
                "https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt"
            } else {
                "https://github.com/MetaCubeX/mihomo/releases/latest/download/version.txt"
            };
            match fetch_text_with_update_client(app, url, 10) {
                Ok(text) => Ok(json!(text.trim())),
                Err(_) => Ok(Value::Null),
            }
        
    });
    map.insert("restartMihomoConnections", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            if current_controller_url(state)?.is_some() {
                start_core_events_monitor(app, state)?;
            } else {
                stop_core_events_monitor(state)?;
            }
            Ok(Value::Null)
        
    });
    map.insert("restartCore", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         restart_core_process(app, state, args.first()).inspect(|value| {
            emit_ipc_event(app, "core-started", value.clone());
            emit_ipc_event(app, "groupsUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
        }) 
    });
    map.insert("setNativeTheme", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let theme = args.first().and_then(Value::as_str);
            apply_window_theme(window, theme);
            Ok(Value::Null)
        
    });
    map.insert("relaunchApp", |app, window, state, args| {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            relaunch_current_app(app, state)?;
            Ok(Value::Null)
        
    });
}
