@echo off
title WaitNot Restaurant Dashboard
color 0B
echo.
echo ========================================
echo    WaitNot Restaurant Dashboard
echo ========================================
echo.
echo Opening Restaurant Dashboard...
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

REM Open Restaurant Dashboard directly
start http://localhost:3000/restaurant-login

echo.
echo ✅ Restaurant Dashboard opened!
echo.
echo 🔐 Restaurant Credentials:
echo    Email: king@gmail.com
echo    Password: password123
echo.
echo Press any key to close...
pause >nul