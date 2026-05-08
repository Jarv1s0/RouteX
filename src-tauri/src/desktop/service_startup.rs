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
$window.Width = 720
$window.SizeToContent = 'Height'
$window.WindowStartupLocation = 'CenterScreen'
$window.ResizeMode = 'NoResize'
$window.WindowStyle = 'None'
$window.AllowsTransparency = $true
$window.Background = 'Transparent'
$window.Topmost = $true
$window.FontFamily = 'Microsoft YaHei UI'

$shadow = New-Object System.Windows.Media.Effects.DropShadowEffect
$shadow.BlurRadius = 40
$shadow.ShadowDepth = 12
$shadow.Opacity = 0.2
$shadow.Color = [System.Windows.Media.Color]::FromRgb(31, 41, 55)

$card = New-Object System.Windows.Controls.Border
$card.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#F4F5F3')
$card.BorderBrush = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#EEF0ED')
$card.BorderThickness = 1
$card.CornerRadius = 16
$card.Padding = '0'
$card.Effect = $shadow

$grid = New-Object System.Windows.Controls.Grid
$grid.RowDefinitions.Add((New-Object System.Windows.Controls.RowDefinition -Property @{{ Height = 'Auto' }}))
$grid.RowDefinitions.Add((New-Object System.Windows.Controls.RowDefinition -Property @{{ Height = 'Auto' }}))
$grid.RowDefinitions.Add((New-Object System.Windows.Controls.RowDefinition -Property @{{ Height = 'Auto' }}))

$header = New-Object System.Windows.Controls.Grid
$header.Margin = '32,26,24,20'
$header.ColumnDefinitions.Add((New-Object System.Windows.Controls.ColumnDefinition -Property @{{ Width = '*' }}))
$header.ColumnDefinitions.Add((New-Object System.Windows.Controls.ColumnDefinition -Property @{{ Width = 'Auto' }}))

$titleStack = New-Object System.Windows.Controls.StackPanel
[System.Windows.Controls.Grid]::SetColumn($titleStack, 0)

$titleText = New-Object System.Windows.Controls.TextBlock
$titleText.Text = $title
$titleText.FontSize = 22
$titleText.FontWeight = 'Bold'
$titleText.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#11A45D')
$titleStack.Children.Add($titleText) | Out-Null

$subtitleText = New-Object System.Windows.Controls.TextBlock
$subtitleText.Text = $heading
$subtitleText.FontSize = 13.5
$subtitleText.FontWeight = 'SemiBold'
$subtitleText.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#9CA3AF')
$subtitleText.Margin = '0,8,0,0'
$subtitleText.TextWrapping = 'Wrap'
$titleStack.Children.Add($subtitleText) | Out-Null
$header.Children.Add($titleStack) | Out-Null

$closeButton = New-Object System.Windows.Controls.Border
$closeButton.Width = 42
$closeButton.Height = 42
$closeButton.CornerRadius = 21
$closeButton.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#F9FAFB')
$closeButton.Cursor = 'Hand'
$closeButton.ToolTip = '关闭'
$closeShadow = New-Object System.Windows.Media.Effects.DropShadowEffect
$closeShadow.BlurRadius = 14
$closeShadow.ShadowDepth = 2
$closeShadow.Opacity = 0.18
$closeShadow.Color = [System.Windows.Media.Color]::FromRgb(31, 41, 55)
$closeButton.Effect = $closeShadow
$closeText = New-Object System.Windows.Controls.TextBlock
$closeText.Text = '×'
$closeText.FontSize = 24
$closeText.LineHeight = 24
$closeText.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#6B7280')
$closeText.HorizontalAlignment = 'Center'
$closeText.VerticalAlignment = 'Center'
$closeButton.Child = $closeText
$closeButton.Add_MouseEnter({{ $closeButton.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#FFFFFF') }})
$closeButton.Add_MouseLeave({{ $closeButton.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#F9FAFB') }})
$closeButton.Add_MouseLeftButtonUp({{ $window.Close() }})
[System.Windows.Controls.Grid]::SetColumn($closeButton, 1)
$header.Children.Add($closeButton) | Out-Null
$grid.Children.Add($header) | Out-Null

$content = New-Object System.Windows.Controls.StackPanel
$content.Margin = '32,0,32,16'
[System.Windows.Controls.Grid]::SetRow($content, 1)

$messageCard = New-Object System.Windows.Controls.Border
$messageCard.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#FBFBFC')
$messageCard.BorderBrush = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#E9ECEF')
$messageCard.BorderThickness = 1
$messageCard.CornerRadius = 12
$messageCard.Padding = '24,20,24,22'
$messageCard.Margin = '0,0,0,14'
$messageShadow = New-Object System.Windows.Media.Effects.DropShadowEffect
$messageShadow.BlurRadius = 12
$messageShadow.ShadowDepth = 2
$messageShadow.Opacity = 0.08
$messageShadow.Color = [System.Windows.Media.Color]::FromRgb(31, 41, 55)
$messageCard.Effect = $messageShadow

$messageStack = New-Object System.Windows.Controls.StackPanel

$messageText = New-Object System.Windows.Controls.TextBlock
$messageText.Text = $message
$messageText.FontSize = 14
$messageText.LineHeight = 26
$messageText.TextWrapping = 'Wrap'
$messageText.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#4B5563')
$messageStack.Children.Add($messageText) | Out-Null
$messageCard.Child = $messageStack
$content.Children.Add($messageCard) | Out-Null

if ($detail.Trim().Length -gt 0) {{
  $detailBox = New-Object System.Windows.Controls.Border
  $detailBox.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#FBFBFC')
  $detailBox.BorderBrush = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#E9ECEF')
  $detailBox.BorderThickness = 1
  $detailBox.CornerRadius = 12
  $detailBox.Padding = '24,18,24,20'
  $detailBox.Margin = '0,0,0,0'
  $detailBox.Effect = $messageShadow
  $detailText = New-Object System.Windows.Controls.TextBlock
  $detailText.Text = $detail
  $detailText.FontSize = 12
  $detailText.LineHeight = 22
  $detailText.TextWrapping = 'Wrap'
  $detailText.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#6B7280')
  $detailBox.Child = $detailText
  $content.Children.Add($detailBox) | Out-Null
}}

$buttonBar = New-Object System.Windows.Controls.Border
$buttonBar.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#EEF0ED')
$buttonBar.BorderBrush = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#E3E6E1')
$buttonBar.BorderThickness = '0,1,0,0'
$buttonBar.Padding = '32,18,32,18'
[System.Windows.Controls.Grid]::SetRow($buttonBar, 2)

$buttonPanel = New-Object System.Windows.Controls.StackPanel
$buttonPanel.HorizontalAlignment = 'Right'
$buttonPanel.Orientation = 'Horizontal'
$okButton = New-Object System.Windows.Controls.Border
$okButton.Width = 118
$okButton.Height = 44
$okButton.CornerRadius = 16
$okButton.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#11A45D')
$okButton.BorderThickness = 0
$okButton.Cursor = 'Hand'
$okShadow = New-Object System.Windows.Media.Effects.DropShadowEffect
$okShadow.BlurRadius = 22
$okShadow.ShadowDepth = 7
$okShadow.Opacity = 0.26
$okShadow.Color = [System.Windows.Media.Color]::FromRgb(17, 164, 93)
$okButton.Effect = $okShadow
$okText = New-Object System.Windows.Controls.TextBlock
$okText.Text = '完成'
$okText.FontSize = 14
$okText.FontWeight = 'SemiBold'
$okText.Foreground = [System.Windows.Media.Brushes]::White
$okText.HorizontalAlignment = 'Center'
$okText.VerticalAlignment = 'Center'
$okButton.Child = $okText
$okButton.Add_MouseEnter({{ $okButton.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#0F9655') }})
$okButton.Add_MouseLeave({{ $okButton.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#11A45D') }})
$okButton.Add_MouseLeftButtonUp({{ $window.Close() }})
$buttonPanel.Children.Add($okButton) | Out-Null
$buttonBar.Child = $buttonPanel
$grid.Children.Add($content) | Out-Null
$grid.Children.Add($buttonBar) | Out-Null

$card.Child = $grid
$window.Content = $card
$window.Add_MouseLeftButtonDown({{
  try {{ $window.DragMove() }} catch {{}}
}})
$window.Add_KeyDown({{
  if ($_.Key -eq 'Escape' -or $_.Key -eq 'Enter') {{
    $window.Close()
  }}
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
        schtasks_command(&["/run", "/tn", routex_run_task_name()])
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
