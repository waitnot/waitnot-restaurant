@echo off
REM WaitNot Mobile App Setup Script for Windows
REM This script sets up Capacitor for Android APK generation

echo 🚀 Setting up WaitNot Mobile App...
echo.

REM Navigate to client directory
cd client

REM Install Capacitor
echo 📦 Installing Capacitor...
call npm install @capacitor/core @capacitor/cli @capacitor/android

REM Initialize Capacitor
echo ⚙️ Initializing Capacitor...
call npx cap init "WaitNot" "com.waitnot.app" --web-dir=dist

REM Build the React app
echo 🔨 Building React app...
call npm run build

REM Add Android platform
echo 📱 Adding Android platform...
call npx cap add android

REM Sync web assets
echo 🔄 Syncing assets...
call npx cap sync

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Open Android Studio: npx cap open android
echo 2. Wait for Gradle sync
echo 3. Click Run to test on device/emulator
echo 4. Build APK: Build -^> Build Bundle(s) / APK(s) -^> Build APK(s)
echo.
echo APK will be in: android\app\build\outputs\apk\debug\
echo.
pause
