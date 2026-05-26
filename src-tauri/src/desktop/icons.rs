use super::prelude::*;
use super::*;

#[cfg(target_os = "windows")]
use std::{ffi::OsStr, os::windows::ffi::OsStrExt, ptr};

#[cfg(target_os = "windows")]
use windows_sys::Win32::{
    Foundation::HANDLE,
    Graphics::Gdi::{
        CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, SelectObject, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
    },
    UI::{
        Shell::ExtractAssociatedIconW,
        WindowsAndMessaging::{DestroyIcon, DrawIconEx, PrivateExtractIconsW, DI_NORMAL, HICON},
    },
};

pub(crate) fn fetch_image_data_url(url: &str) -> Result<String, String> {
    if url.starts_with("data:") {
        return Ok(url.to_string());
    }
    if url.trim_start().starts_with("<svg") {
        return Ok(format!("data:image/svg+xml;utf8,{url}"));
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, "RouteX-Tauri/1.0")
        .send()
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("图片请求失败: {}", response.status()));
    }
    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = response.bytes().map_err(|e| e.to_string())?;
    Ok(to_data_url(&mime, &bytes))
}

pub(crate) fn read_local_icon_data_url(app_path: &str) -> Option<String> {
    let path = PathBuf::from(app_path);
    if !path.exists() || !path.is_file() {
        return None;
    }

    let mime = guess_mime_from_path(&path);
    let bytes = fs::read(path).ok()?;
    Some(to_data_url(mime, &bytes))
}

pub(crate) fn icon_data_url_cache() -> &'static Mutex<HashMap<String, String>> {
    ICON_DATA_URL_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub(crate) fn is_icon_remote_or_data_resource(app_path: &str) -> bool {
    app_path.starts_with("data:")
        || app_path.starts_with("http://")
        || app_path.starts_with("https://")
}

pub(crate) fn current_exe_path_string() -> Option<String> {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.to_str().map(str::to_string))
}

pub(crate) fn path_file_name_eq(path: &Path, expected: &str) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|name| name.eq_ignore_ascii_case(expected))
}

#[cfg(target_os = "windows")]
pub(crate) fn path_has_component_eq(path: &Path, expected: &str) -> bool {
    path.components().any(|component| {
        component
            .as_os_str()
            .to_str()
            .is_some_and(|value| value.eq_ignore_ascii_case(expected))
    })
}

#[cfg(target_os = "windows")]
pub(crate) fn path_extension_eq(path: &Path, expected: &str) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case(expected))
}

#[cfg(target_os = "windows")]
pub(crate) fn windowsapps_parent_app_exe(path: &Path) -> Option<String> {
    if !path_has_component_eq(path, "WindowsApps") {
        return None;
    }

    let resources_dir = path.parent()?;
    if !path_file_name_eq(resources_dir, "resources") {
        return None;
    }

    let app_dir = resources_dir.parent()?;
    if !path_file_name_eq(app_dir, "app") {
        return None;
    }

    let mut app_exe = None;
    for entry in fs::read_dir(app_dir).ok()?.flatten() {
        let candidate = entry.path();
        if !candidate.is_file() || !path_extension_eq(&candidate, "exe") {
            continue;
        }

        if app_exe.replace(candidate).is_some() {
            return None;
        }
    }

    app_exe.and_then(|candidate| candidate.to_str().map(str::to_string))
}

#[cfg(target_os = "windows")]
pub(crate) fn canonical_windows_icon_request_path(app_path: &str) -> Option<String> {
    let path = Path::new(app_path);

    if path_file_name_eq(path, "mihomo.exe")
        && path
            .parent()
            .is_some_and(|parent| path_file_name_eq(parent, "sidecar"))
    {
        return current_exe_path_string();
    }

    windowsapps_parent_app_exe(path)
}

pub(crate) fn normalize_icon_request_path(app_path: &str) -> String {
    if app_path == "mihomo" {
        return current_exe_path_string().unwrap_or_else(|| app_path.to_string());
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(canonical_path) = canonical_windows_icon_request_path(app_path) {
            return canonical_path;
        }
    }

    app_path.to_string()
}

pub(crate) fn read_cached_icon_data_url(app_path: &str) -> Option<String> {
    icon_data_url_cache()
        .lock()
        .ok()
        .and_then(|cache| cache.get(app_path).cloned())
}

pub(crate) fn write_cached_icon_data_url(app_path: &str, data_url: String) {
    if let Ok(mut cache) = icon_data_url_cache().lock() {
        cache.insert(app_path.to_string(), data_url);
    }
}

pub(crate) fn is_image_file_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "svg" | "webp" | "ico" | "bmp" | "icns" | "xpm"
    )
}

#[cfg(target_os = "windows")]
pub(crate) fn is_windows_icon_extractable_path(path: &Path) -> bool {
    path.exists()
        && path.is_file()
        && matches!(
            path.extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase()
                .as_str(),
            "exe" | "dll"
        )
}

#[cfg(target_os = "windows")]
const WINDOWS_ICON_SIZE: i32 = 64;

#[cfg(target_os = "windows")]
fn wide_null(value: &str) -> Vec<u16> {
    OsStr::new(value).encode_wide().chain(Some(0)).collect()
}

#[cfg(target_os = "windows")]
fn extract_windows_icon_handle(app_path: &str, size: i32) -> Option<HICON> {
    let wide_path = wide_null(app_path);
    let mut handles = [ptr::null_mut(); 1];
    let mut icon_ids = [0u32; 1];

    let extracted = unsafe {
        PrivateExtractIconsW(
            wide_path.as_ptr(),
            0,
            size,
            size,
            handles.as_mut_ptr(),
            icon_ids.as_mut_ptr(),
            handles.len() as u32,
            0,
        )
    };

    if extracted > 0 && !handles[0].is_null() {
        return Some(handles[0]);
    }

    let mut fallback_path = wide_path;
    fallback_path.resize(260, 0);
    let mut icon_index = 0u16;
    let handle = unsafe {
        ExtractAssociatedIconW(ptr::null_mut(), fallback_path.as_mut_ptr(), &mut icon_index)
    };

    if handle.is_null() {
        None
    } else {
        Some(handle)
    }
}

#[cfg(target_os = "windows")]
fn png_data_url_from_rgba(width: u32, height: u32, rgba: &[u8]) -> Option<String> {
    let mut png_bytes = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut png_bytes, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().ok()?;
        writer.write_image_data(rgba).ok()?;
    }

    Some(to_data_url("image/png", &png_bytes))
}

#[cfg(target_os = "windows")]
pub(crate) fn bgra_to_rgba_with_alpha_fallback(bgra: &[u8]) -> Vec<u8> {
    let has_alpha = bgra.chunks_exact(4).any(|pixel| pixel[3] != 0);
    let mut rgba = Vec::with_capacity(bgra.len());

    for pixel in bgra.chunks_exact(4) {
        let alpha = if has_alpha { pixel[3] } else { u8::MAX };
        rgba.extend_from_slice(&[pixel[2], pixel[1], pixel[0], alpha]);
    }

    rgba
}

#[cfg(target_os = "windows")]
fn icon_handle_to_png_data_url(icon: HICON, size: i32) -> Option<String> {
    if icon.is_null() || size <= 0 {
        return None;
    }

    let width = size as u32;
    let height = size as u32;
    let pixel_count = (width * height) as usize;
    let mut bits = ptr::null_mut();

    let mut bitmap_info: BITMAPINFO = unsafe { std::mem::zeroed() };
    bitmap_info.bmiHeader = BITMAPINFOHEADER {
        biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: size,
        biHeight: -size,
        biPlanes: 1,
        biBitCount: 32,
        biCompression: BI_RGB,
        biSizeImage: (pixel_count * 4) as u32,
        biXPelsPerMeter: 0,
        biYPelsPerMeter: 0,
        biClrUsed: 0,
        biClrImportant: 0,
    };

    let hdc = unsafe { CreateCompatibleDC(ptr::null_mut()) };
    if hdc.is_null() {
        return None;
    }

    let hbitmap = unsafe {
        CreateDIBSection(
            hdc,
            &bitmap_info,
            DIB_RGB_COLORS,
            &mut bits,
            ptr::null_mut::<std::ffi::c_void>() as HANDLE,
            0,
        )
    };

    if hbitmap.is_null() || bits.is_null() {
        unsafe {
            DeleteDC(hdc);
        }
        return None;
    }

    unsafe {
        ptr::write_bytes(bits, 0, pixel_count * 4);
    }

    let old_bitmap = unsafe { SelectObject(hdc, hbitmap as HGDIOBJ) };
    let draw_ok =
        unsafe { DrawIconEx(hdc, 0, 0, icon, size, size, 0, ptr::null_mut(), DI_NORMAL) } != 0;

    let mut rgba = Vec::new();
    if draw_ok {
        let bgra = unsafe { std::slice::from_raw_parts(bits as *const u8, pixel_count * 4) };
        rgba = bgra_to_rgba_with_alpha_fallback(bgra);
    }

    unsafe {
        if !old_bitmap.is_null() {
            SelectObject(hdc, old_bitmap);
        }
        DeleteObject(hbitmap as HGDIOBJ);
        DeleteDC(hdc);
    }

    if !draw_ok {
        return None;
    }

    png_data_url_from_rgba(width, height, &rgba)
}

#[cfg(target_os = "windows")]
pub(crate) fn extract_windows_icon_data_url(app_path: &str) -> Option<String> {
    let path = Path::new(app_path);
    if !is_windows_icon_extractable_path(path) {
        return None;
    }

    let icon = extract_windows_icon_handle(app_path, WINDOWS_ICON_SIZE)?;
    let data_url = icon_handle_to_png_data_url(icon, WINDOWS_ICON_SIZE);
    unsafe {
        DestroyIcon(icon);
    }
    data_url
}

#[cfg(target_os = "windows")]
pub(crate) fn extract_windows_icon_data_urls_batch(
    app_paths: &[String],
) -> HashMap<String, String> {
    app_paths
        .iter()
        .filter_map(|app_path| {
            extract_windows_icon_data_url(app_path).map(|data_url| (app_path.clone(), data_url))
        })
        .collect()
}

#[cfg(target_os = "macos")]
pub(crate) fn macos_bundle_ancestors(app_path: &str) -> Vec<PathBuf> {
    Path::new(app_path)
        .ancestors()
        .filter(|path| {
            path.file_name()
                .and_then(|value| value.to_str())
                .map(|name| name.ends_with(".app") || name.ends_with(".xpc"))
                .unwrap_or(false)
        })
        .map(Path::to_path_buf)
        .collect()
}

#[cfg(target_os = "macos")]
pub(crate) fn find_macos_bundle_icon_path(bundle_path: &Path) -> Option<PathBuf> {
    let contents_dir = bundle_path.join("Contents");
    if !contents_dir.exists() {
        let mut entries = fs::read_dir(bundle_path)
            .ok()?
            .flatten()
            .collect::<Vec<_>>();
        entries.sort_by_key(|entry| entry.file_name());
        return entries.into_iter().find_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_str()?.to_ascii_lowercase();
            if name.starts_with("appicon") && is_image_file_path(&path) {
                Some(path)
            } else {
                None
            }
        });
    }

    let resources_dir = contents_dir.join("Resources");
    if !resources_dir.exists() {
        return None;
    }

    let mut icons = fs::read_dir(resources_dir)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .and_then(|value| value.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("icns"))
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    icons.sort();
    icons.into_iter().next()
}

#[cfg(target_os = "macos")]
pub(crate) fn convert_macos_icon_to_png_data_url(icon_path: &Path) -> Option<String> {
    if is_image_file_path(icon_path)
        && !icon_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("icns"))
            .unwrap_or(false)
    {
        return read_local_icon_data_url(icon_path.to_str()?);
    }

    let temp_path =
        std::env::temp_dir().join(format!("routex-icon-{}.png", current_timestamp_ms()));
    let output = Command::new("sips")
        .args([
            "-s",
            "format",
            "png",
            icon_path.to_str()?,
            "--out",
            temp_path.to_str()?,
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        let _ = fs::remove_file(&temp_path);
        return None;
    }

    let value = read_local_icon_data_url(temp_path.to_str()?);
    let _ = fs::remove_file(temp_path);
    value
}

#[cfg(target_os = "macos")]
pub(crate) fn extract_macos_icon_data_url(app_path: &str) -> Option<String> {
    let bundle_path = macos_bundle_ancestors(app_path)
        .into_iter()
        .find(|bundle_path| find_macos_bundle_icon_path(bundle_path).is_some())?;
    let icon_path = find_macos_bundle_icon_path(&bundle_path)?;
    convert_macos_icon_to_png_data_url(&icon_path)
}

#[cfg(target_os = "linux")]
pub(crate) fn find_linux_desktop_file(app_path: &str) -> Option<PathBuf> {
    let exec_name = Path::new(app_path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(app_path)
        .to_string();
    let home = std::env::var("HOME").ok();
    let mut desktop_dirs = vec![PathBuf::from("/usr/share/applications")];
    if let Some(home) = home {
        desktop_dirs.push(PathBuf::from(home).join(".local/share/applications"));
    }

    for dir in desktop_dirs {
        if !dir.exists() {
            continue;
        }

        let Ok(entries) = fs::read_dir(dir) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("desktop") {
                continue;
            }

            let Ok(content) = fs::read_to_string(&path) else {
                continue;
            };

            let exec_match = content.lines().find_map(|line| {
                line.strip_prefix("Exec=")
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
            });

            if let Some(exec_line) = exec_match {
                let exec_cmd = exec_line.split_whitespace().next().unwrap_or_default();
                let exec_basename = Path::new(exec_cmd)
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or_default();
                if exec_cmd == app_path
                    || exec_basename == exec_name
                    || exec_cmd.ends_with(app_path)
                    || app_path.ends_with(exec_basename)
                {
                    return Some(path);
                }
            }

            let expected_name = format!("Name={app_path}");
            let expected_generic_name = format!("GenericName={app_path}");
            if content.lines().any(|line| {
                let trimmed = line.trim();
                trimmed == expected_name || trimmed == expected_generic_name
            }) {
                return Some(path);
            }
        }
    }

    None
}

#[cfg(target_os = "linux")]
pub(crate) fn parse_linux_icon_name(content: &str) -> Option<String> {
    content
        .lines()
        .find_map(|line| line.strip_prefix("Icon=").map(str::trim))
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

#[cfg(target_os = "linux")]
pub(crate) fn resolve_linux_icon_path(icon_name: &str) -> Option<PathBuf> {
    let path = PathBuf::from(icon_name);
    if path.is_absolute() && path.exists() {
        return Some(path);
    }

    let home = std::env::var("HOME").ok();
    let mut icon_dirs = vec![
        PathBuf::from("/usr/share/icons/hicolor"),
        PathBuf::from("/usr/share/pixmaps"),
        PathBuf::from("/usr/share/icons/Adwaita"),
    ];
    if let Some(home) = home {
        icon_dirs.push(PathBuf::from(home).join(".local/share/icons"));
    }

    let sizes = [
        "512x512", "256x256", "128x128", "64x64", "48x48", "32x32", "24x24", "16x16",
    ];
    let extensions = ["png", "svg", "xpm"];

    for dir in &icon_dirs {
        for size in sizes {
            for ext in extensions {
                let path = dir
                    .join(size)
                    .join("apps")
                    .join(format!("{icon_name}.{ext}"));
                if path.exists() {
                    return Some(path);
                }
            }
        }
    }

    for ext in extensions {
        let path = PathBuf::from(format!("/usr/share/pixmaps/{icon_name}.{ext}"));
        if path.exists() {
            return Some(path);
        }
    }

    for dir in &icon_dirs {
        for ext in extensions {
            let path = dir.join(format!("{icon_name}.{ext}"));
            if path.exists() {
                return Some(path);
            }
        }
    }

    None
}

#[cfg(target_os = "linux")]
pub(crate) fn extract_linux_icon_data_url(app_path: &str) -> Option<String> {
    let desktop_file = find_linux_desktop_file(app_path)?;
    let content = fs::read_to_string(desktop_file).ok()?;
    let icon_name = parse_linux_icon_name(&content)?;
    let icon_path = resolve_linux_icon_path(&icon_name)?;
    read_local_icon_data_url(icon_path.to_str()?)
}

pub(crate) fn resolve_icon_data_url_uncached(normalized_path: &str) -> String {
    let path = Path::new(&normalized_path);
    if path.exists() && path.is_file() && is_image_file_path(path) {
        return read_local_icon_data_url(normalized_path)
            .unwrap_or_else(|| default_icon_data_url().to_string());
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(value) = extract_windows_icon_data_url(normalized_path) {
            return value;
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(value) = extract_macos_icon_data_url(normalized_path) {
            return value;
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(value) = extract_linux_icon_data_url(normalized_path) {
            return value;
        }
    }

    read_local_icon_data_url(normalized_path).unwrap_or_else(|| default_icon_data_url().to_string())
}

pub(crate) fn resolve_icon_data_url(app_path: &str) -> String {
    if is_icon_remote_or_data_resource(app_path) {
        return app_path.to_string();
    }

    let normalized_path = normalize_icon_request_path(app_path);
    if let Some(cached) = read_cached_icon_data_url(&normalized_path) {
        return cached;
    }

    let resolved = resolve_icon_data_url_uncached(&normalized_path);
    write_cached_icon_data_url(&normalized_path, resolved.clone());
    resolved
}

pub(crate) fn resolve_icon_data_urls(app_paths: &[String]) -> HashMap<String, String> {
    let mut resolved = HashMap::new();

    #[cfg(target_os = "windows")]
    let mut pending_windows_paths = HashSet::new();
    #[cfg(target_os = "windows")]
    let mut original_paths_by_normalized = HashMap::<String, Vec<String>>::new();

    for app_path in app_paths {
        if app_path.is_empty() {
            continue;
        }

        if is_icon_remote_or_data_resource(app_path) {
            resolved.insert(app_path.clone(), app_path.clone());
            continue;
        }

        let normalized_path = normalize_icon_request_path(app_path);
        if let Some(cached) = read_cached_icon_data_url(&normalized_path) {
            resolved.insert(app_path.clone(), cached);
            continue;
        }

        let path = Path::new(&normalized_path);
        if path.exists() && path.is_file() && is_image_file_path(path) {
            let value = read_local_icon_data_url(&normalized_path)
                .unwrap_or_else(|| default_icon_data_url().to_string());
            write_cached_icon_data_url(&normalized_path, value.clone());
            resolved.insert(app_path.clone(), value);
            continue;
        }

        #[cfg(target_os = "windows")]
        {
            if is_windows_icon_extractable_path(path) {
                pending_windows_paths.insert(normalized_path.clone());
                original_paths_by_normalized
                    .entry(normalized_path)
                    .or_default()
                    .push(app_path.clone());
                continue;
            }
        }

        let value = resolve_icon_data_url_uncached(&normalized_path);
        write_cached_icon_data_url(&normalized_path, value.clone());
        resolved.insert(app_path.clone(), value);
    }

    #[cfg(target_os = "windows")]
    if !pending_windows_paths.is_empty() {
        let pending_paths = pending_windows_paths.into_iter().collect::<Vec<_>>();
        let batched = extract_windows_icon_data_urls_batch(&pending_paths);

        for (normalized_path, original_paths) in original_paths_by_normalized {
            let value = batched
                .get(&normalized_path)
                .cloned()
                .unwrap_or_else(|| resolve_icon_data_url_uncached(&normalized_path));
            write_cached_icon_data_url(&normalized_path, value.clone());

            for original_path in original_paths {
                resolved.insert(original_path, value.clone());
            }
        }
    }

    resolved
}
