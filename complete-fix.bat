@echo off
echo Completing the version fix...
echo.

echo Current status:
echo - package.json version: 1.0.1-ui
echo - Local tag: v1.0.1-ui (correct format)
echo - Removed incorrect tags: v1.0.1_ui, vui-1.0.0
echo.

echo Step 1: Commit the package.json version update
git add package.json
git commit -m "fix: update package.json version to match correct tag (1.0.1-ui)"

echo Step 2: Delete incorrect tags from remote (if they exist)
git push origin --delete v1.0.1_ui 2>nul
git push origin --delete vui-1.0.0 2>nul

echo Step 3: Push the correct tag to trigger rebuild
git push origin v1.0.1-ui --force

echo.
echo Fix completed successfully!
echo - Package version: 1.0.1-ui
echo - Active tag: v1.0.1-ui
echo - GitHub Actions should now build correctly with proper semver format
echo.
echo Check build status at: https://github.com/Jarv1s0/RouteX/actions
echo.
pause