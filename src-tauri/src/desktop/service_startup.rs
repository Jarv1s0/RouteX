#[cfg(target_os = "windows")]
fn show_windows_startup_dialog(title: &str, heading: &str, message: &str, detail: Option<&str>) {
    let title = powershell_single_quoted(title);
    let heading = powershell_single_quoted(heading);
    let message = powershell_single_quoted(message);
    let detail = powershell_single_quoted(detail.unwrap_or_default());
    let script = format!(
        r##"
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$title = {title}
$heading = {heading}
$message = {message}
$detail = {detail}

$window = New-Object System.Windows.Window
$window.Title = $title
$window.Width = 560
$window.SizeToContent = 'Height'
$window.WindowStartupLocation = 'CenterScreen'
$window.ResizeMode = 'NoResize'
$window.WindowStyle = 'None'
$window.AllowsTransparency = $true
$window.Background = 'Transparent'
$window.Topmost = $true
$window.FontFamily = 'Microsoft YaHei UI'

$shadow = New-Object System.Windows.Media.Effects.DropShadowEffect
$shadow.BlurRadius = 26
$shadow.ShadowDepth = 8
$shadow.Opacity = 0.22
$shadow.Color = [System.Windows.Media.Color]::FromRgb(15, 23, 42)

$card = New-Object System.Windows.Controls.Border
$card.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#F8FAFC')
$card.BorderBrush = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#DDE7F3')
$card.BorderThickness = 1
$card.CornerRadius = 14
$card.Padding = '0'
$card.Effect = $shadow

$grid = New-Object System.Windows.Controls.Grid
$grid.RowDefinitions.Add((New-Object System.Windows.Controls.RowDefinition -Property @{{ Height = 'Auto' }}))
$grid.RowDefinitions.Add((New-Object System.Windows.Controls.RowDefinition -Property @{{ Height = 'Auto' }}))
$grid.RowDefinitions.Add((New-Object System.Windows.Controls.RowDefinition -Property @{{ Height = 'Auto' }}))

$header = New-Object System.Windows.Controls.Grid
$header.Margin = '24,20,18,14'
$header.ColumnDefinitions.Add((New-Object System.Windows.Controls.ColumnDefinition -Property @{{ Width = '*' }}))
$header.ColumnDefinitions.Add((New-Object System.Windows.Controls.ColumnDefinition -Property @{{ Width = 'Auto' }}))

$titleText = New-Object System.Windows.Controls.TextBlock
$titleText.Text = $title
$titleText.FontSize = 18
$titleText.FontWeight = 'SemiBold'
$titleText.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#0F172A')
$titleText.VerticalAlignment = 'Center'
[System.Windows.Controls.Grid]::SetColumn($titleText, 0)
$header.Children.Add($titleText) | Out-Null

$closeButton = New-Object System.Windows.Controls.Button
$closeButton.Content = '×'
$closeButton.Width = 32
$closeButton.Height = 32
$closeButton.FontSize = 20
$closeButton.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#64748B')
$closeButton.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#EEF2F7')
$closeButton.BorderThickness = 0
$closeButton.Cursor = 'Hand'
$closeButton.Add_Click({{ $window.Close() }})
[System.Windows.Controls.Grid]::SetColumn($closeButton, 1)
$header.Children.Add($closeButton) | Out-Null
$grid.Children.Add($header) | Out-Null

$content = New-Object System.Windows.Controls.StackPanel
$content.Margin = '26,4,26,22'
[System.Windows.Controls.Grid]::SetRow($content, 1)

$badgeRow = New-Object System.Windows.Controls.StackPanel
$badgeRow.Orientation = 'Horizontal'
$badgeRow.Margin = '0,0,0,14'

$icon = New-Object System.Windows.Controls.Border
$icon.Width = 36
$icon.Height = 36
$icon.CornerRadius = 18
$icon.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#E0F2FE')
$icon.Margin = '0,0,12,0'
$iconText = New-Object System.Windows.Controls.TextBlock
$iconText.Text = 'i'
$iconText.FontSize = 22
$iconText.FontWeight = 'Bold'
$iconText.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#0284C7')
$iconText.HorizontalAlignment = 'Center'
$iconText.VerticalAlignment = 'Center'
$icon.Child = $iconText
$badgeRow.Children.Add($icon) | Out-Null

$headingText = New-Object System.Windows.Controls.TextBlock
$headingText.Text = $heading
$headingText.FontSize = 15
$headingText.FontWeight = 'SemiBold'
$headingText.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#0F172A')
$headingText.TextWrapping = 'Wrap'
$headingText.VerticalAlignment = 'Center'
$headingText.MaxWidth = 448
$badgeRow.Children.Add($headingText) | Out-Null
$content.Children.Add($badgeRow) | Out-Null

$messageText = New-Object System.Windows.Controls.TextBlock
$messageText.Text = $message
$messageText.FontSize = 13
$messageText.LineHeight = 24
$messageText.TextWrapping = 'Wrap'
$messageText.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#334155')
$messageText.Margin = '48,0,0,0'
$content.Children.Add($messageText) | Out-Null

if ($detail.Trim().Length -gt 0) {{
  $detailBox = New-Object System.Windows.Controls.Border
  $detailBox.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#EEF2F7')
  $detailBox.CornerRadius = 8
  $detailBox.Padding = '12,10,12,10'
  $detailBox.Margin = '48,16,0,0'
  $detailText = New-Object System.Windows.Controls.TextBlock
  $detailText.Text = $detail
  $detailText.FontSize = 12
  $detailText.LineHeight = 20
  $detailText.TextWrapping = 'Wrap'
  $detailText.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#475569')
  $detailBox.Child = $detailText
  $content.Children.Add($detailBox) | Out-Null
}}

$buttonBar = New-Object System.Windows.Controls.Border
$buttonBar.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#F1F5F9')
$buttonBar.Padding = '24,16,24,16'
[System.Windows.Controls.Grid]::SetRow($buttonBar, 2)

$buttonPanel = New-Object System.Windows.Controls.StackPanel
$buttonPanel.HorizontalAlignment = 'Right'
$okButton = New-Object System.Windows.Controls.Button
$okButton.Content = '知道了'
$okButton.Width = 104
$okButton.Height = 36
$okButton.FontSize = 13
$okButton.FontWeight = 'SemiBold'
$okButton.Foreground = [System.Windows.Media.Brushes]::White
$okButton.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#0EA5E9')
$okButton.BorderThickness = 0
$okButton.Cursor = 'Hand'
$okButton.Add_Click({{ $window.Close() }})
$buttonPanel.Children.Add($okButton) | Out-Null
$buttonBar.Child = $buttonPanel
$grid.Children.Add($content) | Out-Null
$grid.Children.Add($buttonBar) | Out-Null

$card.Child = $grid
$window.Content = $card
$window.Add_MouseLeftButtonDown({{
  try {{ $window.DragMove() }} catch {{}}
}})
$window.ShowDialog() | Out-Null
"##
    );

    let _ = run_interactive_powershell_script(&script);
}

#[cfg(target_os = "windows")]
fn show_windows_startup_admin_required_dialog() {
    show_windows_startup_dialog(
        "首次启动需要管理员权限",
        "需要完成一次管理员授权",
        "首次安装后，请完全退出 RouteX（包括托盘后台），然后右键点击应用图标，选择“以管理员身份运行”。\r\n\r\n注册完成后，后续可以直接双击正常打开，不需要每次手动管理员运行。",
        None,
    );
}

#[cfg(target_os = "windows")]
fn show_windows_startup_task_registration_failed_dialog(create_error: &str) {
    show_windows_startup_dialog(
        "提权任务注册失败",
        "任务计划没有注册成功",
        "请完全退出 RouteX（包括托盘后台），右键点击应用图标，选择“以管理员身份运行”后再打开一次。\r\n\r\n如果已经按管理员身份运行仍失败，通常是 Windows 任务计划程序创建失败，或被系统策略/安全软件拦截。",
        Some(&format!("错误详情：{create_error}")),
    );
}

#[cfg(target_os = "windows")]
fn show_windows_startup_relaunch_failed_dialog(create_error: &str, run_error: &str) {
    show_windows_startup_dialog(
        "自动提权启动失败",
        "没有成功拉起高权限实例",
        "已检测到提权任务，但自动拉起高权限实例失败。\r\n\r\n请到“内核设置 -> 任务状态”重新注册后再试。",
        Some(&format!("创建任务错误：{create_error}\r\n启动任务错误：{run_error}")),
    );
}

fn run_elevate_task(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        write_elevate_task_params(app)?;
        ensure_routex_run_binary_for_task(app)?;
        return schtasks_command(&["/run", "/tn", routex_run_task_name()]);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("当前平台未实现任务计划启动".to_string())
    }
}

fn ensure_elevated_startup(app: &tauri::AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        if cfg!(debug_assertions) {
            return Ok(true);
        }

        if std::env::args().any(|arg| arg.eq_ignore_ascii_case("noadmin")) {
            return Ok(true);
        }

        if read_core_permission_mode(app)? == "service" {
            return Ok(true);
        }

        match create_elevate_task(app) {
            Ok(()) => Ok(true),
            Err(create_error) => {
                if !check_elevate_task_matches_current_app(app) {
                    if looks_like_windows_permission_error(&create_error) {
                        show_windows_startup_admin_required_dialog();
                    } else {
                        show_windows_startup_task_registration_failed_dialog(&create_error);
                    }
                    // Allow the shell to start even if the elevate task is stale or not yet
                    // registered. Users can still repair the permission state from the UI.
                    return Ok(true);
                }

                match run_elevate_task(app) {
                    Ok(()) => Ok(false),
                    Err(run_error) => {
                        show_windows_startup_relaunch_failed_dialog(&create_error, &run_error);
                        Ok(true)
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Ok(true)
    }
}

