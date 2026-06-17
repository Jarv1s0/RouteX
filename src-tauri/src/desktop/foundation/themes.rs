use crate::desktop::prelude::*;
use crate::desktop::*;

pub(crate) fn theme_file_path(app: &tauri::AppHandle, theme: &str) -> Result<PathBuf, String> {
    Ok(storage_dir(app, THEME_DIR_NAME)?.join(theme))
}

pub(crate) fn is_default_theme(theme: &str) -> bool {
    theme == DEFAULT_THEME_FILE_NAME
}

pub(crate) fn theme_sort_rank(theme: &str) -> u8 {
    if is_default_theme(theme) {
        return 0;
    }

    1
}

pub(crate) fn read_theme_text(app: &tauri::AppHandle, theme: &str) -> Result<String, String> {
    if is_default_theme(theme) {
        return Ok(String::new());
    }

    let path = theme_file_path(app, theme)?;
    if path.exists() {
        return fs::read_to_string(path).map_err(|e| e.to_string());
    }

    Ok(String::new())
}

pub(crate) fn write_theme_text(
    app: &tauri::AppHandle,
    theme: &str,
    css: &str,
) -> Result<(), String> {
    if is_default_theme(theme) {
        return Ok(());
    }

    let path = theme_file_path(app, theme)?;
    ensure_parent(&path)?;
    fs::write(path, css).map_err(|e| e.to_string())
}

pub(crate) fn theme_display_label(file_name: &str, content: &str) -> String {
    let first_line = content
        .strip_prefix('\u{feff}')
        .unwrap_or(content)
        .lines()
        .next()
        .unwrap_or_default()
        .trim();

    if let Some(comment) = first_line.strip_prefix("/*") {
        if let Some(end) = comment.find("*/") {
            let label = comment[..end].trim();
            if !label.is_empty() {
                return label.to_string();
            }
        }
    }

    file_name.to_string()
}

pub(crate) fn import_theme_files(app: &tauri::AppHandle, files: &[String]) -> Result<(), String> {
    let themes_dir = storage_dir(app, THEME_DIR_NAME)?;

    for (index, file) in files.iter().enumerate() {
        let source = PathBuf::from(file);
        if !source.exists() || !source.is_file() {
            continue;
        }

        let Some(file_name) = source.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !file_name.to_ascii_lowercase().ends_with(".css") {
            continue;
        }

        let target = themes_dir.join(format!(
            "{}-{}-{}",
            current_timestamp_ms(),
            index,
            file_name
        ));
        fs::copy(&source, target).map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub(crate) fn resolve_theme_entries(app: &tauri::AppHandle) -> Result<Vec<Value>, String> {
    let themes_dir = storage_dir(app, THEME_DIR_NAME)?;
    let mut entries = Vec::new();

    if !themes_dir.exists() {
        fs::create_dir_all(&themes_dir).map_err(|e| e.to_string())?;
    }

    entries.push(json!({
        "key": DEFAULT_THEME_FILE_NAME,
        "label": theme_display_label(DEFAULT_THEME_FILE_NAME, ""),
        "content": "",
    }));

    for entry in fs::read_dir(&themes_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };

        if !name.ends_with(".css") || is_default_theme(name) {
            continue;
        }

        let content = fs::read_to_string(&path).unwrap_or_default();
        let label = theme_display_label(name, &content);
        entries.push(json!({
            "key": name,
            "label": label,
            "content": content,
        }));
    }

    entries.sort_by(|left, right| {
        let left_key = left.get("key").and_then(Value::as_str).unwrap_or_default();
        let right_key = right.get("key").and_then(Value::as_str).unwrap_or_default();
        theme_sort_rank(left_key)
            .cmp(&theme_sort_rank(right_key))
            .then_with(|| left_key.cmp(right_key))
    });

    Ok(entries)
}

pub(crate) fn fetch_theme_archive(app: &tauri::AppHandle) -> Result<(), String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(THEME_ZIP_URL)
        .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
        .send()
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("主题下载失败: {}", response.status()));
    }

    let bytes = response.bytes().map_err(|e| e.to_string())?;
    let reader = Cursor::new(bytes);
    let mut archive = ZipArchive::new(reader).map_err(|e| e.to_string())?;
    let themes_dir = storage_dir(app, THEME_DIR_NAME)?;

    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|e| e.to_string())?;
        if file.is_dir() {
            continue;
        }

        let name = file.name().replace('\\', "/");
        let file_name = Path::new(&name)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        if !file_name.ends_with(".css") || is_default_theme(file_name) {
            continue;
        }

        let path = themes_dir.join(file_name);
        let mut contents = Vec::new();
        file.read_to_end(&mut contents).map_err(|e| e.to_string())?;
        fs::write(path, contents).map_err(|e| e.to_string())?;
    }

    Ok(())
}
