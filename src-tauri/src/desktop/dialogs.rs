use super::prelude::*;
use super::*;

pub(crate) fn normalize_dialog_extensions(extensions: &[String]) -> Vec<String> {
    extensions
        .iter()
        .map(|ext| ext.trim().trim_start_matches('.').to_ascii_lowercase())
        .filter(|ext| !ext.is_empty())
        .collect()
}

pub(crate) fn normalize_save_file_name(default_name: &str, ext: &str) -> (String, String) {
    let normalized_ext = ext.trim().trim_start_matches('.').to_ascii_lowercase();
    let normalized_name = if normalized_ext.is_empty()
        || default_name
            .to_ascii_lowercase()
            .ends_with(&format!(".{normalized_ext}"))
    {
        default_name.to_string()
    } else {
        format!("{default_name}.{normalized_ext}")
    };

    (normalized_name, normalized_ext)
}

pub(crate) fn ensure_save_path_extension(path: PathBuf, ext: &str) -> PathBuf {
    if ext.is_empty()
        || path
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value.eq_ignore_ascii_case(ext))
    {
        path
    } else {
        path.with_extension(ext)
    }
}

pub(crate) fn pick_open_file_paths_native(
    extensions: &[String],
) -> Result<Option<Vec<String>>, String> {
    let mut dialog = rfd::FileDialog::new().set_title("选择文件");
    if !extensions.is_empty() {
        let extension_refs = extensions.iter().map(String::as_str).collect::<Vec<_>>();
        dialog = dialog.add_filter("支持的文件", &extension_refs);
    }

    Ok(dialog
        .pick_file()
        .map(|path| vec![path.to_string_lossy().to_string()]))
}

pub(crate) fn pick_save_file_path_native(
    default_name: &str,
    ext: &str,
) -> Result<Option<PathBuf>, String> {
    let (normalized_name, normalized_ext) = normalize_save_file_name(default_name, ext);

    let mut dialog = rfd::FileDialog::new()
        .set_title("保存文件")
        .set_file_name(&normalized_name);
    if !normalized_ext.is_empty() {
        dialog = dialog.add_filter("支持的文件", &[normalized_ext.as_str()]);
    }

    Ok(dialog
        .save_file()
        .map(|path| ensure_save_path_extension(path, &normalized_ext)))
}

pub(crate) fn save_text_file_with_dialog(
    content: &str,
    default_name: &str,
    ext: &str,
) -> Result<bool, String> {
    let Some(path) = pick_save_file_path_native(default_name, ext)? else {
        return Ok(false);
    };

    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(true)
}

pub(crate) fn relaunch_current_app(
    app: &tauri::AppHandle,
    _state: &State<'_, CoreState>,
) -> Result<(), String> {
    shutdown_runtime_once(app);

    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let current_dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let args = std::env::args_os().skip(1).collect::<Vec<_>>();

    Command::new(current_exe)
        .args(args)
        .current_dir(current_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    app.exit(0);
    Ok(())
}
