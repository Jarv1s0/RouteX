!macro NSIS_HOOK_PREINSTALL
  Push $0
  Push $1
  DetailPrint "正在关闭已运行的 RouteX..."
  nsExec::ExecToStack 'taskkill /IM routex.exe /T /F'
  Pop $0
  Pop $1
  Sleep 1000
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
