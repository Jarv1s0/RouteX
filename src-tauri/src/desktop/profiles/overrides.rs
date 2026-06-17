use super::super::prelude::*;
use super::super::*;

pub(crate) fn current_override_profile_text(app: &tauri::AppHandle) -> Result<String, String> {
    let profile_config = read_profile_config(app)?;
    let override_config = read_override_config(app)?;
    let mut ids = override_config
        .items
        .iter()
        .filter(|item| item.global.unwrap_or(false))
        .map(|item| item.id.clone())
        .collect::<Vec<_>>();

    if let Some(current_profile) =
        get_profile_item_from_config(&profile_config, profile_config.current.as_deref())
    {
        if let Some(profile_override_ids) = current_profile.override_ids {
            for id in profile_override_ids {
                if !ids.contains(&id) {
                    ids.push(id);
                }
            }
        }
    }

    let mut blocks = Vec::new();
    for id in ids {
        if let Some(item) = override_config.items.iter().find(|item| item.id == id) {
            let text = read_override_text(app, &item.id, &item.ext)?;
            if !text.trim().is_empty() {
                blocks.push(text);
            }
        }
    }

    Ok(blocks.join("\n\n"))
}


pub(crate) fn write_override_exec_log(
    app: &tauri::AppHandle,
    id: &str,
    message: &str,
) -> Result<(), String> {
    let path = override_file_path(app, id, "log")?;
    ensure_parent(&path)?;
    fs::write(path, message).map_err(|e| e.to_string())
}

pub(crate) fn run_override_script(script: &str, profile: &Value) -> Result<Value, String> {
    let profile_json = serde_json::to_string(profile).map_err(|e| e.to_string())?;
    let wrapped_script = format!(
        r#"
(function() {{
  const __ROUTEX_CONFIG__ = {profile_json};
  {script}
  if (typeof main !== "function") {{
    throw new Error("必须定义 main 函数。例如: `function main(config) {{ return config; }}`");
  }}
  const __ROUTEX_RESULT__ = main(__ROUTEX_CONFIG__);
  if (__ROUTEX_RESULT__ === null || typeof __ROUTEX_RESULT__ !== "object" || Array.isArray(__ROUTEX_RESULT__)) {{
    throw new Error("JS 覆写 main(config) 必须返回对象");
  }}
  return JSON.stringify(__ROUTEX_RESULT__);
}})()
"#
    );

    let mut context = JsContext::default();
    context
        .runtime_limits_mut()
        .set_loop_iteration_limit(JS_OVERRIDE_LOOP_ITERATION_LIMIT);
    context
        .runtime_limits_mut()
        .set_recursion_limit(JS_OVERRIDE_RECURSION_LIMIT);
    let result = context
        .eval(JsSource::from_bytes(&wrapped_script))
        .map_err(|e| format!("JS 覆写执行失败: {e}"))?;
    let result_text = result
        .to_string(&mut context)
        .map_err(|e| format!("JS 覆写返回值转换失败: {e}"))?
        .to_std_string_escaped();
    let value = serde_json::from_str::<Value>(&result_text)
        .map_err(|e| format!("JS 覆写返回值不是有效 JSON: {e}"))?;
    if !value.is_object() {
        return Err("JS 覆写 main(config) 必须返回对象".to_string());
    }
    Ok(value)
}

pub(crate) fn apply_js_override(
    app: &tauri::AppHandle,
    item: &OverrideItemData,
    text: &str,
    profile: &mut Value,
) -> Result<(), String> {
    match run_override_script(text, profile) {
        Ok(next_profile) => {
            *profile = next_profile;
            let _ = write_override_exec_log(app, &item.id, "JS 覆写执行成功");
            Ok(())
        }
        Err(error) => {
            let message = format!("{}: {}", item.name, error);
            let _ = write_override_exec_log(app, &item.id, &message);
            Err(message)
        }
    }
}

pub(crate) fn apply_overrides_to_profile(
    app: &tauri::AppHandle,
    profile_id: Option<&str>,
    profile: &mut Value,
) -> Result<(), String> {
    let override_config = read_override_config(app)?;
    let mut ids = override_config
        .items
        .iter()
        .filter(|item| item.global.unwrap_or(false))
        .map(|item| item.id.clone())
        .collect::<Vec<_>>();

    if let Some(current_profile) =
        get_profile_item_from_config(&read_profile_config(app)?, profile_id)
    {
        if let Some(profile_override_ids) = current_profile.override_ids {
            for id in profile_override_ids {
                if !ids.contains(&id) {
                    ids.push(id);
                }
            }
        }
    }

    for id in ids {
        let Some(item) = override_config.items.iter().find(|item| item.id == id) else {
            continue;
        };
        let text = read_override_text(app, &item.id, &item.ext)?;
        if text.trim().is_empty() {
            continue;
        }

        match item.ext.as_str() {
            "yaml" => {
                let patch = parse_profile_yaml_value(&text)?;
                merge_config_value(profile, &patch, true);
            }
            "js" => apply_js_override(app, item, &text, profile)?,
            _ => return Err(format!("不支持的覆写文件类型: {}", item.ext)),
        }
    }

    Ok(())
}
