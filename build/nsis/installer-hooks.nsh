!define ROUTEX_PRODUCT_NAME "RouteX"
!define ROUTEX_MAIN_BINARY "routex"
!define ROUTEX_SERVICE_NAME "RouteXService"
!define ROUTEX_SERVICE_PATH "tools\routex-service.exe"
!define ROUTEX_BUNDLE_ID "com.jarv1s0.routex.tauri"

Var ROUTEX_SERVICE_WAS_INSTALLED
Var ROUTEX_SERVICE_WAS_RUNNING

!macro ROUTEX_STOP_SERVICE_BEFORE_FILE_WRITE
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  StrCpy $ROUTEX_SERVICE_WAS_INSTALLED 0
  StrCpy $ROUTEX_SERVICE_WAS_RUNNING 0
  DetailPrint "正在停止旧版 RouteX 服务..."
  InitPluginsDir
  StrCpy $2 "$PLUGINSDIR\routex-stop-service.ps1"
  StrCpy $3 "$PLUGINSDIR\routex-service-installed.flag"
  StrCpy $4 "$PLUGINSDIR\routex-service-running.flag"
  Delete "$3"
  Delete "$4"
  FileOpen $1 "$2" w
  FileWrite $1 "$$installDir = [System.IO.Path]::GetFullPath($$args[0])$\r$\n"
  FileWrite $1 "$$installedFlag = $$args[1]$\r$\n"
  FileWrite $1 "$$runningFlag = $$args[2]$\r$\n"
  FileWrite $1 "$$serviceName = '${ROUTEX_SERVICE_NAME}'$\r$\n"
  FileWrite $1 "$$serviceBinary = Join-Path $$installDir '${ROUTEX_SERVICE_PATH}'$\r$\n"
  FileWrite $1 "function Get-RouteXService { Get-Service -Name $$serviceName -ErrorAction SilentlyContinue }$\r$\n"
  FileWrite $1 "function Wait-ServiceState($$state, $$seconds) {$\r$\n"
  FileWrite $1 "  $$deadline = [DateTime]::UtcNow.AddSeconds($$seconds)$\r$\n"
  FileWrite $1 "  do {$\r$\n"
  FileWrite $1 "    $$svc = Get-RouteXService$\r$\n"
  FileWrite $1 "    if (-not $$svc) { return $$state -eq 'Absent' }$\r$\n"
  FileWrite $1 "    if ($$state -ne 'Absent' -and $$svc.Status.ToString() -eq $$state) { return $$true }$\r$\n"
  FileWrite $1 "    Start-Sleep -Milliseconds 500$\r$\n"
  FileWrite $1 "  } while ([DateTime]::UtcNow -lt $$deadline)$\r$\n"
  FileWrite $1 "  return $$false$\r$\n"
  FileWrite $1 "}$\r$\n"
  FileWrite $1 "function Wait-ServiceBinaryReleased($$seconds) {$\r$\n"
  FileWrite $1 "  if (-not (Test-Path -LiteralPath $$serviceBinary)) { return $$true }$\r$\n"
  FileWrite $1 "  $$target = [System.IO.Path]::GetFullPath($$serviceBinary)$\r$\n"
  FileWrite $1 "  $$deadline = [DateTime]::UtcNow.AddSeconds($$seconds)$\r$\n"
  FileWrite $1 "  do {$\r$\n"
  FileWrite $1 "    $$holders = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {$\r$\n"
  FileWrite $1 "      if ($$_.Name -ne 'routex-service.exe') { return $$false }$\r$\n"
  FileWrite $1 "      try { [System.IO.Path]::GetFullPath($$_.ExecutablePath) -eq $$target } catch { $$false }$\r$\n"
  FileWrite $1 "    })$\r$\n"
  FileWrite $1 "    if ($$holders.Count -eq 0) { return $$true }$\r$\n"
  FileWrite $1 "    Start-Sleep -Milliseconds 500$\r$\n"
  FileWrite $1 "  } while ([DateTime]::UtcNow -lt $$deadline)$\r$\n"
  FileWrite $1 "  return $$false$\r$\n"
  FileWrite $1 "}$\r$\n"
  FileWrite $1 "$$svc = Get-RouteXService$\r$\n"
  FileWrite $1 "if (-not $$svc) { exit 0 }$\r$\n"
  FileWrite $1 "New-Item -ItemType File -Path $$installedFlag -Force | Out-Null$\r$\n"
  FileWrite $1 "if ($$svc.Status -eq 'Running') { New-Item -ItemType File -Path $$runningFlag -Force | Out-Null }$\r$\n"
  FileWrite $1 "if ($$svc.Status -ne 'Stopped') {$\r$\n"
  FileWrite $1 "  if (Test-Path -LiteralPath $$serviceBinary) { try { & $$serviceBinary service stop | Out-Null } catch {} }$\r$\n"
  FileWrite $1 "  try { & (Join-Path $$env:SystemRoot 'System32\sc.exe') stop $$serviceName | Out-Null } catch {}$\r$\n"
  FileWrite $1 "  if (-not (Wait-ServiceState 'Stopped' 30)) { exit 1 }$\r$\n"
  FileWrite $1 "}$\r$\n"
  FileWrite $1 "if (Wait-ServiceBinaryReleased 30) { exit 0 }$\r$\n"
  FileWrite $1 "exit 1$\r$\n"
  FileClose $1
  nsExec::ExecToStack `powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$2" "$INSTDIR" "$3" "$4"`
  Pop $0
  Pop $1
  ${If} ${FileExists} "$3"
    StrCpy $ROUTEX_SERVICE_WAS_INSTALLED 1
  ${EndIf}
  ${If} ${FileExists} "$4"
    StrCpy $ROUTEX_SERVICE_WAS_RUNNING 1
  ${EndIf}
  Delete "$2"
  Delete "$3"
  Delete "$4"
  ${If} $0 != 0
    MessageBox MB_ICONSTOP|MB_OK "无法停止旧版 RouteX 服务。$\r$\n$\r$\n请确认安装器以管理员身份运行，并稍后重试。"
    Pop $4
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Abort
  ${EndIf}
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
!macroend

!macro ROUTEX_REMOVE_SERVICE_BEFORE_FILE_WRITE
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  StrCpy $ROUTEX_SERVICE_WAS_INSTALLED 0
  StrCpy $ROUTEX_SERVICE_WAS_RUNNING 0
  DetailPrint "正在卸载旧版 RouteX 服务..."
  InitPluginsDir
  StrCpy $2 "$PLUGINSDIR\routex-remove-service.ps1"
  StrCpy $3 "$PLUGINSDIR\routex-service-installed.flag"
  StrCpy $4 "$PLUGINSDIR\routex-service-running.flag"
  Delete "$3"
  Delete "$4"
  FileOpen $1 "$2" w
  FileWrite $1 "$$installDir = [System.IO.Path]::GetFullPath($$args[0])$\r$\n"
  FileWrite $1 "$$installedFlag = $$args[1]$\r$\n"
  FileWrite $1 "$$runningFlag = $$args[2]$\r$\n"
  FileWrite $1 "$$serviceName = '${ROUTEX_SERVICE_NAME}'$\r$\n"
  FileWrite $1 "$$serviceBinary = Join-Path $$installDir '${ROUTEX_SERVICE_PATH}'$\r$\n"
  FileWrite $1 "function Get-RouteXService { Get-Service -Name $$serviceName -ErrorAction SilentlyContinue }$\r$\n"
  FileWrite $1 "function Wait-ServiceState($$state, $$seconds) {$\r$\n"
  FileWrite $1 "  $$deadline = [DateTime]::UtcNow.AddSeconds($$seconds)$\r$\n"
  FileWrite $1 "  do {$\r$\n"
  FileWrite $1 "    $$svc = Get-RouteXService$\r$\n"
  FileWrite $1 "    if (-not $$svc) { return $$state -eq 'Absent' }$\r$\n"
  FileWrite $1 "    if ($$state -ne 'Absent' -and $$svc.Status.ToString() -eq $$state) { return $$true }$\r$\n"
  FileWrite $1 "    Start-Sleep -Milliseconds 500$\r$\n"
  FileWrite $1 "  } while ([DateTime]::UtcNow -lt $$deadline)$\r$\n"
  FileWrite $1 "  return $$false$\r$\n"
  FileWrite $1 "}$\r$\n"
  FileWrite $1 "function Wait-ServiceBinaryReleased($$seconds) {$\r$\n"
  FileWrite $1 "  if (-not (Test-Path -LiteralPath $$serviceBinary)) { return $$true }$\r$\n"
  FileWrite $1 "  $$target = [System.IO.Path]::GetFullPath($$serviceBinary)$\r$\n"
  FileWrite $1 "  $$deadline = [DateTime]::UtcNow.AddSeconds($$seconds)$\r$\n"
  FileWrite $1 "  do {$\r$\n"
  FileWrite $1 "    $$holders = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {$\r$\n"
  FileWrite $1 "      if ($$_.Name -ne 'routex-service.exe') { return $$false }$\r$\n"
  FileWrite $1 "      try { [System.IO.Path]::GetFullPath($$_.ExecutablePath) -eq $$target } catch { $$false }$\r$\n"
  FileWrite $1 "    })$\r$\n"
  FileWrite $1 "    if ($$holders.Count -eq 0) { return $$true }$\r$\n"
  FileWrite $1 "    Start-Sleep -Milliseconds 500$\r$\n"
  FileWrite $1 "  } while ([DateTime]::UtcNow -lt $$deadline)$\r$\n"
  FileWrite $1 "  return $$false$\r$\n"
  FileWrite $1 "}$\r$\n"
  FileWrite $1 "$$svc = Get-RouteXService$\r$\n"
  FileWrite $1 "if (-not $$svc) { exit 0 }$\r$\n"
  FileWrite $1 "New-Item -ItemType File -Path $$installedFlag -Force | Out-Null$\r$\n"
  FileWrite $1 "if ($$svc.Status -eq 'Running') { New-Item -ItemType File -Path $$runningFlag -Force | Out-Null }$\r$\n"
  FileWrite $1 "if (Test-Path -LiteralPath $$serviceBinary) {$\r$\n"
  FileWrite $1 "  try { & $$serviceBinary service stop | Out-Null } catch {}$\r$\n"
  FileWrite $1 "  try { & $$serviceBinary service uninstall | Out-Null } catch {}$\r$\n"
  FileWrite $1 "  if ((Wait-ServiceState 'Absent' 30) -and (Wait-ServiceBinaryReleased 30)) { exit 0 }$\r$\n"
  FileWrite $1 "}$\r$\n"
  FileWrite $1 "$$svc = Get-RouteXService$\r$\n"
  FileWrite $1 "if ($$svc -and $$svc.Status -ne 'Stopped') {$\r$\n"
  FileWrite $1 "  try { & (Join-Path $$env:SystemRoot 'System32\sc.exe') stop $$serviceName | Out-Null } catch {}$\r$\n"
  FileWrite $1 "  [void](Wait-ServiceState 'Stopped' 30)$\r$\n"
  FileWrite $1 "}$\r$\n"
  FileWrite $1 "if (Get-RouteXService) { try { & (Join-Path $$env:SystemRoot 'System32\sc.exe') delete $$serviceName | Out-Null } catch {} }$\r$\n"
  FileWrite $1 "if ((Wait-ServiceState 'Absent' 30) -and (Wait-ServiceBinaryReleased 30)) { exit 0 }$\r$\n"
  FileWrite $1 "exit 1$\r$\n"
  FileClose $1
  nsExec::ExecToStack `powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$2" "$INSTDIR" "$3" "$4"`
  Pop $0
  Pop $1
  ${If} ${FileExists} "$3"
    StrCpy $ROUTEX_SERVICE_WAS_INSTALLED 1
  ${EndIf}
  ${If} ${FileExists} "$4"
    StrCpy $ROUTEX_SERVICE_WAS_RUNNING 1
  ${EndIf}
  Delete "$2"
  Delete "$3"
  Delete "$4"
  ${If} $0 != 0
    MessageBox MB_ICONSTOP|MB_OK "无法卸载旧版 RouteX 服务。$\r$\n$\r$\n请确认安装器以管理员身份运行，并稍后重试。"
    Pop $4
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Abort
  ${EndIf}
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
!macroend

!macro ROUTEX_RESTORE_SERVICE_AFTER_FILE_WRITE
  ${If} $ROUTEX_SERVICE_WAS_INSTALLED = 1
    Push $0
    Push $1
    Push $2
    DetailPrint "正在恢复 RouteX 服务状态..."
    InitPluginsDir
    StrCpy $2 "$PLUGINSDIR\routex-restore-service.ps1"
    FileOpen $1 "$2" w
    FileWrite $1 "$$installDir = [System.IO.Path]::GetFullPath($$args[0])$\r$\n"
    FileWrite $1 "$$wasRunning = $$args[1] -eq '1'$\r$\n"
    FileWrite $1 "$$serviceName = '${ROUTEX_SERVICE_NAME}'$\r$\n"
    FileWrite $1 "$$serviceBinary = Join-Path $$installDir '${ROUTEX_SERVICE_PATH}'$\r$\n"
    FileWrite $1 "if (-not (Test-Path -LiteralPath $$serviceBinary)) { exit 1 }$\r$\n"
    FileWrite $1 "$$svc = Get-Service -Name $$serviceName -ErrorAction SilentlyContinue$\r$\n"
    FileWrite $1 "if (-not $$svc) {$\r$\n"
    FileWrite $1 "  try { & $$serviceBinary service install | Out-Null } catch { exit 1 }$\r$\n"
    FileWrite $1 "  if ($$LASTEXITCODE -ne 0) { exit 1 }$\r$\n"
    FileWrite $1 "}$\r$\n"
    FileWrite $1 "if ($$wasRunning) {$\r$\n"
    FileWrite $1 "  try { & $$serviceBinary service start | Out-Null } catch { exit 1 }$\r$\n"
    FileWrite $1 "  if ($$LASTEXITCODE -ne 0) { exit 1 }$\r$\n"
    FileWrite $1 "}$\r$\n"
    FileWrite $1 "exit 0$\r$\n"
    FileClose $1
    nsExec::ExecToStack `powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$2" "$INSTDIR" "$ROUTEX_SERVICE_WAS_RUNNING"`
    Pop $0
    Pop $1
    Delete "$2"
    ${If} $0 != 0
      MessageBox MB_ICONEXCLAMATION|MB_OK "新版 RouteX 已安装，但 RouteX 服务状态恢复失败。$\r$\n$\r$\n请打开 RouteX 后在“系统服务”中检查服务状态。"
    ${EndIf}
    Pop $2
    Pop $1
    Pop $0
  ${EndIf}
!macroend

!macro ROUTEX_CLOSE_RUNNING_PROCESSES
  Push $0
  Push $1
  Push $2
  DetailPrint "正在关闭已运行的 RouteX..."
  InitPluginsDir
  StrCpy $2 "$PLUGINSDIR\routex-close-processes.ps1"
  FileOpen $1 "$2" w
  FileWrite $1 "$$installDir = [System.IO.Path]::GetFullPath($$args[0])$\r$\n"
  FileWrite $1 "$$candidateDirs = @((Join-Path $$installDir 'core'))$\r$\n"
  FileWrite $1 "foreach ($$base in @($$env:APPDATA, $$env:LOCALAPPDATA)) {$\r$\n"
  FileWrite $1 "  if ([string]::IsNullOrWhiteSpace($$base)) { continue }$\r$\n"
  FileWrite $1 "  $$candidateDirs += (Join-Path $$base 'routex.app\core')$\r$\n"
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
    Push $1
    StrCpy $1 "$INSTDIR\${ROUTEX_MAIN_BINARY}.exe"
    CreateShortcut `${LINK_PATH}` "$1" "" "$1" 0
    !insertmacro ROUTEX_SET_LNK_APP_USER_MODEL_ID `${LINK_PATH}`
    Pop $1
  ${EndIf}
!macroend

!macro ROUTEX_SET_LNK_APP_USER_MODEL_ID LINK_PATH
  !insertmacro ComHlpr_CreateInProcInstance ${CLSID_ShellLink} ${IID_IShellLink} r0 ""
  ${If} $0 P<> 0
    ${IUnknown::QueryInterface} $0 '("${IID_IPersistFile}",.r1)'
    ${If} $1 P<> 0
      ${IPersistFile::Load} $1 '("${LINK_PATH}", ${STGM_READWRITE})'
      ${IUnknown::QueryInterface} $0 '("${IID_IPropertyStore}",.r2)'
      ${If} $2 P<> 0
        System::Call 'Oleaut32::SysAllocString(w "${ROUTEX_BUNDLE_ID}") i.r3'
        System::Call '*${SYSSTRUCT_PROPERTYKEY}(${PKEY_AppUserModel_ID})p.r4'
        System::Call '*${SYSSTRUCT_PROPVARIANT}(${VT_BSTR},,&i4 $3)p.r5'
        ${IPropertyStore::SetValue} $2 '($4,$5)'

        System::Call 'Oleaut32::SysFreeString($3)'
        System::Free $4
        System::Free $5
        ${IPropertyStore::Commit} $2 ""
        ${IUnknown::Release} $2 ""
        ${IPersistFile::Save} $1 '("${LINK_PATH}",1)'
      ${EndIf}
      ${IUnknown::Release} $1 ""
    ${EndIf}
    ${IUnknown::Release} $0 ""
  ${EndIf}
!macroend

Function .onGUIEnd
  ${If} ${FileExists} "$INSTDIR\${ROUTEX_MAIN_BINARY}.exe"
    !insertmacro ROUTEX_REFRESH_SHORTCUT_ICON "$DESKTOP\${ROUTEX_PRODUCT_NAME}.lnk"
    !insertmacro ROUTEX_REFRESH_SHORTCUT_ICON "$SMPROGRAMS\${ROUTEX_PRODUCT_NAME}.lnk"
  ${EndIf}
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
  !insertmacro ROUTEX_STOP_SERVICE_BEFORE_FILE_WRITE
  !insertmacro ROUTEX_CLOSE_RUNNING_PROCESSES
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro ROUTEX_REMOVE_SERVICE_BEFORE_FILE_WRITE
  !insertmacro ROUTEX_CLOSE_RUNNING_PROCESSES
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Tauri's finish-page shortcut checkbox calls CreateOrUpdateDesktopShortcut,
  ; but that function returns early in update mode. In GUI mode, keep the choice
  ; user-controlled and let a checked box actually create the shortcut.
  ${If} $PassiveMode <> 1
  ${AndIfNot} ${Silent}
    StrCpy $UpdateMode 0
  ${EndIf}
  !insertmacro ROUTEX_REFRESH_SHORTCUT_ICON "$DESKTOP\${ROUTEX_PRODUCT_NAME}.lnk"
  !if "${STARTMENUFOLDER}" != ""
    !insertmacro ROUTEX_REFRESH_SHORTCUT_ICON "$SMPROGRAMS\$AppStartMenuFolder\${ROUTEX_PRODUCT_NAME}.lnk"
  !else
    !insertmacro ROUTEX_REFRESH_SHORTCUT_ICON "$SMPROGRAMS\${ROUTEX_PRODUCT_NAME}.lnk"
  !endif
  !insertmacro ROUTEX_RESTORE_SERVICE_AFTER_FILE_WRITE
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
    SetShellVarContext current
    RmDir /r "$APPDATA\routex.app"
    RmDir /r "$LOCALAPPDATA\routex.app"
  ${EndIf}
!macroend
