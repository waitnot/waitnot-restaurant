@echo off
title WaitNot - Create Desktop Shortcuts
color 0F
echo.
echo ========================================
echo    WaitNot Desktop Shortcuts Creator
echo ========================================
echo.
echo Creating desktop shortcuts for WaitNot...
echo.

REM Get current directory
set "CURRENT_DIR=%~dp0"

REM Create shortcuts on desktop
echo [1/5] Creating WaitNot Launcher shortcut...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\WaitNot Restaurant System.lnk'); $Shortcut.TargetPath = '%CURRENT_DIR%WaitNot-Launcher.bat'; $Shortcut.WorkingDirectory = '%CURRENT_DIR%'; $Shortcut.Description = 'Launch WaitNot Restaurant Management System'; $Shortcut.Save()"

echo [2/5] Creating Admin Panel shortcut...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\WaitNot Admin Panel.lnk'); $Shortcut.TargetPath = '%CURRENT_DIR%WaitNot-Admin.bat'; $Shortcut.WorkingDirectory = '%CURRENT_DIR%'; $Shortcut.Description = 'WaitNot Admin Panel - Manage Restaurants'; $Shortcut.Save()"

echo [3/5] Creating Restaurant Dashboard shortcut...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\WaitNot Restaurant.lnk'); $Shortcut.TargetPath = '%CURRENT_DIR%WaitNot-Restaurant.bat'; $Shortcut.WorkingDirectory = '%CURRENT_DIR%'; $Shortcut.Description = 'WaitNot Restaurant Dashboard'; $Shortcut.Save()"

echo [4/5] Creating QR Test shortcut...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\WaitNot QR Test.lnk'); $Shortcut.TargetPath = '%CURRENT_DIR%WaitNot-QR-Test.bat'; $Shortcut.WorkingDirectory = '%CURRENT_DIR%'; $Shortcut.Description = 'Test WaitNot QR Ordering System'; $Shortcut.Save()"

echo [5/5] Creating Stop Services shortcut...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\WaitNot Stop.lnk'); $Shortcut.TargetPath = '%CURRENT_DIR%WaitNot-Stop.bat'; $Shortcut.WorkingDirectory = '%CURRENT_DIR%'; $Shortcut.Description = 'Stop all WaitNot services'; $Shortcut.Save()"

echo.
echo ✅ Desktop shortcuts created successfully!
echo.
echo 🖥️ Created shortcuts:
echo    📱 WaitNot Restaurant System - Main launcher
echo    👨‍💼 WaitNot Admin Panel - Admin dashboard
echo    🏪 WaitNot Restaurant - Restaurant dashboard  
echo    📱 WaitNot QR Test - Test QR ordering
echo    🛑 WaitNot Stop - Stop all services
echo.
echo 💡 You can now access WaitNot directly from your desktop!
echo.
echo Press any key to close...
pause >nul