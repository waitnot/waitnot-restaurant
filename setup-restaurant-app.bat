@echo off
REM WaitNot Restaurant App Setup Script
echo ========================================
echo   WaitNot Restaurant App Setup
echo ========================================
echo.

echo [1/7] Creating restaurant app directory...
cd ..
if not exist waitnot-restaurant-app mkdir waitnot-restaurant-app
cd waitnot-restaurant-app

echo.
echo [2/7] Copying client files...
xcopy /E /I /Y ..\client\* .

echo.
echo [3/7] Installing dependencies...
call npm install

echo.
echo [4/7] Installing Capacitor...
call npm install @capacitor/core @capacitor/cli @capacitor/android

echo.
echo [5/7] Initializing Capacitor...
call npx cap init "WaitNot Restaurant" "com.waitnot.restaurant" --web-dir=dist

echo.
echo [6/7] Building React app...
call npm run build

echo.
echo [7/7] Adding Android platform...
call npx cap add android

echo.
echo Syncing assets...
call npx cap sync

echo.
echo Opening Android Studio...
call npx cap open android

echo.
echo ========================================
echo    Setup Complete!
echo ========================================
echo.
echo IMPORTANT: Modify src/App.jsx to show only restaurant routes!
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
