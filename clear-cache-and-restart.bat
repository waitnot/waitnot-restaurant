@echo off
echo ========================================
echo  WaitNot - Clear Cache and Restart
echo ========================================
echo.

echo 1. Stopping any running servers...
taskkill /f /im node.exe 2>nul
timeout /t 2 >nul

echo 2. Clearing npm cache...
cd client
call npm cache clean --force
cd ..

echo 3. Clearing node_modules cache...
cd client
if exist node_modules\\.cache rmdir /s /q node_modules\\.cache
cd ..

echo 4. Starting client development server...
cd client
start "WaitNot Client" cmd /k "npm run dev"
cd ..

echo 5. Starting server...
cd server
start "WaitNot Server" cmd /k "npm start"
cd ..

echo.
echo ========================================
echo  Servers Started Successfully!
echo ========================================
echo.
echo Client: http://localhost:3001
echo Server: http://localhost:5000
echo.
echo Please clear your browser cache:
echo - Chrome: Ctrl+Shift+R or F12 ^> Application ^> Storage ^> Clear site data
echo - Firefox: Ctrl+Shift+R or F12 ^> Storage ^> Clear All
echo.
echo If you still see the setLastOrderId error:
echo 1. Close all browser tabs
echo 2. Clear browser cache completely
echo 3. Restart browser
echo 4. Open http://localhost:3001
echo.
pause