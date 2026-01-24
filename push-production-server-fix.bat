@echo off
title Pushing Production Server Fix for Desktop App
color 0A

echo ========================================
echo Pushing Production Server Fix
echo ========================================
echo.
echo This will fix the desktop app to connect to production server
echo instead of localhost by updating:
echo.
echo ✅ Vite proxy configuration (development only)
echo ✅ Axios configuration (force production for desktop)
echo ✅ API configuration (enhanced logging)
echo ✅ Desktop app main.js (remove dev tools)
echo ✅ Build script improvements
echo.

pause

echo.
echo Step 1: Adding all changes...
git add .

echo.
echo Step 2: Committing changes...
git commit -m "🔧 Fix desktop app production server connection

- Fix Vite proxy to only work in development mode
- Force production server URL for desktop app in axios config
- Add enhanced logging for API requests/responses
- Remove dev tools from production desktop app
- Update build script with notification sound support
- Ensure all API calls go to https://waitnot-restaurant.onrender.com

This fixes the issue where desktop app was connecting to localhost
instead of the production server."

echo.
echo Step 3: Pushing to GitHub...
git push origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ✅ SUCCESS: Production Server Fix Pushed!
    echo ========================================
    echo.
    echo 🔧 Changes deployed:
    echo   • Vite proxy only active in development
    echo   • Desktop app forced to use production server
    echo   • Enhanced API logging for debugging
    echo   • Clean production build configuration
    echo.
    echo 📱 Next steps:
    echo   1. Go to restaurant-app directory
    echo   2. Run build-exe.bat to create new installer
    echo   3. Test the new desktop app
    echo   4. Verify it connects to production server
    echo.
    echo 🌐 Expected behavior:
    echo   • Desktop app loads: https://waitnot-restaurant.onrender.com
    echo   • All API calls go to production server
    echo   • No more localhost connections
    echo   • Real-time orders work properly
    echo.
) else (
    echo.
    echo ❌ Push failed! Please check the error above.
    echo.
)

pause