fn handle_tray_toggle_floating(app: &tauri::AppHandle) -> Result<(), String> {
    let current = read_app_config_store(app)?
        .get("showFloatingWindow")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    patch_app_config_store(app, &json!({ "showFloatingWindow": !current }))?;
    sync_shell_surfaces(app)?;
    emit_ipc_event(app, "appConfigUpdated", Value::Null);
    Ok(())
}

fn handle_tray_toggle_sys_proxy(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    let config = read_app_config_store(app)?;
    let current = config
        .get("sysProxy")
        .and_then(Value::as_object)
        .and_then(|sysproxy| sysproxy.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let only_active_device = config
        .get("onlyActiveDevice")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let next = !current;
    trigger_sys_proxy(app, state, next, only_active_device)?;
    patch_app_config_store(app, &json!({ "sysProxy": { "enable": next } }))?;
    emit_ipc_event(app, "appConfigUpdated", Value::Null);
    Ok(())
}

fn handle_tray_toggle_tun(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
) -> Result<(), String> {
    let controlled = read_controlled_config_store(app)?;
    let current = controlled
        .get("tun")
        .and_then(Value::as_object)
        .and_then(|tun| tun.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let patch = if current {
        json!({ "tun": { "enable": false } })
    } else {
        json!({ "tun": { "enable": true }, "dns": { "enable": true } })
    };
    let next_controlled = patch_controlled_config_store(app, &patch)?;
    let value = restart_core_process(app, state, Some(&next_controlled))?;
    emit_ipc_event(app, "core-started", value);
    emit_ipc_event(app, "controledMihomoConfigUpdated", Value::Null);
    emit_ipc_event(app, "groupsUpdated", Value::Null);
    emit_ipc_event(app, "rulesUpdated", Value::Null);
    Ok(())
}

fn handle_tray_change_mode(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    next_mode: &str,
) -> Result<(), String> {
    patch_controlled_config_store(app, &json!({ "mode": next_mode }))?;

    if let Err(error) = core_request(
        state,
        reqwest::Method::PATCH,
        "/configs",
        None,
        Some(json!({ "mode": next_mode })),
    ) {
        if error != "Mihomo controller is not available" {
            return Err(error);
        }
    }

    emit_ipc_event(app, "controledMihomoConfigUpdated", Value::Null);
    emit_ipc_event(app, "groupsUpdated", Value::Null);
    emit_ipc_event(app, "rulesUpdated", Value::Null);
    Ok(())
}

fn handle_tray_test_group_delay(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    group: &str,
) -> Result<(), String> {
    let (url, timeout) = resolve_delay_test_options(app, None)?;
    core_request(
        state,
        reqwest::Method::GET,
        &format!("/group/{}/delay", urlencoding::encode(group)),
        Some(&[("url", url), ("timeout", timeout)]),
        None,
    )?;
    emit_ipc_event(app, "groupsUpdated", Value::Null);
    Ok(())
}

fn handle_tray_change_group_proxy(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    group: &str,
    proxy: &str,
) -> Result<(), String> {
    core_request(
        state,
        reqwest::Method::PUT,
        &format!("/proxies/{}", urlencoding::encode(group)),
        None,
        Some(json!({ "name": proxy })),
    )?;

    if read_app_config_store(app)?
        .get("autoCloseConnection")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        let _ = core_request(state, reqwest::Method::DELETE, "/connections", None, None);
    }

    emit_ipc_event(app, "groupsUpdated", Value::Null);
    Ok(())
}

fn handle_tray_toggle_profile_active(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    profile_id: &str,
) -> Result<(), String> {
    let profile_config = read_profile_config(app)?;
    let mut next_actives = active_profile_ids(&profile_config);
    let current_id = primary_profile_id(&profile_config, &next_actives);
    let existed = next_actives.iter().any(|id| id == profile_id);

    if existed {
        next_actives.retain(|id| id != profile_id);
    } else {
        next_actives.push(profile_id.to_string());
    }

    let next_current = if existed && current_id.as_deref() == Some(profile_id) {
        next_actives.first().cloned()
    } else {
        current_id
    };

    set_active_profiles_store(app, &next_actives, next_current.as_deref())?;
    emit_ipc_event(app, "profileConfigUpdated", Value::Null);
    restart_core_and_emit(app, state)?;
    Ok(())
}

fn handle_tray_change_current_profile(
    app: &tauri::AppHandle,
    state: &State<'_, CoreState>,
    profile_id: &str,
) -> Result<(), String> {
    change_current_profile_store(app, profile_id)?;
    emit_ipc_event(app, "profileConfigUpdated", Value::Null);
    restart_core_and_emit(app, state)?;
    Ok(())
}

fn resolve_current_runtime_dirs(
    app: &tauri::AppHandle,
) -> Result<(PathBuf, PathBuf, PathBuf, PathBuf), String> {
    let current_profile_id = current_runtime_profile_id(app)?;
    let diff_work_dir = read_diff_work_dir(app)?;
    ensure_runtime_dirs(app, current_profile_id.as_deref(), diff_work_dir)
}

fn handle_tray_open_directory(app: &tauri::AppHandle, menu_id: &str) -> Result<(), String> {
    let path = match menu_id {
        TRAY_MENU_OPEN_APP_DIR_ID => app_data_root(app)?,
        TRAY_MENU_OPEN_WORK_DIR_ID => resolve_current_runtime_dirs(app)?.1,
        TRAY_MENU_OPEN_CORE_DIR_ID => {
            let core = read_core_name(app)?;
            let core_binary = resolve_core_binary(app, &core)?;
            core_binary
                .parent()
                .map(Path::to_path_buf)
                .ok_or_else(|| "无法解析内核目录".to_string())?
        }
        TRAY_MENU_OPEN_LOG_DIR_ID => resolve_current_runtime_dirs(app)?
            .2
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "无法解析日志目录".to_string())?,
        _ => return Ok(()),
    };

    open_path_in_shell(&path)
}

fn handle_tray_copy_env(app: &tauri::AppHandle, shell_type: &str) -> Result<(), String> {
    let command = build_proxy_env_command(app, shell_type)?;
    copy_text_to_clipboard(&command)
}

fn handle_native_tray_menu_event(app: &tauri::AppHandle, event: &MenuEvent) -> Result<(), String> {
    let state = app.state::<CoreState>();
    let menu_id = event.id().as_ref();

    let handled = if let Some(group) = parse_tray_group_test_id(menu_id) {
        handle_tray_test_group_delay(app, &state, &group)?;
        true
    } else if let Some((group, proxy)) = parse_tray_group_proxy_id(menu_id) {
        handle_tray_change_group_proxy(app, &state, &group, &proxy)?;
        true
    } else if let Some(profile_id) = parse_tray_profile_toggle_id(menu_id) {
        handle_tray_toggle_profile_active(app, &state, &profile_id)?;
        true
    } else if let Some(profile_id) = parse_tray_profile_current_id(menu_id) {
        handle_tray_change_current_profile(app, &state, &profile_id)?;
        true
    } else if let Some(shell_type) = parse_tray_copy_env_id(menu_id) {
        handle_tray_copy_env(app, &shell_type)?;
        true
    } else {
        false
    };

    if handled {
        refresh_native_tray_shell(app)?;
        return Ok(());
    }

    match event.id() {
        id if id == TRAY_MENU_SHOW_WINDOW_ID => show_main_window(app),
        id if id == TRAY_MENU_TOGGLE_FLOATING_ID => handle_tray_toggle_floating(app),
        id if id == TRAY_MENU_TOGGLE_SYS_PROXY_ID => handle_tray_toggle_sys_proxy(app, &state),
        id if id == TRAY_MENU_TOGGLE_TUN_ID => handle_tray_toggle_tun(app, &state),
        id if id == TRAY_MENU_MODE_RULE_ID => handle_tray_change_mode(app, &state, "rule"),
        id if id == TRAY_MENU_MODE_GLOBAL_ID => handle_tray_change_mode(app, &state, "global"),
        id if id == TRAY_MENU_MODE_DIRECT_ID => handle_tray_change_mode(app, &state, "direct"),
        id if id == TRAY_MENU_OPEN_APP_DIR_ID => handle_tray_open_directory(app, menu_id),
        id if id == TRAY_MENU_OPEN_WORK_DIR_ID => handle_tray_open_directory(app, menu_id),
        id if id == TRAY_MENU_OPEN_CORE_DIR_ID => handle_tray_open_directory(app, menu_id),
        id if id == TRAY_MENU_OPEN_LOG_DIR_ID => handle_tray_open_directory(app, menu_id),
        id if id == TRAY_MENU_QUIT_WITHOUT_CORE_ID => {
            exit_app_without_core(app)?;
            return Ok(());
        }
        id if id == TRAY_MENU_RESTART_APP_ID => {
            relaunch_current_app(app, &state)?;
            return Ok(());
        }
        id if id == TRAY_MENU_QUIT_ID => {
            shutdown_runtime_once(app);
            app.exit(0);
            return Ok(());
        }
        _ => Ok(()),
    }?;

    refresh_native_tray_shell(app)?;
    Ok(())
}

