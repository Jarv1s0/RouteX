@echo off
REM 创建管理员权限的快捷方式

set "target=%~1"
set "shortcut=%~2"

REM 使用PowerShell创建快捷方式并设置管理员权限
powershell -Command "& {$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%shortcut%'); $Shortcut.TargetPath = '%target%'; $Shortcut.Save()}"

REM 读取快捷方式文件并修改属性以要求管理员权限
powershell -Command "& {$bytes = [System.IO.File]::ReadAllBytes('%shortcut%'); $bytes[0x15] = $bytes[0x15] -bor 0x20; [System.IO.File]::WriteAllBytes('%shortcut%', $bytes)}"

echo 管理员权限快捷方式创建完成: %shortcut%