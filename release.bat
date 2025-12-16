@echo off
echo 🚀 Sparkle UI重设计版自动发布脚本
echo.

REM 检查参数
if "%1"=="" (
    set VERSION_TYPE=patch
) else (
    set VERSION_TYPE=%1
)

echo 📦 准备发布 %VERSION_TYPE% 版本...
echo.

REM 检查git状态
git status --porcelain > nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Git仓库状态异常
    pause
    exit /b 1
)

REM 获取当前版本
for /f "tokens=2 delims=:" %%i in ('findstr "version" package.json') do (
    set CURRENT_VERSION=%%i
)
set CURRENT_VERSION=%CURRENT_VERSION: =%
set CURRENT_VERSION=%CURRENT_VERSION:"=%
set CURRENT_VERSION=%CURRENT_VERSION:,=%

echo 📋 当前版本: %CURRENT_VERSION%

REM 提示用户输入新版本
set /p NEW_VERSION="🎯 请输入新版本号 (例如: 1.0.0-ui): "

if "%NEW_VERSION%"=="" (
    echo ❌ 版本号不能为空
    pause
    exit /b 1
)

echo.
echo 📝 更新版本到: %NEW_VERSION%
echo 🏷️  将创建标签: v%NEW_VERSION%
echo.
set /p CONFIRM="确认发布? (y/N): "

if /i not "%CONFIRM%"=="y" (
    echo ❌ 发布已取消
    pause
    exit /b 0
)

echo.
echo 🔄 开始发布流程...

REM 更新package.json版本
powershell -Command "(Get-Content package.json) -replace '\"version\": \".*\"', '\"version\": \"%NEW_VERSION%\"' | Set-Content package.json"

REM 提交更改
git add package.json
git commit -m "chore: bump version to %NEW_VERSION%"

REM 创建标签
git tag -a v%NEW_VERSION% -m "Release v%NEW_VERSION%"

REM 推送
git push
git push origin v%NEW_VERSION%

echo.
echo ✅ 发布完成！
echo 📋 版本: %NEW_VERSION%
echo 🏷️  标签: v%NEW_VERSION%
echo 🔗 GitHub Actions 正在构建，请查看: https://github.com/Jarv1s0/sparkle/actions
echo.
pause