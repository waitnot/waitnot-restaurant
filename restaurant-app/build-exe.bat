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

echo Step 2: Building React client for production...
cd ..\client
echo Building React app with production API configuration...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to build React client!
    pause
    exit /b 1
)
echo ✅ React client built successfully
cd ..\restaurant-app
echo.

echo Step 3: Copying built React files to desktop app...
if exist "renderer" rmdir /s /q "renderer"
mkdir "renderer"
xcopy "..\client\dist\*" "renderer\" /E /I /Y
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to copy React build files!
    pause
    exit /b 1
)
echo ✅ React files copied to renderer directory
echo.

echo Step 4: Checking logo file...
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

echo Step 5: Copying notification sound...
if not exist "sounds" mkdir "sounds"
if exist "..\client\public\sounds\new-order.wav" (
    copy "..\client\public\sounds\new-order.wav" "sounds\new-order.wav" >nul 2>&1
    echo ✅ Notification sound copied
) else (
    echo ⚠️ Notification sound not found, skipping...
)
echo.

echo Step 6: Installing desktop app dependencies...
npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install dependencies!
    pause
    exit /b 1
)
echo ✅ Dependencies installed
echo.

echo Step 7: Building Windows executable...
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
echo 🚀 Installer: dist/WaitNot Restaurant Setup 1.0.0.exe
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
echo   • App loads: Built React files (local)
echo   • API calls: https://waitnot-restaurant.onrender.com (production)
echo   • WebSocket: wss://waitnot-restaurant.onrender.com (production)
echo   • Requires internet connection for data
echo.
echo ✅ Desktop app ready for distribution!
echo.
echo 🧪 Testing:
echo   1. Run the installer or portable version
echo   2. App will open with local React files
echo   3. Login with restaurant credentials
echo   4. All API calls go to production server
echo   5. Test all features work correctly
echo.
pause