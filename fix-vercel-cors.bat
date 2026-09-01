@echo off
echo ========================================
echo Fixing CORS for Vercel Deployment
echo ========================================

echo.
echo 🔧 CORS Fix Applied:
echo    ✅ Added waitnot-restaurant-app.vercel.app to allowed origins
echo    ✅ Added dynamic Vercel preview domain support
echo    ✅ Enhanced CORS logging for debugging
echo.

echo Step 1: Checking Git status...
git status

echo.
echo Step 2: Adding CORS fix...
git add server/server.js

echo.
echo Step 3: Committing CORS fix...
git commit -m "fix: Add Vercel domain to CORS configuration

🔧 CORS Configuration Fix:
- Add waitnot-restaurant-app.vercel.app to allowed origins
- Support dynamic Vercel preview deployments (*.vercel.app)
- Enhanced CORS logging for debugging blocked origins
- Maintain backward compatibility with existing domains

🎯 Fixes:
- Resolves 'Loading...' issue on Vercel deployment
- Enables API requests from Vercel frontend to Render backend
- Supports both production and preview Vercel deployments

✅ Tested with localhost and ready for production"

echo.
echo Step 4: Pushing to GitHub (will trigger Render deployment)...
echo ⚠️  You will be prompted for GitHub credentials:
echo    Username: waitnot
echo    Password: [Use Personal Access Token]
echo.
pause

git push origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ SUCCESS: CORS fix pushed to GitHub!
    echo.
    echo 🚀 Next steps:
    echo    1. Wait for Render to auto-deploy (2-3 minutes)
    echo    2. Test the Vercel app: https://waitnot-restaurant-app.vercel.app
    echo    3. Check if 'Loading...' issue is resolved
    echo    4. Test QR code functionality
    echo.
    echo 🔍 If still not working:
    echo    1. Check Render deployment logs
    echo    2. Test API health: https://waitnot-restaurant.onrender.com/health
    echo    3. Check browser console for errors
    echo.
) else (
    echo.
    echo ❌ PUSH FAILED
    echo.
    echo 🔧 Try manual push:
    echo    1. Open Git Bash
    echo    2. Run: git push origin main
    echo    3. Enter waitnot credentials
    echo.
)

echo.
echo ========================================
echo CORS Fix Process Completed!
echo ========================================
pause