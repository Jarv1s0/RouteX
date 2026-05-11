!macro NSIS_HOOK_PREINSTALL
  Push $0
  Push $1
  DetailPrint "正在关闭已运行的 RouteX..."
  nsExec::ExecToStack `powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$sidecarDir = [System.IO.Path]::GetFullPath((Join-Path ([System.IO.Path]::GetFullPath('$INSTDIR')) 'extra\sidecar')); function Get-RouteXProcess($name) { $procs = @(Get-Process -Name $name -ErrorAction SilentlyContinue); if ($name -eq 'routex') { return $procs }; return @($procs | Where-Object { try { [System.IO.Path]::GetFullPath($_.Path).StartsWith($sidecarDir, [System.StringComparison]::OrdinalIgnoreCase) } catch { $false } }) }; $failed = @(); foreach ($name in @('routex', 'mihomo', 'mihomo-alpha')) { $procs = @(Get-RouteXProcess $name); if ($procs.Count -eq 0) { continue }; $procs | Stop-Process -Force -ErrorAction SilentlyContinue; Wait-Process -Id ($procs.Id) -Timeout 15 -ErrorAction SilentlyContinue; if (@(Get-RouteXProcess $name).Count -gt 0) { $failed += $name } }; if ($failed.Count -gt 0) { exit 1 } else { exit 0 }"`
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_ICONSTOP|MB_OK "无法关闭正在运行的 RouteX 或 Mihomo 内核。$\r$\n$\r$\n请先完全退出 RouteX（包括托盘后台），并确认 Mihomo 内核已停止后重试。$\r$\n如果 RouteX 是以管理员身份运行，请右键安装包选择“以管理员身份运行”后重试。"
    Pop $1
    Pop $0
    Abort
  ${EndIf}
  Pop $1
  Pop $0
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
    SetShellVarContext current
    RmDir /r "$APPDATA\routex.app"
    RmDir /r "$LOCALAPPDATA\routex.app"
  ${EndIf}
!macroend
