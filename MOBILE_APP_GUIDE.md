# 📱 Convert WaitNot to Android APK

This guide will help you convert the WaitNot web app into an Android APK.

## Method 1: Using Capacitor (Recommended) ⚡

Capacitor allows you to wrap your React app as a native Android app.

### Prerequisites
- Node.js installed
- Android Studio installed
- Java JDK 11 or higher

### Step 1: Install Capacitor

```bash
cd client
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android
```

### Step 2: Initialize Capacitor

```bash
npx cap init
```

When prompted:
- App name: `WaitNot`
- App ID: `com.waitnot.app` (or your custom package name)
- Web directory: `dist`

### Step 3: Build the React App

```bash
npm run build
```

### Step 4: Add Android Platform

```bash
npx cap add android
```

### Step 5: Sync Web Assets

```bash
npx cap sync
```

### Step 6: Open in Android Studio

```bash
npx cap open android
```

This will open Android Studio. From there:
1. Wait for Gradle sync to complete
2. Connect your Android device or start an emulator
3. Click "Run" (green play button) to install on device
4. To generate APK: Build → Build Bundle(s) / APK(s) → Build APK(s)

The APK will be in: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## Method 2: Using Cordova 📦

### Step 1: Install Cordova

```bash
npm install -g cordova
```

### Step 2: Create Cordova Project

```bash
cd ..
cordova create waitnot-mobile com.waitnot.app WaitNot
cd waitnot-mobile
```

### Step 3: Add Android Platform

```bash
cordova platform add android
```

### Step 4: Copy Build Files

```bash
# Build your React app first
cd ../client
npm run build

# Copy to Cordova www folder
cp -r dist/* ../waitnot-mobile/www/
```

### Step 5: Build APK

```bash
cd ../waitnot-mobile
cordova build android
```

APK location: `platforms/android/app/build/outputs/apk/debug/app-debug.apk`

---

## Method 3: Progressive Web App (PWA) 📲

Convert to PWA and users can "Add to Home Screen" - works like a native app!

### Step 1: Install Vite PWA Plugin

```bash
cd client
npm install vite-plugin-pwa -D
```

### Step 2: Update vite.config.js

Add PWA plugin configuration (see PWA_CONFIG.md)

### Step 3: Build

```bash
npm run build
```

Users can now install the app from their browser!

---

## Method 4: Online APK Builders (Easiest) 🌐

No coding required! Upload your built app to these services:

### Option A: PWA Builder
1. Visit: https://www.pwabuilder.com/
2. Enter your website URL
3. Click "Build My PWA"
4. Download Android package
5. Sign and generate APK

### Option B: Capacitor Live
1. Visit: https://ionic.io/
2. Use Appflow to build APK from your repo

### Option C: Gonative.io
1. Visit: https://gonative.io/
2. Enter your website URL
3. Customize app settings
4. Download APK (paid service)

---

## 🎨 App Configuration

### App Icon
Create icons in these sizes:
- 512x512 (high-res)
- 192x192 (standard)
- 144x144, 96x96, 72x72, 48x48

Place in `public/icons/` folder

### Splash Screen
Create splash screen images:
- 2732x2732 (universal)
- Various sizes for different devices

### App Permissions (AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

---

## 📝 Important Notes

### 1. API URLs
Update API URLs to use your production server:
```javascript
// In axios config
const API_URL = 'https://your-server.com/api';
```

### 2. Build for Production
```bash
npm run build
```

### 3. Test on Real Device
Always test on actual Android devices before release

### 4. Sign APK for Release
For Google Play Store, you need a signed APK:
```bash
# Generate keystore
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000

# Sign APK
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore my-release-key.keystore app-release-unsigned.apk my-key-alias
```

---

## 🚀 Quick Start (Recommended Path)

**For fastest results, use Method 1 (Capacitor):**

```bash
# 1. Install dependencies
cd client
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Initialize
npx cap init

# 3. Build web app
npm run build

# 4. Add Android
npx cap add android

# 5. Sync
npx cap sync

# 6. Open in Android Studio
npx cap open android

# 7. Build APK in Android Studio
# Build → Build Bundle(s) / APK(s) → Build APK(s)
```

---

## 📱 Features in Mobile App

✅ Offline support (with PWA)
✅ Push notifications (with Capacitor plugins)
✅ Camera access for QR scanning
✅ Native navigation
✅ App icon and splash screen
✅ Works like native app
✅ Can be published to Google Play Store

---

## 🔧 Troubleshooting

### Issue: Build fails
- Ensure Android SDK is installed
- Check Java version: `java -version`
- Update Gradle in Android Studio

### Issue: White screen on app launch
- Check API URLs are correct
- Verify build output in `dist` folder
- Check browser console in Android Studio

### Issue: App crashes
- Check AndroidManifest.xml permissions
- Review logcat in Android Studio
- Ensure all dependencies are installed

---

## 📚 Additional Resources

- Capacitor Docs: https://capacitorjs.com/docs
- Cordova Docs: https://cordova.apache.org/docs/en/latest/
- PWA Guide: https://web.dev/progressive-web-apps/
- Android Studio: https://developer.android.com/studio

---

## 💡 Pro Tips

1. **Use Capacitor** - It's modern, well-maintained, and easy
2. **Test thoroughly** - Mobile has different behaviors than web
3. **Optimize images** - Mobile data is expensive
4. **Add offline mode** - Users expect apps to work offline
5. **Use native plugins** - Camera, GPS, notifications, etc.

---

Need help? Check the official documentation or reach out to the community!
