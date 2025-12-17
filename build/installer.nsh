; 自定义NSIS安装脚本 - 设置默认管理员权限

!macro customInstall
  ; 复制批处理文件到临时目录
  File "/oname=$TEMP\create-admin-shortcut.bat" "${BUILD_RESOURCES_DIR}\create-admin-shortcut.bat"
  
  ; 设置默认快捷方式以管理员身份运行
  ExecWait '"$TEMP\create-admin-shortcut.bat" "$INSTDIR\RouteX.exe" "$DESKTOP\RouteX.lnk"'
  ExecWait '"$TEMP\create-admin-shortcut.bat" "$INSTDIR\RouteX.exe" "$SMPROGRAMS\RouteX\RouteX.lnk"'
  
  ; 清理临时文件
  Delete "$TEMP\create-admin-shortcut.bat"
!macroend

!macro customUnInstall
  ; 标准卸载，electron-builder会处理快捷方式删除
!macroend