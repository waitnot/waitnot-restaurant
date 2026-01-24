@echo off
title WaitNot QR Ordering Test
color 0D
echo.
echo ========================================
echo      WaitNot QR Ordering Test
echo ========================================
echo.
echo Opening QR Ordering Test Page...
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

REM Open QR Order Test Page
start http://localhost:3000/qr-order/3a0d1b05-6ace-4a0c-8625-20e618740534/1

echo.
echo ✅ QR Ordering Test Page opened!
echo.
echo 📱 Testing QR Ordering for:
echo    Restaurant: Hotel King
echo    Table: 1
echo.
echo 🧪 Test Features:
echo    - Menu browsing and ordering
echo    - Add/remove items from cart
echo    - Payment methods (UPI/Cash)
echo    - Order placement
echo.
echo 💡 Admin Control Test:
echo    1. Use Admin Panel to disable QR ordering
echo    2. Refresh this page to see "Contact Admin" message
echo    3. Re-enable to restore normal functionality
echo.
echo Press any key to close...
pause >nul