@echo off
title WaitNot Admin Panel
color 0C
echo.
echo ========================================
echo      WaitNot Admin Panel Launcher
echo ========================================
echo.
echo Opening Admin Panel...
echo.

REM Check if servers are running, if not start them
tasklist /FI "WINDOWTITLE eq WaitNot Server*" 2>NUL | find /I /N "cmd.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo Starting backend server...
    start "WaitNot Server" cmd /k "cd /d server && npm start"
    timeout /t 5 /nobreak >nul
)

tasklist /FI "WINDOWTITLE eq WaitNot Client*" 2>NUL | find /I /N "cmd.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo Starting frontend client...
    start "WaitNot Client" cmd /k "cd /d client && npm run dev"
    timeout /t 8 /nobreak >nul
)

REM Open Admin Panel directly
start http://localhost:3000/admin-login

echo.
echo ✅ Admin Panel opened!
echo.
echo 🔐 Admin Credentials:
echo    Username: admin
echo    Password: admin123
echo.
echo Press any key to close...
pause >nul