@echo off
title WaitNot - Stop All Services
color 0E
echo.
echo ========================================
echo      WaitNot - Stop All Services
echo ========================================
echo.
echo Stopping WaitNot services...
echo.

REM Kill Node.js processes (server and client)
echo [1/3] Stopping Node.js processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo ✅ Node.js processes stopped
) else (
    echo ℹ️  No Node.js processes were running
)

REM Kill npm processes
echo [2/3] Stopping npm processes...
taskkill /F /IM npm.cmd 2>nul
if %errorlevel% equ 0 (
    echo ✅ npm processes stopped
) else (
    echo ℹ️  No npm processes were running
)

REM Close WaitNot command windows
echo [3/3] Closing WaitNot windows...
taskkill /FI "WINDOWTITLE eq WaitNot Server*" /F 2>nul
taskkill /FI "WINDOWTITLE eq WaitNot Client*" /F 2>nul

echo.
echo ✅ All WaitNot services stopped!
echo.
echo Press any key to close...
pause >nul