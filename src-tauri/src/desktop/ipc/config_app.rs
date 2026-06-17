#[allow(clippy::redundant_closure_call)]
pub(crate) fn register_app_config_handlers(map: &mut std::collections::HashMap<&'static str, crate::desktop::ipc::IpcHandler>) {
    map.insert("getAppConfig", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         read_app_config_store(app) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("patchAppConfig", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let patch = args.first().unwrap_or(&Value::Null);
            patch_app_config_store(app, patch)?;
            if patch_requires_shell_surface_sync(patch) {
                sync_shell_surfaces(app)?;
            }
            if patch.get("pauseSSID").is_some() {
                refresh_ssid_check(app)?;
            }
            if patch.get("autoLightweight").is_some()
                || patch.get("autoLightweightDelay").is_some()
                || patch.get("autoLightweightMode").is_some()
                || patch.get("showFloatingWindow").is_some()
            {
                let _ = refresh_lightweight_mode(app);
            }
            emit_ipc_event(app, "appConfigUpdated", Value::Null);
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getControledMihomoConfig", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         read_controlled_config_store(app) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("patchControledMihomoConfig", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            patch_controlled_config_store(app, args.first().unwrap_or(&Value::Null))?;
            update_tray_icon_for_state(app)?;
            emit_ipc_event(app, "controledMihomoConfigUpdated", Value::Null);
            emit_ipc_event(app, "groupsUpdated", Value::Null);
            emit_ipc_event(app, "rulesUpdated", Value::Null);
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getFileStr", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getFileStr requires path".to_string())?;
            Ok(json!(read_runtime_text(app, state, path)?))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("setFileStr", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "setFileStr requires path".to_string())?;
            let content = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "setFileStr requires content".to_string())?;
            write_runtime_text(app, state, path, content)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("readTextFile", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "readTextFile requires path".to_string())?;
            Ok(json!(read_runtime_text(app, state, path)?))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("convertMrsRuleset", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "convertMrsRuleset requires path".to_string())?;
            let behavior = args.get(1).and_then(Value::as_str).unwrap_or("domain");
            Ok(json!(convert_mrs_ruleset(app, state, path, behavior)?))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("openFile", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let file_type = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "openFile requires file type".to_string())?;
            let id = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "openFile requires id".to_string())?;
            let ext = args.get(2).and_then(Value::as_str).unwrap_or("yaml");
            let path = if file_type == "profile" {
                profile_file_path(app, id)?
            } else {
                override_file_path(app, id, ext)?
            };
            open_path_in_shell(&path)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("resolveThemes", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(resolve_theme_entries(app)?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("fetchThemes", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            fetch_theme_archive(app)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("readTheme", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let theme = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "readTheme requires theme name".to_string())?;
            Ok(json!(read_theme_text(app, theme)?))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getAppName", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let app_path = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "getAppName requires app path".to_string())?;
            Ok(json!(get_app_name_value(app_path)))
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("writeTheme", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let theme = args
                .first()
                .and_then(Value::as_str)
                .ok_or_else(|| "writeTheme requires theme name".to_string())?;
            let css = args
                .get(1)
                .and_then(Value::as_str)
                .ok_or_else(|| "writeTheme requires css content".to_string())?;
            write_theme_text(app, theme, css)?;
            Ok(Value::Null)
        
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getControllerUrl", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         Ok(json!(current_controller_url(state)?)) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getRuntimeConfig", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
         current_runtime_value_for_renderer(app, state) 
    })().map_err(crate::desktop::error::AppError::from) });
    map.insert("getRuntimeConfigStr", |app, window, state, args| { (|| -> Result<Value, String> {
        let _app = app;
        let _window = window;
        let _state = state;
        let _args = args;
        
            let value = current_runtime_value_for_renderer(app, state)?;
            Ok(json!(
                serde_yaml::to_string(&value).map_err(|e| e.to_string())?
            ))
        
    })().map_err(crate::desktop::error::AppError::from) });
}
