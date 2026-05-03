fn hide_traymenu_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(TRAYMENU_WINDOW_LABEL) {
        let _ = window.hide();
    }
}

fn tray_mode_label(mode: &str) -> &'static str {
    match mode {
        "global" => "全局",
        "direct" => "直连",
        _ => "规则",
    }
}

fn tray_delay_label(delay: i64) -> String {
    if delay == 0 {
        "Timeout".to_string()
    } else if delay > 0 {
        format!("{delay} ms")
    } else {
        String::new()
    }
}

fn encode_tray_menu_segment(value: &str) -> String {
    urlencoding::encode(value).into_owned()
}

fn decode_tray_menu_segment(value: &str) -> Option<String> {
    urlencoding::decode(value)
        .ok()
        .map(|decoded| decoded.into_owned())
}

fn build_tray_group_test_id(group: &str) -> String {
    format!(
        "{TRAY_MENU_GROUP_TEST_PREFIX}{}",
        encode_tray_menu_segment(group)
    )
}

fn build_tray_group_proxy_id(group: &str, proxy: &str) -> String {
    format!(
        "{TRAY_MENU_GROUP_PROXY_PREFIX}{}::{}",
        encode_tray_menu_segment(group),
        encode_tray_menu_segment(proxy)
    )
}

fn parse_tray_group_test_id(id: &str) -> Option<String> {
    id.strip_prefix(TRAY_MENU_GROUP_TEST_PREFIX)
        .and_then(decode_tray_menu_segment)
}

fn parse_tray_group_proxy_id(id: &str) -> Option<(String, String)> {
    let raw = id.strip_prefix(TRAY_MENU_GROUP_PROXY_PREFIX)?;
    let (group, proxy) = raw.split_once("::")?;
    Some((
        decode_tray_menu_segment(group)?,
        decode_tray_menu_segment(proxy)?,
    ))
}

fn build_tray_profile_toggle_id(profile_id: &str) -> String {
    format!(
        "{TRAY_MENU_PROFILE_TOGGLE_PREFIX}{}",
        encode_tray_menu_segment(profile_id)
    )
}

fn parse_tray_profile_toggle_id(id: &str) -> Option<String> {
    id.strip_prefix(TRAY_MENU_PROFILE_TOGGLE_PREFIX)
        .and_then(decode_tray_menu_segment)
}

fn build_tray_profile_current_id(profile_id: &str) -> String {
    format!(
        "{TRAY_MENU_PROFILE_CURRENT_PREFIX}{}",
        encode_tray_menu_segment(profile_id)
    )
}

fn parse_tray_profile_current_id(id: &str) -> Option<String> {
    id.strip_prefix(TRAY_MENU_PROFILE_CURRENT_PREFIX)
        .and_then(decode_tray_menu_segment)
}

fn build_tray_copy_env_id(shell_type: &str) -> String {
    format!(
        "{TRAY_MENU_COPY_ENV_PREFIX}{}",
        encode_tray_menu_segment(shell_type)
    )
}

fn parse_tray_copy_env_id(id: &str) -> Option<String> {
    id.strip_prefix(TRAY_MENU_COPY_ENV_PREFIX)
        .and_then(decode_tray_menu_segment)
}

fn read_tray_env_types(app: &tauri::AppHandle) -> Result<Vec<String>, String> {
    let mut env_types = json_array_strings(read_app_config_store(app)?.get("envType"))
        .into_iter()
        .filter(|shell_type| {
            matches!(
                shell_type.as_str(),
                "bash" | "cmd" | "powershell" | "nushell"
            )
        })
        .collect::<Vec<_>>();

    if env_types.is_empty() {
        env_types.push(if cfg!(target_os = "windows") {
            "powershell".to_string()
        } else {
            "bash".to_string()
        });
    }

    env_types.dedup();
    Ok(env_types)
}

fn load_native_tray_groups(app: &tauri::AppHandle) -> Result<Vec<Value>, String> {
    let state = app.state::<CoreState>();
    let proxies = core_request(&state, reqwest::Method::GET, "/proxies", None, None)?;
    let runtime = current_runtime_value(app, &state)?;
    Ok(build_mihomo_groups_value(&proxies, &runtime)
        .as_array()
        .cloned()
        .unwrap_or_default())
}

fn append_native_tray_group_menus(
    app: &tauri::AppHandle,
    menu: &Menu<tauri::Wry>,
) -> Result<bool, String> {
    let groups = load_native_tray_groups(app)?;
    if groups.is_empty() {
        return Ok(false);
    }

    for group in groups {
        let Some(name) = group.get("name").and_then(Value::as_str) else {
            continue;
        };
        let current_proxy = group.get("now").and_then(Value::as_str).unwrap_or_default();
        let current_delay = group
            .get("all")
            .and_then(Value::as_array)
            .and_then(|items| {
                items
                    .iter()
                    .find(|item| item.get("name").and_then(Value::as_str) == Some(current_proxy))
            })
            .and_then(|item| item.get("history").and_then(Value::as_array))
            .and_then(|history| history.last())
            .and_then(|item| item.get("delay").and_then(Value::as_i64))
            .unwrap_or(-1);
        let title = match tray_delay_label(current_delay).is_empty() {
            true => name.to_string(),
            false => format!("{} ({})", name, tray_delay_label(current_delay)),
        };

        let submenu = Submenu::new(app, title, true).map_err(|e| e.to_string())?;
        let retest = MenuItem::with_id(
            app,
            build_tray_group_test_id(name),
            "重新测试",
            true,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        let separator = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
        submenu.append(&retest).map_err(|e| e.to_string())?;
        submenu.append(&separator).map_err(|e| e.to_string())?;

        if let Some(items) = group.get("all").and_then(Value::as_array) {
            for item in items {
                let Some(proxy_name) = item.get("name").and_then(Value::as_str) else {
                    continue;
                };
                let delay = item
                    .get("history")
                    .and_then(Value::as_array)
                    .and_then(|history| history.last())
                    .and_then(|history| history.get("delay").and_then(Value::as_i64))
                    .unwrap_or(-1);
                let label = match tray_delay_label(delay).is_empty() {
                    true => proxy_name.to_string(),
                    false => format!("{} ({})", proxy_name, tray_delay_label(delay)),
                };
                let proxy_item = CheckMenuItem::with_id(
                    app,
                    build_tray_group_proxy_id(name, proxy_name),
                    label,
                    true,
                    proxy_name == current_proxy,
                    None::<&str>,
                )
                .map_err(|e| e.to_string())?;
                submenu.append(&proxy_item).map_err(|e| e.to_string())?;
            }
        }

        menu.append(&submenu).map_err(|e| e.to_string())?;
    }

    Ok(true)
}

fn append_native_tray_profile_menu(
    app: &tauri::AppHandle,
    menu: &Menu<tauri::Wry>,
) -> Result<(), String> {
    let profile_config = read_profile_config(app)?;
    let active_ids = active_profile_ids(&profile_config);
    let current_id = primary_profile_id(&profile_config, &active_ids);

    let profile_menu = Submenu::new(app, "订阅配置", true).map_err(|e| e.to_string())?;

    if profile_config.items.is_empty() {
        let empty_item = MenuItem::with_id(
            app,
            TRAY_MENU_PROFILE_EMPTY_ID,
            "暂无订阅",
            false,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        profile_menu
            .append(&empty_item)
            .map_err(|e| e.to_string())?;
    } else {
        for item in &profile_config.items {
            let profile_item = CheckMenuItem::with_id(
                app,
                build_tray_profile_toggle_id(&item.id),
                &item.name,
                true,
                active_ids.iter().any(|id| id == &item.id),
                None::<&str>,
            )
            .map_err(|e| e.to_string())?;
            profile_menu
                .append(&profile_item)
                .map_err(|e| e.to_string())?;
        }
    }

    let separator = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    profile_menu.append(&separator).map_err(|e| e.to_string())?;

    let current_menu = Submenu::new(app, "主订阅", true).map_err(|e| e.to_string())?;
    let current_items = profile_config
        .items
        .iter()
        .filter(|item| active_ids.iter().any(|id| id == &item.id))
        .collect::<Vec<_>>();

    if current_items.is_empty() {
        let empty_item = MenuItem::with_id(
            app,
            TRAY_MENU_PROFILE_CURRENT_EMPTY_ID,
            "暂无可用主订阅",
            false,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        current_menu
            .append(&empty_item)
            .map_err(|e| e.to_string())?;
    } else {
        for item in current_items {
            let current_item = CheckMenuItem::with_id(
                app,
                build_tray_profile_current_id(&item.id),
                &item.name,
                true,
                current_id.as_deref() == Some(item.id.as_str()),
                None::<&str>,
            )
            .map_err(|e| e.to_string())?;
            current_menu
                .append(&current_item)
                .map_err(|e| e.to_string())?;
        }
    }

    profile_menu
        .append(&current_menu)
        .map_err(|e| e.to_string())?;
    menu.append(&profile_menu).map_err(|e| e.to_string())
}

fn append_tray_text_items(
    app: &tauri::AppHandle,
    menu: &Submenu<tauri::Wry>,
    items: &[(&str, &str)],
) -> Result<(), String> {
    for (id, label) in items {
        let item =
            MenuItem::with_id(app, *id, *label, true, None::<&str>).map_err(|e| e.to_string())?;
        menu.append(&item).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn append_native_tray_open_dir_menu(
    app: &tauri::AppHandle,
    menu: &Menu<tauri::Wry>,
) -> Result<(), String> {
    let open_dir_menu = Submenu::new(app, "打开目录", true).map_err(|e| e.to_string())?;
    append_tray_text_items(
        app,
        &open_dir_menu,
        &[
            (TRAY_MENU_OPEN_APP_DIR_ID, "应用目录"),
            (TRAY_MENU_OPEN_WORK_DIR_ID, "工作目录"),
            (TRAY_MENU_OPEN_CORE_DIR_ID, "内核目录"),
            (TRAY_MENU_OPEN_LOG_DIR_ID, "日志目录"),
        ],
    )?;
    menu.append(&open_dir_menu).map_err(|e| e.to_string())
}

fn append_native_tray_copy_env_menu(
    app: &tauri::AppHandle,
    menu: &Menu<tauri::Wry>,
) -> Result<(), String> {
    let env_types = read_tray_env_types(app)?;

    if env_types.len() <= 1 {
        let shell_type = env_types
            .first()
            .cloned()
            .unwrap_or_else(|| String::from("powershell"));
        let copy_env_item = MenuItem::with_id(
            app,
            build_tray_copy_env_id(&shell_type),
            "复制环境变量",
            true,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        return menu.append(&copy_env_item).map_err(|e| e.to_string());
    }

    let env_menu = Submenu::new(app, "复制环境变量", true).map_err(|e| e.to_string())?;
    for shell_type in env_types {
        let item = MenuItem::with_id(
            app,
            build_tray_copy_env_id(&shell_type),
            &shell_type,
            true,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        env_menu.append(&item).map_err(|e| e.to_string())?;
    }

    menu.append(&env_menu).map_err(|e| e.to_string())
}

fn build_native_tray_menu(app: &tauri::AppHandle) -> Result<Menu<tauri::Wry>, String> {
    let app_config = read_app_config_store(app)?;
    let controlled_config = read_controlled_config_store(app)?;
    let proxy_in_tray = app_config
        .get("proxyInTray")
        .and_then(Value::as_bool)
        .unwrap_or(true);

    let show_floating = app_config
        .get("showFloatingWindow")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let sys_proxy_enabled = app_config
        .get("sysProxy")
        .and_then(Value::as_object)
        .and_then(|sysproxy| sysproxy.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let tun_enabled = controlled_config
        .get("tun")
        .and_then(Value::as_object)
        .and_then(|tun| tun.get("enable"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let mode = controlled_config
        .get("mode")
        .and_then(Value::as_str)
        .unwrap_or("rule");

    let show_window = MenuItem::with_id(
        app,
        TRAY_MENU_SHOW_WINDOW_ID,
        "显示窗口",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let toggle_floating = MenuItem::with_id(
        app,
        TRAY_MENU_TOGGLE_FLOATING_ID,
        if show_floating {
            "关闭悬浮窗"
        } else {
            "显示悬浮窗"
        },
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let sys_proxy = CheckMenuItem::with_id(
        app,
        TRAY_MENU_TOGGLE_SYS_PROXY_ID,
        "系统代理",
        true,
        sys_proxy_enabled,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let tun = CheckMenuItem::with_id(
        app,
        TRAY_MENU_TOGGLE_TUN_ID,
        "虚拟网卡",
        true,
        tun_enabled,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let rule_mode = CheckMenuItem::with_id(
        app,
        TRAY_MENU_MODE_RULE_ID,
        "规则模式",
        true,
        mode == "rule",
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let global_mode = CheckMenuItem::with_id(
        app,
        TRAY_MENU_MODE_GLOBAL_ID,
        "全局模式",
        true,
        mode == "global",
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let direct_mode = CheckMenuItem::with_id(
        app,
        TRAY_MENU_MODE_DIRECT_ID,
        "直连模式",
        true,
        mode == "direct",
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let mode_menu = Submenu::with_items(
        app,
        format!("出站模式 ({})", tray_mode_label(mode)),
        true,
        &[&rule_mode, &global_mode, &direct_mode],
    )
    .map_err(|e| e.to_string())?;
    let quit_without_core = MenuItem::with_id(
        app,
        TRAY_MENU_QUIT_WITHOUT_CORE_ID,
        "保留内核退出",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let restart_app = MenuItem::with_id(
        app,
        TRAY_MENU_RESTART_APP_ID,
        "重启应用",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let quit = MenuItem::with_id(app, TRAY_MENU_QUIT_ID, "退出应用", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let separator_1 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let separator_2 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let separator_3 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let separator_4 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let separator_5 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let separator_6 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let separator_7 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let menu = Menu::new(app).map_err(|e| e.to_string())?;
    menu.append(&show_window).map_err(|e| e.to_string())?;
    menu.append(&toggle_floating).map_err(|e| e.to_string())?;
    menu.append(&separator_1).map_err(|e| e.to_string())?;
    menu.append(&sys_proxy).map_err(|e| e.to_string())?;
    menu.append(&tun).map_err(|e| e.to_string())?;
    menu.append(&separator_2).map_err(|e| e.to_string())?;
    menu.append(&mode_menu).map_err(|e| e.to_string())?;

    let appended_groups = if proxy_in_tray && !cfg!(target_os = "linux") {
        append_native_tray_group_menus(app, &menu).unwrap_or(false)
    } else {
        false
    };

    if appended_groups {
        menu.append(&separator_3).map_err(|e| e.to_string())?;
    }

    menu.append(&separator_4).map_err(|e| e.to_string())?;
    append_native_tray_profile_menu(app, &menu)?;
    menu.append(&separator_5).map_err(|e| e.to_string())?;
    append_native_tray_open_dir_menu(app, &menu)?;
    append_native_tray_copy_env_menu(app, &menu)?;
    menu.append(&separator_6).map_err(|e| e.to_string())?;
    menu.append(&quit_without_core).map_err(|e| e.to_string())?;
    menu.append(&restart_app).map_err(|e| e.to_string())?;
    menu.append(&separator_7).map_err(|e| e.to_string())?;
    menu.append(&quit).map_err(|e| e.to_string())?;
    Ok(menu)
}

fn refresh_native_tray_menu(app: &tauri::AppHandle) -> Result<(), String> {
    if cfg!(target_os = "macos") {
        return Ok(());
    }

    let Some(tray) = app.tray_by_id(TRAY_ICON_ID) else {
        return Ok(());
    };

    let menu = build_native_tray_menu(app)?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())
}

fn refresh_native_tray_shell(app: &tauri::AppHandle) -> Result<(), String> {
    update_tray_icon_for_state(app)?;
    refresh_native_tray_menu(app)
}

