!macro NSIS_HOOK_PREINSTALL
  Push $0
  Push $1
  DetailPrint "正在关闭已运行的 RouteX..."
  nsExec::ExecToStack 'powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-Process -Name routex -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction Stop; Wait-Process -Name routex -Timeout 15 -ErrorAction SilentlyContinue; if (Get-Process -Name routex -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_ICONSTOP|MB_OK "无法关闭正在运行的 RouteX。$\r$\n$\r$\n请先完全退出 RouteX（包括托盘后台）后重试。$\r$\n如果 RouteX 是以管理员身份运行，请右键安装包选择“以管理员身份运行”后重试。"
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
