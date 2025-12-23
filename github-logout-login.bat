@echo off
echo ========================================
echo GitHub Complete Logout and Fresh Login
echo ========================================
echo.

echo Step 1: Logging out from GitHub CLI...
gh auth logout 2>nul
if %errorlevel% equ 0 (
    echo ✅ GitHub CLI logout successful
) else (
    echo ⚠️  GitHub CLI not found or already logged out
)
echo.

echo Step 2: Clearing Git credentials...
git config --global --unset-all credential.helper 2>nul
git config --global --unset user.name 2>nul
git config --global --unset user.email 2>nul
echo ✅ Git credentials cleared
echo.

echo Step 3: Removing credential files...
if exist "%USERPROFILE%\.git-credentials" (
    del "%USERPROFILE%\.git-credentials" 2>nul
    echo ✅ Credential file removed
) else (
    echo ℹ️  No credential file found
)
echo.

echo Step 4: Setting up fresh Git configuration...
git config --global user.name "waitnot"
git config --global user.email "waitnot.menu.storage@gmail.com"
git config --global credential.helper store
echo ✅ Fresh Git configuration set
echo.

echo Step 5: Checking current Git configuration...
echo === Current Git Config ===
git config --global --list | findstr user
echo.

echo Step 6: Attempting to push to GitHub...
echo ⚠️  You will be prompted for GitHub credentials:
echo    Username: waitnot
echo    Password: [Use Personal Access Token from waitnot account]
echo.
pause
git push -u origin main

echo.
echo ========================================
echo Process completed!
echo ========================================
pause