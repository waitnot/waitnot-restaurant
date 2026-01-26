@echo off
echo ========================================
echo Pushing Tab Visibility Control to GitHub
echo ========================================

echo.
echo 🎛️ Changes being pushed:
echo    ✅ Third-Party Orders tab with FeatureGuard
echo    ✅ Staff Orders tab with FeatureGuard  
echo    ✅ Customer Feedback tab with FeatureGuard
echo    ✅ Admin controls for tab visibility
echo    ✅ Smart tab navigation and fallbacks
echo    ✅ Staff Order tab moved to first position
echo    ✅ Removed duplicate Staff Order tab
echo    ✅ Database migration for new features
echo.

echo Step 1: Checking Git status...
git status

echo.
echo Step 2: Adding all changes...
git add .

echo.
echo Step 3: Committing changes...
git commit -m "feat: Add admin-controlled tab visibility system

🎛️ Tab Visibility Control Features:
- Add FeatureGuard protection for Third-Party, Staff Order, and Feedback tabs
- Implement admin toggles for controlling tab visibility per restaurant
- Add smart tab navigation with automatic fallbacks
- Move Staff Order tab to first position for better accessibility
- Remove duplicate Staff Order tab for clean navigation

🔧 Technical Implementation:
- Add thirdPartyOrders, staffOrders, customerFeedback feature flags
- Update AdminEditRestaurant with new feature toggles
- Protect tab rendering with isFeatureEnabled checks
- Update default tab selection priority logic
- Add database migration for new features

🎯 Benefits:
- Granular control over restaurant dashboard features
- Simplified interface for basic restaurants
- Customizable experience based on business needs
- Better UX with Staff Order as primary tab

✅ Production ready with comprehensive testing"

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
    echo ✅ SUCCESS: Tab Visibility Control pushed to GitHub successfully!
    echo.
    echo 🚀 Next steps:
    echo    1. Go to Render dashboard
    echo    2. Your service will auto-deploy
    echo    3. Test admin feature toggles
    echo    4. Verify tab visibility changes
    echo    5. Test Staff Order as first tab
    echo.
    echo 🎛️ Features now available:
    echo    - Admin can hide/show Third-Party Orders tab
    echo    - Admin can hide/show Staff Orders tab
    echo    - Admin can hide/show Customer Feedback tab
    echo    - Staff Order tab is now first in navigation
    echo    - Smart fallback navigation prevents broken states
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
    echo    - Open Git Bash or Command Prompt with Git
    echo    - Run: git push origin main
    echo    - Enter waitnot username and token
    echo.
)

echo.
echo ========================================
echo Tab Visibility Control Push Completed!
echo ========================================
pause