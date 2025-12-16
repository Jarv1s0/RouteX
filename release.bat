@echo off
echo RouteX UI Redesign Auto Release Script
echo.

REM Check parameters
if "%1"=="" (
    set VERSION_TYPE=patch
) else (
    set VERSION_TYPE=%1
)

echo Preparing to release %VERSION_TYPE% version...
echo.

REM Check git status
git status --porcelain > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: Git repository status abnormal
    pause
    exit /b 1
)

REM Get current version
for /f "tokens=2 delims=:" %%i in ('findstr "version" package.json') do (
    set CURRENT_VERSION=%%i
)
set CURRENT_VERSION=%CURRENT_VERSION: =%
set CURRENT_VERSION=%CURRENT_VERSION:"=%
set CURRENT_VERSION=%CURRENT_VERSION:,=%

echo Current version: %CURRENT_VERSION%

REM Prompt user for new version
set /p NEW_VERSION="Enter new version (e.g., 1.0.0-ui): "

if "%NEW_VERSION%"=="" (
    echo Error: Version cannot be empty
    pause
    exit /b 1
)

echo.
echo Update version to: %NEW_VERSION%
echo Will create tag: v%NEW_VERSION%
echo.
set /p CONFIRM="Confirm release? (y/N): "

if /i not "%CONFIRM%"=="y" (
    echo Release cancelled
    pause
    exit /b 0
)

echo.
echo Starting release process...

REM Update package.json version
powershell -Command "(Get-Content package.json) -replace '\"version\": \".*\"', '\"version\": \"%NEW_VERSION%\"' | Set-Content package.json"

REM Commit changes
git add package.json
git commit -m "chore: bump version to %NEW_VERSION%"

REM Create tag
git tag -a v%NEW_VERSION% -m "Release v%NEW_VERSION%"

REM Push
git push
git push origin v%NEW_VERSION%

echo.
echo Release completed!
echo Version: %NEW_VERSION%
echo Tag: v%NEW_VERSION%
echo GitHub Actions is building, check: https://github.com/Jarv1s0/RouteX/actions
echo.
pause