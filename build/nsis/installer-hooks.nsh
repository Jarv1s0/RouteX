!macro ROUTEX_CLOSE_RUNNING_PROCESSES
  Push $0
  Push $1
  Push $2
  DetailPrint "正在关闭已运行的 RouteX..."
  InitPluginsDir
  StrCpy $2 "$PLUGINSDIR\routex-close-processes.ps1"
  FileOpen $1 "$2" w
  FileWrite $1 "$$installDir = [System.IO.Path]::GetFullPath($$args[0])$\r$\n"
  FileWrite $1 "$$candidateDirs = @((Join-Path $$installDir 'extra\sidecar'))$\r$\n"
  FileWrite $1 "foreach ($$base in @($$env:APPDATA, $$env:LOCALAPPDATA)) {$\r$\n"
  FileWrite $1 "  if ([string]::IsNullOrWhiteSpace($$base)) { continue }$\r$\n"
  FileWrite $1 "  $$candidateDirs += (Join-Path $$base 'routex.app\runtime-assets\sidecar')$\r$\n"
  FileWrite $1 "  $$candidateDirs += (Join-Path $$base 'com.jarv1s0.routex.tauri\runtime-assets\sidecar')$\r$\n"
  FileWrite $1 "}$\r$\n"
  FileWrite $1 "$$candidateDirs = @($$candidateDirs | ForEach-Object { try { [System.IO.Path]::GetFullPath($$_).TrimEnd('\', '/') } catch { $$null } } | Where-Object { $$_ })$\r$\n"
  FileWrite $1 "function Test-UnderRouteXDir($$path) {$\r$\n"
  FileWrite $1 "  if ([string]::IsNullOrWhiteSpace($$path)) { return $$false }$\r$\n"
  FileWrite $1 "  try {$\r$\n"
  FileWrite $1 "    $$full = [System.IO.Path]::GetFullPath($$path).TrimEnd('\', '/')$\r$\n"
  FileWrite $1 "    foreach ($$dir in $$candidateDirs) {$\r$\n"
  FileWrite $1 "      if ($$full.Equals($$dir, [System.StringComparison]::OrdinalIgnoreCase) -or $$full.StartsWith($$dir + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { return $$true }$\r$\n"
  FileWrite $1 "    }$\r$\n"
  FileWrite $1 "  } catch {}$\r$\n"
  FileWrite $1 "  return $$false$\r$\n"
  FileWrite $1 "}$\r$\n"
  FileWrite $1 "function Get-ProcessPath($$proc) {$\r$\n"
  FileWrite $1 "  try { if (-not [string]::IsNullOrWhiteSpace($$proc.Path)) { return $$proc.Path } } catch {}$\r$\n"
  FileWrite $1 "  try { return (Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $$proc.Id) -ErrorAction SilentlyContinue).ExecutablePath } catch { return $$null }$\r$\n"
  FileWrite $1 "}$\r$\n"
  FileWrite $1 "function Get-RouteXProcess($$name) {$\r$\n"
  FileWrite $1 "  $$procs = @(Get-Process -Name $$name -ErrorAction SilentlyContinue)$\r$\n"
  FileWrite $1 "  if ($$name -eq 'routex') { return $$procs }$\r$\n"
  FileWrite $1 "  return @($$procs | Where-Object { Test-UnderRouteXDir (Get-ProcessPath $$_) })$\r$\n"
  FileWrite $1 "}$\r$\n"
  FileWrite $1 "$$processNames = @('routex', 'mihomo', 'mihomo-alpha')$\r$\n"
  FileWrite $1 "function Get-TargetProcesses() {$\r$\n"
  FileWrite $1 "  $$targets = @()$\r$\n"
  FileWrite $1 "  foreach ($$name in $$processNames) { $$targets += @(Get-RouteXProcess $$name) }$\r$\n"
  FileWrite $1 "  return @($$targets | Sort-Object Id -Unique)$\r$\n"
  FileWrite $1 "}$\r$\n"
  FileWrite $1 "function Stop-ProcessTree($$proc) {$\r$\n"
  FileWrite $1 "  try { & (Join-Path $$env:SystemRoot 'System32\taskkill.exe') /PID $$proc.Id /T /F | Out-Null } catch {}$\r$\n"
  FileWrite $1 "  try { Stop-Process -Id $$proc.Id -Force -ErrorAction SilentlyContinue } catch {}$\r$\n"
  FileWrite $1 "}$\r$\n"
  FileWrite $1 "$$deadline = [DateTime]::UtcNow.AddSeconds(60)$\r$\n"
  FileWrite $1 "do {$\r$\n"
  FileWrite $1 "  $$procs = @(Get-TargetProcesses)$\r$\n"
  FileWrite $1 "  if ($$procs.Count -eq 0) { exit 0 }$\r$\n"
  FileWrite $1 "  foreach ($$proc in $$procs) { Stop-ProcessTree $$proc }$\r$\n"
  FileWrite $1 "  foreach ($$proc in $$procs) {$\r$\n"
  FileWrite $1 "    $$remaining = [int][Math]::Ceiling(($$deadline - [DateTime]::UtcNow).TotalSeconds)$\r$\n"
  FileWrite $1 "    if ($$remaining -le 0) { break }$\r$\n"
  FileWrite $1 "    Wait-Process -Id $$proc.Id -Timeout ([Math]::Min(5, $$remaining)) -ErrorAction SilentlyContinue$\r$\n"
  FileWrite $1 "  }$\r$\n"
  FileWrite $1 "  Start-Sleep -Milliseconds 500$\r$\n"
  FileWrite $1 "} while ([DateTime]::UtcNow -lt $$deadline)$\r$\n"
  FileWrite $1 "if (@(Get-TargetProcesses).Count -gt 0) { exit 1 }$\r$\n"
  FileWrite $1 "exit 0$\r$\n"
  FileClose $1
  nsExec::ExecToStack `powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$2" "$INSTDIR"`
  Pop $0
  Pop $1
  Delete "$2"
  ${If} $0 != 0
    MessageBox MB_ICONSTOP|MB_OK "无法关闭正在运行的 RouteX 或 Mihomo 内核。$\r$\n$\r$\n请先完全退出 RouteX（包括托盘后台），并确认 Mihomo 内核已停止后重试。$\r$\n如果 RouteX 是以管理员身份运行，请右键安装包选择“以管理员身份运行”后重试。"
    Pop $2
    Pop $1
    Pop $0
    Abort
  ${EndIf}
  Pop $2
  Pop $1
  Pop $0
!macroend

!macro ROUTEX_REFRESH_SHORTCUT_ICON LINK_PATH
  ${If} ${FileExists} `${LINK_PATH}`
    CreateShortcut `${LINK_PATH}` "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\resources\icon.ico" 0
    !insertmacro SetLnkAppUserModelId `${LINK_PATH}`
  ${EndIf}
!macroend

!macro ROUTEX_QUEUE_POST_GUI_SHORTCUT_REFRESH
  Push $0
  Push $1
  Push $2
  System::Call 'kernel32::GetCurrentProcessId() i.r0'
  StrCpy $2 "$TEMP\routex-refresh-shortcuts-$0.ps1"
  FileOpen $1 "$2" w
  FileWrite $1 "$$installerPid = [int]$$args[0]$\r$\n"
  FileWrite $1 "$$installDir = [System.IO.Path]::GetFullPath($$args[1])$\r$\n"
  FileWrite $1 "try { Wait-Process -Id $$installerPid -Timeout 300 -ErrorAction SilentlyContinue } catch {}$\r$\n"
  FileWrite $1 "Start-Sleep -Milliseconds 500$\r$\n"
  FileWrite $1 "$$target = Join-Path $$installDir '${MAINBINARYNAME}.exe'$\r$\n"
  FileWrite $1 "$$icon = Join-Path $$installDir 'resources\icon.ico'$\r$\n"
  FileWrite $1 "if (-not (Test-Path -LiteralPath $$target)) { exit 0 }$\r$\n"
  FileWrite $1 "$$dirs = @([Environment]::GetFolderPath('CommonDesktopDirectory'), [Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('CommonPrograms'), [Environment]::GetFolderPath('Programs')) | Where-Object { -not [string]::IsNullOrWhiteSpace($$_) } | Select-Object -Unique$\r$\n"
  FileWrite $1 "$$shell = New-Object -ComObject WScript.Shell$\r$\n"
  FileWrite $1 "foreach ($$dir in $$dirs) {$\r$\n"
  FileWrite $1 "  $$link = Join-Path $$dir '${PRODUCTNAME}.lnk'$\r$\n"
  FileWrite $1 "  if (-not (Test-Path -LiteralPath $$link)) { continue }$\r$\n"
  FileWrite $1 "  $$shortcut = $$shell.CreateShortcut($$link)$\r$\n"
  FileWrite $1 "  $$shortcut.TargetPath = $$target$\r$\n"
  FileWrite $1 "  $$shortcut.WorkingDirectory = $$installDir$\r$\n"
  FileWrite $1 "  if (Test-Path -LiteralPath $$icon) { $$shortcut.IconLocation = $$icon + ',0' }$\r$\n"
  FileWrite $1 "  $$shortcut.Save()$\r$\n"
  FileWrite $1 "}$\r$\n"
  FileWrite $1 "try { Remove-Item -LiteralPath $$PSCommandPath -Force -ErrorAction SilentlyContinue } catch {}$\r$\n"
  FileClose $1
  Exec `powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$2" "$0" "$INSTDIR"`
  Pop $2
  Pop $1
  Pop $0
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro ROUTEX_CLOSE_RUNNING_PROCESSES
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro ROUTEX_CLOSE_RUNNING_PROCESSES
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Tauri's finish-page shortcut checkbox calls CreateOrUpdateDesktopShortcut,
  ; but that function returns early in update mode. In GUI mode, keep the choice
  ; user-controlled and let a checked box actually create the shortcut.
  ${If} $PassiveMode <> 1
  ${AndIfNot} ${Silent}
    StrCpy $UpdateMode 0
    !insertmacro ROUTEX_QUEUE_POST_GUI_SHORTCUT_REFRESH
  ${EndIf}
  !insertmacro ROUTEX_REFRESH_SHORTCUT_ICON "$DESKTOP\${PRODUCTNAME}.lnk"
  !if "${STARTMENUFOLDER}" != ""
    !insertmacro ROUTEX_REFRESH_SHORTCUT_ICON "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
  !else
    !insertmacro ROUTEX_REFRESH_SHORTCUT_ICON "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  !endif
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
    SetShellVarContext current
    RmDir /r "$APPDATA\routex.app"
    RmDir /r "$LOCALAPPDATA\routex.app"
  ${EndIf}
!macroend
