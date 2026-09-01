@echo off
title WaitNot Restaurant Management System
color 0A
echo.
echo ========================================
echo    WaitNot Restaurant Management System
echo ========================================
echo.
echo Starting WaitNot application...
echo.

REM Start the server in a new window
echo [1/3] Starting Backend Server...
start "WaitNot Server" cmd /k "cd /d server && npm start"

REM Wait a moment for server to start
timeout /t 5 /nobreak >nul

REM Start the client in a new window
echo [2/3] Starting Frontend Client...
start "WaitNot Client" cmd /k "cd /d client && npm run dev"

REM Wait for client to start
timeout /t 8 /nobreak >nul

REM Open the application in default browser
echo [3/3] Opening WaitNot in browser...
start http://localhost:3000

echo.
echo ✅ WaitNot is now running!
echo.
echo 🌐 Application URLs:
echo    Main Website: http://localhost:3000
echo    Admin Panel:  http://localhost:3000/admin-login
echo    Restaurant:   http://localhost:3000/restaurant-login
echo.
echo 🔐 Login Credentials:
echo    Admin: admin / admin123
echo    Restaurant: king@gmail.com / password123
echo.
echo Press any key to close this launcher...
pause >nul