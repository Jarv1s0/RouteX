; 自定义NSIS安装脚本

!macro customInstall
  ; 暂时移除复杂的管理员权限设置，避免构建失败
  ; 用户可以手动右键快捷方式选择"以管理员身份运行"
!macroend

!macro customUnInstall
  ; 标准卸载
!macroend