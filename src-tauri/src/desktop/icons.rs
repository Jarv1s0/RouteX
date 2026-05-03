fn fetch_image_data_url(url: &str) -> Result<String, String> {
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

fn read_local_icon_data_url(app_path: &str) -> Option<String> {
    let path = PathBuf::from(app_path);
    if !path.exists() || !path.is_file() {
        return None;
    }

    let mime = guess_mime_from_path(&path);
    let bytes = fs::read(path).ok()?;
    Some(to_data_url(mime, &bytes))
}

fn icon_data_url_cache() -> &'static Mutex<HashMap<String, String>> {
    ICON_DATA_URL_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn is_icon_remote_or_data_resource(app_path: &str) -> bool {
    app_path.starts_with("data:")
        || app_path.starts_with("http://")
        || app_path.starts_with("https://")
}

fn current_exe_path_string() -> Option<String> {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.to_str().map(str::to_string))
}

fn path_file_name_eq(path: &Path, expected: &str) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|name| name.eq_ignore_ascii_case(expected))
}

#[cfg(target_os = "windows")]
fn path_has_component_eq(path: &Path, expected: &str) -> bool {
    path.components().any(|component| {
        component
            .as_os_str()
            .to_str()
            .is_some_and(|value| value.eq_ignore_ascii_case(expected))
    })
}

#[cfg(target_os = "windows")]
fn path_extension_eq(path: &Path, expected: &str) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case(expected))
}

#[cfg(target_os = "windows")]
fn windowsapps_parent_app_exe(path: &Path) -> Option<String> {
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
fn canonical_windows_icon_request_path(app_path: &str) -> Option<String> {
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

fn normalize_icon_request_path(app_path: &str) -> String {
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

fn read_cached_icon_data_url(app_path: &str) -> Option<String> {
    icon_data_url_cache()
        .lock()
        .ok()
        .and_then(|cache| cache.get(app_path).cloned())
}

fn write_cached_icon_data_url(app_path: &str, data_url: String) {
    if let Ok(mut cache) = icon_data_url_cache().lock() {
        cache.insert(app_path.to_string(), data_url);
    }
}

fn is_image_file_path(path: &Path) -> bool {
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
fn is_windows_icon_extractable_path(path: &Path) -> bool {
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
fn extract_windows_icon_data_url(app_path: &str) -> Option<String> {
    let path = Path::new(app_path);
    if !is_windows_icon_extractable_path(path) {
        return None;
    }

    let quoted_path = powershell_single_quoted(app_path);
    let script = format!(
        r#"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class RouteXIconExtractor
{{
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern uint PrivateExtractIcons(
        string szFileName,
        int nIconIndex,
        int cxIcon,
        int cyIcon,
        IntPtr[] phicon,
        uint[] piconid,
        uint nIcons,
        uint flags
    );

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool DestroyIcon(IntPtr hIcon);
}}
"@
$path = {quoted_path}
if (-not (Test-Path -LiteralPath $path)) {{
  exit 0
}}
$size = 256
$iconHandle = [IntPtr]::Zero
$handles = New-Object IntPtr[] 1
$iconIds = New-Object UInt32[] 1
$extracted = [RouteXIconExtractor]::PrivateExtractIcons($path, 0, $size, $size, $handles, $iconIds, 1, 0)
if ($extracted -gt 0 -and $handles[0] -ne [IntPtr]::Zero) {{
  $iconHandle = $handles[0]
}}

if ($iconHandle -ne [IntPtr]::Zero) {{
  $icon = [System.Drawing.Icon]::FromHandle($iconHandle).Clone()
  [RouteXIconExtractor]::DestroyIcon($iconHandle) | Out-Null
}} else {{
  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($path)
}}

if ($null -eq $icon) {{
  exit 0
}}
$bitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.DrawIcon($icon, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)))
$stream = New-Object System.IO.MemoryStream
$bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
$icon.Dispose()
[Convert]::ToBase64String($stream.ToArray())
"#
    );

    let output = run_powershell_script(&script).ok()?;
    let base64 = output.trim();
    if base64.is_empty() {
        None
    } else {
        Some(format!("data:image/png;base64,{base64}"))
    }
}

#[cfg(target_os = "windows")]
fn extract_windows_icon_data_urls_batch(app_paths: &[String]) -> HashMap<String, String> {
    if app_paths.is_empty() {
        return HashMap::new();
    }

    let encoded_paths = serde_json::to_vec(app_paths)
        .ok()
        .map(|bytes| BASE64_STANDARD.encode(bytes))
        .unwrap_or_default();
    if encoded_paths.is_empty() {
        return HashMap::new();
    }

    let script = format!(
        r#"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class RouteXIconExtractor
{{
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern uint PrivateExtractIcons(
        string szFileName,
        int nIconIndex,
        int cxIcon,
        int cyIcon,
        IntPtr[] phicon,
        uint[] piconid,
        uint nIcons,
        uint flags
    );

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool DestroyIcon(IntPtr hIcon);
}}
"@
$encodedPaths = '{encoded_paths}'
$json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encodedPaths))
$paths = $json | ConvertFrom-Json
if ($paths -isnot [System.Array]) {{
  $paths = @($paths)
}}

$size = 64
$result = @{{}}
foreach ($path in $paths) {{
  if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path -LiteralPath $path)) {{
    continue
  }}

  $icon = $null
  $iconHandle = [IntPtr]::Zero
  $handles = New-Object IntPtr[] 1
  $iconIds = New-Object UInt32[] 1
  $extracted = [RouteXIconExtractor]::PrivateExtractIcons($path, 0, $size, $size, $handles, $iconIds, 1, 0)
  if ($extracted -gt 0 -and $handles[0] -ne [IntPtr]::Zero) {{
    try {{
      $icon = [System.Drawing.Icon]::FromHandle($handles[0]).Clone()
    }} finally {{
      [RouteXIconExtractor]::DestroyIcon($handles[0]) | Out-Null
    }}
  }} else {{
    try {{
      $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($path)
    }} catch {{
      $icon = $null
    }}
  }}

  if ($null -eq $icon) {{
    continue
  }}

  $bitmap = $null
  $graphics = $null
  $stream = $null
  try {{
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawIcon($icon, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)))
    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $result[$path] = [Convert]::ToBase64String($stream.ToArray())
  }} finally {{
    if ($null -ne $stream) {{
      $stream.Dispose()
    }}
    if ($null -ne $graphics) {{
      $graphics.Dispose()
    }}
    if ($null -ne $bitmap) {{
      $bitmap.Dispose()
    }}
    $icon.Dispose()
  }}
}}

$result | ConvertTo-Json -Compress
"#
    );

    let output = match run_powershell_script(&script) {
        Ok(value) => value,
        Err(_) => return HashMap::new(),
    };

    serde_json::from_str::<HashMap<String, String>>(&output)
        .map(|items| {
            items
                .into_iter()
                .filter(|(_, base64)| !base64.trim().is_empty())
                .map(|(path, base64)| (path, format!("data:image/png;base64,{base64}")))
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(target_os = "macos")]
fn macos_bundle_ancestors(app_path: &str) -> Vec<PathBuf> {
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
fn find_macos_bundle_icon_path(bundle_path: &Path) -> Option<PathBuf> {
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
fn convert_macos_icon_to_png_data_url(icon_path: &Path) -> Option<String> {
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
fn extract_macos_icon_data_url(app_path: &str) -> Option<String> {
    let bundle_path = macos_bundle_ancestors(app_path)
        .into_iter()
        .find(|bundle_path| find_macos_bundle_icon_path(bundle_path).is_some())?;
    let icon_path = find_macos_bundle_icon_path(&bundle_path)?;
    convert_macos_icon_to_png_data_url(&icon_path)
}

#[cfg(target_os = "linux")]
fn find_linux_desktop_file(app_path: &str) -> Option<PathBuf> {
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
fn parse_linux_icon_name(content: &str) -> Option<String> {
    content
        .lines()
        .find_map(|line| line.strip_prefix("Icon=").map(str::trim))
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

#[cfg(target_os = "linux")]
fn resolve_linux_icon_path(icon_name: &str) -> Option<PathBuf> {
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
fn extract_linux_icon_data_url(app_path: &str) -> Option<String> {
    let desktop_file = find_linux_desktop_file(app_path)?;
    let content = fs::read_to_string(desktop_file).ok()?;
    let icon_name = parse_linux_icon_name(&content)?;
    let icon_path = resolve_linux_icon_path(&icon_name)?;
    read_local_icon_data_url(icon_path.to_str()?)
}

fn resolve_icon_data_url_uncached(normalized_path: &str) -> String {
    let path = Path::new(&normalized_path);
    if path.exists() && path.is_file() && is_image_file_path(path) {
        return read_local_icon_data_url(&normalized_path)
            .unwrap_or_else(|| default_icon_data_url().to_string());
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(value) = extract_windows_icon_data_url(&normalized_path) {
            return value;
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(value) = extract_macos_icon_data_url(&normalized_path) {
            return value;
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(value) = extract_linux_icon_data_url(&normalized_path) {
            return value;
        }
    }

    read_local_icon_data_url(&normalized_path)
        .unwrap_or_else(|| default_icon_data_url().to_string())
}

fn resolve_icon_data_url(app_path: &str) -> String {
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

fn resolve_icon_data_urls(app_paths: &[String]) -> HashMap<String, String> {
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

