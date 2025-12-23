@echo off
REM WaitNot Customer App Setup Script
echo ========================================
echo    WaitNot Customer App Setup
echo ========================================
echo.

cd client

echo [1/6] Installing Capacitor...
call npm install @capacitor/core @capacitor/cli @capacitor/android

echo.
echo [2/6] Initializing Capacitor...
call npx cap init "WaitNot Customer" "com.waitnot.customer" --web-dir=dist

echo.
echo [3/6] Building React app...
call npm run build

echo.
echo [4/6] Adding Android platform...
call npx cap add android

echo.
echo [5/6] Syncing assets...
call npx cap sync

echo.
echo [6/6] Opening Android Studio...
call npx cap open android

echo.
echo ========================================
echo    Setup Complete!
echo ========================================
echo.
echo Next steps in Android Studio:
echo 1. Wait for Gradle sync to finish
echo 2. Connect Android device or start emulator
echo 3. Click Run (green play button)
echo 4. To build APK: Build -^> Build APK(s)
echo.
echo APK location: android\app\build\outputs\apk\debug\
echo.
pause
