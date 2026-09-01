# Build WaitNot Captain APK

## Requirements
- Node.js 18+
- Android Studio installed
- Java JDK 17+
- Android SDK

## Steps

### 1. Install Capacitor (first time only)
```
cd waitnot-restaurant/client
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### 2. Build the Captain web app
```
cd waitnot-restaurant/client
npm run build:captain
```

### 3. Add Android platform (first time only)
```
npx cap add android --capacitorconfig capacitor.captain.json
```

### 4. Sync web build to Android
```
npx cap sync android --capacitorconfig capacitor.captain.json
```

### 5. Open in Android Studio
```
npx cap open android
```

### 6. Build APK in Android Studio
- Go to Build > Build Bundle(s)/APK(s) > Build APK(s)
- APK will be at: android/app/build/outputs/apk/debug/app-debug.apk

## App Details
- App ID: com.waitnot.captain
- App Name: WaitNot Captain
- Opens directly to Staff Login
- Production server: https://waitnot-restaurant.onrender.com
