; 自定义NSIS安装脚本 - 创建管理员权限快捷方式

!macro customInstall
  ; 复制批处理文件到临时目录
  File "/oname=$TEMP\create-admin-shortcut.bat" "${BUILD_RESOURCES_DIR}\create-admin-shortcut.bat"
  
  ; 创建管理员权限的桌面快捷方式
  ExecWait '"$TEMP\create-admin-shortcut.bat" "$INSTDIR\RouteX.exe" "$DESKTOP\RouteX (管理员).lnk"'
  
  ; 创建管理员权限的开始菜单快捷方式
  CreateDirectory "$SMPROGRAMS\RouteX"
  ExecWait '"$TEMP\create-admin-shortcut.bat" "$INSTDIR\RouteX.exe" "$SMPROGRAMS\RouteX\RouteX (管理员).lnk"'
  
  ; 清理临时文件
  Delete "$TEMP\create-admin-shortcut.bat"
!macroend

!macro customUnInstall
  ; 删除管理员权限的快捷方式
  Delete "$DESKTOP\RouteX (管理员).lnk"
  Delete "$SMPROGRAMS\RouteX\RouteX (管理员).lnk"
!macroend