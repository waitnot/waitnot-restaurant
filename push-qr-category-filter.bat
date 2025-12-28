@echo off
echo ========================================
echo Pushing QR Order Category Filter to GitHub
echo ========================================

echo.
echo Step 1: Checking Git status...
"C:\Program Files\Git\bin\git.exe" status

echo.
echo Step 2: Adding all changes...
"C:\Program Files\Git\bin\git.exe" add .

echo.
echo Step 3: Committing changes...
"C:\Program Files\Git\bin\git.exe" commit -m "feat: Add category filtering to QR ordering page with improved UI - Implement category filter buttons matching non-QR ordering page style - Change layout from grid cards to horizontal cards with smaller images - Add vegetarian indicator with Leaf icon for better UX - Improve mobile responsiveness with proper spacing and touch targets - Add CSS utilities for scrollbar hiding and text truncation - Maintain cart functionality during category filtering - Users can now filter menu items by category in QR ordering - UI now consistent between QR and non-QR ordering pages"

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
    echo ✅ SUCCESS: QR category filter feature pushed to GitHub successfully!
    echo.
    echo 🚀 Next steps:
    echo    1. Go to Render dashboard
    echo    2. Your service will auto-deploy
    echo    3. Test QR ordering page category filtering
    echo    4. Verify horizontal card layout works properly
    echo    5. Check mobile responsiveness
    echo    6. Confirm UI consistency with non-QR page
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