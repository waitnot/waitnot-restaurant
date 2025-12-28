@echo off
echo ========================================
echo Pushing Interactive Buttons to GitHub
echo ========================================

echo.
echo Step 1: Checking Git status...
"C:\Program Files\Git\bin\git.exe" status

echo.
echo Step 2: Adding all changes...
"C:\Program Files\Git\bin\git.exe" add .

echo.
echo Step 3: Committing changes...
"C:\Program Files\Git\bin\git.exe" commit -m "feat: Add full interactivity to marketing website buttons - Implement smooth scrolling for 'Get Started Today' button to CTA section - Add WhatsApp integration for 'Start Free Trial' with pre-filled message to +91 6364039135 - Create professional demo scheduling modal with comprehensive form - Add demo video modal with fallback to live demo scheduling - Include form validation and professional UX design - Implement WhatsApp message templates for lead generation - Add responsive modal designs with proper close functionality - Create structured data collection for demo requests - Enable immediate customer contact through WhatsApp - Professional lead generation system with multiple engagement points"

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
    echo ✅ SUCCESS: Interactive buttons pushed to GitHub successfully!
    echo.
    echo 🚀 Next steps:
    echo    1. Go to Render dashboard
    echo    2. Your service will auto-deploy
    echo    3. Test 'Get Started Today' smooth scrolling
    echo    4. Test 'Start Free Trial' WhatsApp integration
    echo    5. Test 'Schedule Demo' modal and form submission
    echo    6. Test 'Watch Demo' modal functionality
    echo    7. Verify mobile responsiveness of all features
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