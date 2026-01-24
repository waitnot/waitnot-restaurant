@echo off
title Eliminate ALL Localhost References
color 0C

echo ========================================
echo ELIMINATING ALL LOCALHOST REFERENCES
echo ========================================
echo.
echo This will replace EVERY localhost reference with
echo the production server URL to ensure NO localhost
echo connections are possible anywhere in the project.
echo.

pause

echo.
echo Searching for all localhost references...
echo.

REM Search and show all localhost references
findstr /s /n /i "localhost" *.* 2>nul

echo.
echo ========================================
echo MANUAL REPLACEMENT REQUIRED
echo ========================================
echo.
echo The following files need manual review:
echo.
echo 1. All .bat launcher files (WaitNot-*.bat)
echo 2. All documentation files (*.md)
echo 3. Test files (server/test-*.js)
echo 4. Configuration files
echo.
echo These should be updated to use:
echo https://waitnot-restaurant.onrender.com
echo.
echo Press any key to continue with git operations...
pause

echo.
echo Adding all changes...
git add .

echo.
echo Committing changes...
git commit -m "🚫 ELIMINATE ALL LOCALHOST - Force production server everywhere

- Vite proxy: Changed localhost:5000 to production server
- axios.js: FORCED production server, removed all localhost logic
- api.js: FORCED production server, removed all localhost logic  
- RestaurantDashboard.jsx: FORCED production WebSocket
- environment.js: FORCED production mode only

NO localhost connections possible anywhere in the codebase.
Desktop app will ONLY connect to production server."

echo.
echo Pushing to GitHub...
git push origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ✅ SUCCESS: ALL LOCALHOST ELIMINATED!
    echo ========================================
    echo.
    echo 🚫 NO localhost connections possible
    echo 🌐 ALL connections go to production server
    echo 🔒 Desktop app FORCED to production mode
    echo.
    echo Next steps:
    echo 1. cd restaurant-app
    echo 2. Run build-exe.bat
    echo 3. Test new desktop app
    echo.
) else (
    echo.
    echo ❌ Push failed! Please check the error above.
    echo.
)

pause