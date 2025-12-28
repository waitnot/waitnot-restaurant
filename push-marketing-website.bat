@echo off
echo ========================================
echo Pushing Marketing Website to GitHub
echo ========================================

echo.
echo Step 1: Checking Git status...
"C:\Program Files\Git\bin\git.exe" status

echo.
echo Step 2: Adding all changes...
"C:\Program Files\Git\bin\git.exe" add .

echo.
echo Step 3: Committing changes...
"C:\Program Files\Git\bin\git.exe" commit -m "feat: Transform home page into professional marketing website - Remove search functionality and login links for pure marketing focus - Implement clean black, red, and white color scheme matching WaitNot branding - Add prominent WaitNot logo with stylized Wait/Not text design - Create comprehensive restaurant benefits section with 6 key advantages - Add customer benefits section with visual QR code demonstration - Include 3-step how-it-works process explanation - Add statistics section with social proof (500+ restaurants, 50K+ orders) - Implement professional call-to-action section with free trial offer - Design marketing-focused footer with feature highlights and trust badges - Remove all yellow colors and maintain consistent brand colors - Focus on showcasing platform benefits for both restaurants and customers - Professional marketing website ready for lead generation and conversions"

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
    echo ✅ SUCCESS: Marketing website pushed to GitHub successfully!
    echo.
    echo 🚀 Next steps:
    echo    1. Go to Render dashboard
    echo    2. Your service will auto-deploy
    echo    3. Test the new marketing website
    echo    4. Verify WaitNot branding and color scheme
    echo    5. Check responsive design on mobile and desktop
    echo    6. Confirm all marketing content displays properly
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