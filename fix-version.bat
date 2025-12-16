@echo off
echo Fixing version and tag issues...
echo.

echo Step 1: Delete incorrect tag locally
git tag -d v1.0.1_ui

echo Step 2: Delete incorrect tag from remote
git push origin --delete v1.0.1_ui

echo Step 3: Commit updated package.json version
git add package.json
git commit -m "fix: update version to match correct tag format (1.0.1-ui)"

echo Step 4: Force push the correct tag to trigger rebuild
git push origin --delete v1.0.1-ui
git push origin v1.0.1-ui

echo.
echo Fix completed!
echo - Removed incorrect tag: v1.0.1_ui
echo - Updated package.json to: 1.0.1-ui  
echo - Re-pushed correct tag: v1.0.1-ui
echo - GitHub Actions should now build correctly
echo.
pause