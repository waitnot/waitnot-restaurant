@echo off
echo ========================================
echo Pushing Pricing Plans Feature to GitHub
echo ========================================

echo.
echo Step 1: Checking Git status...
git status

echo.
echo Step 2: Adding all changes...
git add .

echo.
echo Step 3: Committing changes...
git commit -m "feat: Add comprehensive pricing plans section to marketing website

- Add three pricing tiers: Starter (₹99/month), Pro (₹2,999/month), Premium POS (₹6,999/month)
- Mark Pro Plan as 'Most Popular' with enhanced styling and scaling
- Include detailed feature lists with check/minus icons for each plan
- Add WhatsApp integration for all pricing plan CTAs
- Implement responsive design for pricing cards
- Add pricing footer with guarantees and benefits
- Clean up unused imports (Bell, ArrowRight, MapPin)
- Maintain black, red, and white color scheme throughout
- All pricing buttons integrate with WhatsApp (+91 6364039135)
- Complete marketing website transformation with pricing section"

echo.
echo Step 4: Checking remote repository...
git remote -v

echo.
echo Step 5: Attempting to push...
echo ⚠️  You will be prompted for GitHub credentials:
echo    Username: waitnot
echo    Password: [Use Personal Access Token from waitnot account]
echo.
echo 🔑 Make sure you have the Personal Access Token ready!
echo.
pause

git push origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ SUCCESS: Pricing Plans feature pushed to GitHub successfully!
    echo.
    echo 🚀 Next steps:
    echo    1. Go to Render dashboard
    echo    2. Your service will auto-deploy
    echo    3. Test the pricing section functionality
    echo    4. Verify WhatsApp integration works for all plans
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
echo Pricing Plans Push Completed!
echo ========================================
pause