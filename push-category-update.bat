@echo off
echo ========================================
echo Pushing Category Input Field Update to GitHub
echo ========================================

echo.
echo Step 1: Checking Git status...
"C:\Program Files\Git\bin\git.exe" status

echo.
echo Step 2: Adding all changes...
"C:\Program Files\Git\bin\git.exe" add .

echo.
echo Step 3: Committing changes...
"C:\Program Files\Git\bin\git.exe" commit -m "feat: Replace category dropdown with input field in add menu page - Allow restaurants to enter custom categories instead of predefined options - Add placeholder text with examples for better UX - Make category field required for validation - Update form reset to use empty category default"

echo.
echo Step 4: Checking remote repository...
"C:\Program Files\Git\bin\git.exe" remote -v

echo.
echo Step 5: Attempting to push...
echo ⚠️  You will be prompted for GitHub credentials:
echo    Username: waitnot
echo    Password: [Use Personal Access Token from waitnot account]
echo.
echo 🔑 Make sure you have the Personal Access Token ready!
echo.
pause

"C:\Program Files\Git\bin\git.exe" push origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ SUCCESS: Code pushed to GitHub successfully!
    echo.
    echo 🚀 Next steps:
    echo    1. Go to Render dashboard
    echo    2. Your service will auto-deploy
    echo    3. Test the new category input field
    echo    4. Verify custom categories work properly
    echo.
) else (
    echo.
    echo ❌ PUSH FAILED
    echo.
    echo 🔧 Troubleshooting options:
    echo.
    echo Option 1: Use Personal Access Token
    echo    - Go to GitHub Settings ^> Developer settings ^> Personal access tokens
    echo    - Generate new token with repo permissions
    echo    - Use token as password when prompted
    echo.
    echo Option 2: Try different authentication
    echo    - Run: git config --global credential.helper store
    echo    - Then retry this script
    echo.
    echo Option 3: Manual push
    echo    - Open Git Bash
    echo    - Run: git push origin main
    echo    - Enter waitnot username and token
    echo.
)

echo.
echo ========================================
echo Push process completed!
echo ========================================
pause