fn handle_mihomo_invoke(app: &tauri::AppHandle, window: &tauri::WebviewWindow, state: &State<'_, CoreState>, channel: &str, args: &[Value]) -> Result<Option<Value>, String> {
    let result: Result<Value, String> = match channel {
        "ensureMihomoCoreAvailable" => {
            let core = args.first().and_then(Value::as_str).unwrap_or("mihomo");
            let path = resolve_core_binary(&app, core)?;
            Ok(json!(path.to_string_lossy().to_string()))
        }
        "mihomoVersion" => core_request(&state, reqwest::Method::GET, "/version", None, None),
        "mihomoConfig" => core_request(&state, reqwest::Method::GET, "/configs", None, None),
        "mihomoConnections" => {
            core_request(&state, reqwest::Method::GET, "/connections", None, None)
        }
        "mihomoRules" => core_request(&state, reqwest::Method::GET, "/rules", None, None),
        "mihomoProxies" => core_request(&state, reqwest::Method::GET, "/proxies", None, None),
        "mihomoGroups" => {
            let proxies = core_request(&state, reqwest::Method::GET, "/proxies", None, None)?;
            let runtime = current_runtime_value(&app, &state)?;
            Ok(build_mihomo_groups_value(&proxies, &runtime))
        }
        "mihomoProxyProviders" => core_request(
            &state,
            reqwest::Method::GET,
            "/providers/proxies",
            None,
            None,
        ),
        "mihomoRuleProviders" => {
            core_request(&state, reqwest::Method::GET, "/providers/rules", None, None)
        }
        "patchMihomoConfig" => core_request(
            &state,
            reqwest::Method::PATCH,
            "/configs",
            None,
            Some(args.first().cloned().unwrap_or(Value::Null)),
        )
        .map(|_| {
            emit_ipc_event(&app, "groupsUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Value::Null
        }),
        "mihomoChangeProxy" => {
            let group = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoChangeProxy requires group".to_string())?;
            let proxy = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoChangeProxy requires proxy".to_string())?;
            core_request(
                &state,
                reqwest::Method::PUT,
                &format!("/proxies/{}", urlencoding::encode(group)),
                None,
                Some(json!({ "name": proxy })),
            )
            .map(|value| {
                emit_ipc_event(&app, "groupsUpdated", Value::Null);
                value
            })
        }
        "mihomoUnfixedProxy" => {
            let group = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoUnfixedProxy requires group".to_string())?;
            core_request(
                &state,
                reqwest::Method::DELETE,
                &format!("/proxies/{}", urlencoding::encode(group)),
                None,
                None,
            )
            .map(|value| {
                emit_ipc_event(&app, "groupsUpdated", Value::Null);
                value
            })
        }
        "mihomoCloseConnection" => {
            let id = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoCloseConnection requires connection id".to_string())?;
            core_request(
                &state,
                reqwest::Method::DELETE,
                &format!("/connections/{}", urlencoding::encode(id)),
                None,
                None,
            )
            .map(|_| Value::Null)
        }
        "mihomoCloseAllConnections" => {
            if let Some(name) = args.first().and_then(Value::as_str) {
                close_connections_by_group(&state, name)?;
                Ok(Value::Null)
            } else {
                core_request(&state, reqwest::Method::DELETE, "/connections", None, None)
                    .map(|_| Value::Null)
            }
        }
        "mihomoProxyDelay" => {
            let proxy = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoProxyDelay requires proxy".to_string())?;
            let (url, timeout) =
                resolve_delay_test_options(&app, args.get(1).and_then(Value::as_str))?;
            core_request(
                &state,
                reqwest::Method::GET,
                &format!("/proxies/{}/delay", urlencoding::encode(proxy)),
                Some(&[("url", url), ("timeout", timeout)]),
                None,
            )
        }
        "mihomoGroupDelay" => {
            let group = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoGroupDelay requires group".to_string())?;
            let (url, timeout) =
                resolve_delay_test_options(&app, args.get(1).and_then(Value::as_str))?;
            core_request(
                &state,
                reqwest::Method::GET,
                &format!("/group/{}/delay", urlencoding::encode(group)),
                Some(&[("url", url), ("timeout", timeout)]),
                None,
            )
        }
        "mihomoDnsQuery" => {
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
                &state,
                reqwest::Method::GET,
                "/dns/query",
                Some(&[("name", name), ("type", record_type)]),
                None,
            )
        }
        "mihomoToggleRuleDisabled" => core_request(
            &state,
            reqwest::Method::PATCH,
            "/rules/disable",
            None,
            Some(args.first().cloned().unwrap_or_else(|| json!({}))),
        )
        .map(|_| {
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            Value::Null
        }),
        "mihomoUpdateProxyProviders" => {
            let name = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoUpdateProxyProviders requires name".to_string())?;
            core_request(
                &state,
                reqwest::Method::PUT,
                &format!("/providers/proxies/{}", urlencoding::encode(name)),
                None,
                None,
            )
            .map(|_| {
                emit_ipc_event(&app, "groupsUpdated", Value::Null);
                Value::Null
            })
        }
        "mihomoUpdateRuleProviders" => {
            let name = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "mihomoUpdateRuleProviders requires name".to_string())?;
            core_request(
                &state,
                reqwest::Method::PUT,
                &format!("/providers/rules/{}", urlencoding::encode(name)),
                None,
                None,
            )
            .map(|_| {
                emit_ipc_event(&app, "rulesUpdated", Value::Null);
                Value::Null
            })
        }
        "mihomoUpgrade" => {
            core_request(&state, reqwest::Method::POST, "/upgrade", None, None).map(|_| Value::Null)
        }
        "mihomoUpgradeGeo" => {
            core_request(&state, reqwest::Method::POST, "/upgrade/geo", None, None)
                .map(|_| Value::Null)
        }
        "mihomoUpgradeUI" => core_request(&state, reqwest::Method::POST, "/upgrade/ui", None, None)
            .map(|_| Value::Null),
        "checkMihomoLatestVersion" => {
            let is_alpha = args.first().and_then(Value::as_bool).unwrap_or(false);
            let url = if is_alpha {
                "https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt"
            } else {
                "https://github.com/MetaCubeX/mihomo/releases/latest/download/version.txt"
            };
            match fetch_text(url, 10) {
                Ok(text) => Ok(json!(text.trim())),
                Err(_) => Ok(Value::Null),
            }
        }
        "restartMihomoConnections" => {
            if current_controller_url(&state)?.is_some() {
                start_core_events_monitor(&app, &state)?;
            } else {
                stop_core_events_monitor(&state)?;
            }
            Ok(Value::Null)
        }
        "restartCore" => restart_core_process(&app, &state, args.first()).map(|value| {
            emit_ipc_event(&app, "core-started", value.clone());
            emit_ipc_event(&app, "groupsUpdated", Value::Null);
            emit_ipc_event(&app, "rulesUpdated", Value::Null);
            value
        }),
        "setNativeTheme" => {
            let theme = args.first().and_then(Value::as_str);
            apply_window_theme(&window, theme);
            Ok(Value::Null)
        }
        "relaunchApp" => {
            relaunch_current_app(&app, &state)?;
            Ok(Value::Null)
        }
        _ => return Ok(None),
    };
    Ok(Some(result?))
}
