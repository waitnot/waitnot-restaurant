@echo off
title Building WaitNot Restaurant Desktop App
color 0B

echo ========================================
echo Building WaitNot Restaurant Desktop App
echo ========================================
echo.

echo Step 1: Checking Node.js installation...
node --version
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js is installed
echo.

echo Step 2: Checking logo file...
if not exist "logo.png" (
    echo ⚠️ Logo not found, copying from client directory...
    copy "..\client\public\logo.png" "logo.png" >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Failed to copy logo.png!
        echo Please ensure logo.png exists in client\public\ directory
        pause
        exit /b 1
    )
    echo ✅ Logo copied successfully
) else (
    echo ✅ Logo file found
)
echo.

echo Step 3: Installing dependencies...
npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install dependencies!
    pause
    exit /b 1
)
echo ✅ Dependencies installed
echo.

echo Step 4: Building Windows executable...
echo This may take a few minutes to download Electron binaries...
npm run build-win
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build failed!
    echo.
    echo 🔧 Common solutions:
    echo   1. Make sure you have internet connection
    echo   2. Try running as Administrator
    echo   3. Check if antivirus is blocking
    echo   4. Delete node_modules and try again
    pause
    exit /b 1
)
echo ✅ Build completed successfully!
echo.

echo ========================================
echo Build Results
echo ========================================
echo.
echo 📁 Output directory: dist/
echo � Instalbler: dist/WaitNot Restaurant Setup 1.0.0.exe
echo 📱 Portable (64-bit): dist/win-unpacked/WaitNot Restaurant.exe
echo 📱 Portable (32-bit): dist/win-ia32-unpacked/WaitNot Restaurant.exe
echo.
echo 🚀 Installation Options:
echo   1. Run the installer (recommended for end users)
echo   2. Use portable version (no installation required)
echo.
echo 📋 Distribution:
echo   • Share the installer with restaurants
echo   • They can install and run from desktop
echo   • Auto-updates will work with installer version
echo.
echo 🌐 Network Connection:
echo   • App connects to: https://waitnot-restaurant.onrender.com
echo   • Requires internet connection to function
echo   • All data is stored on your server (secure)
echo.
echo ✅ Desktop app ready for distribution!
echo.
echo 🧪 Testing:
echo   1. Run the installer or portable version
echo   2. App will open and connect to WaitNot server
echo   3. Login with restaurant credentials
echo   4. Test all features work correctly
echo.
pause