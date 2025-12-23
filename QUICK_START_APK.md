# 🚀 Quick Start: Build APKs in 30 Minutes

This is the fastest way to get your APKs built and running.

---

## ⚡ Prerequisites (Install First)

1. **Node.js** - https://nodejs.org/ (Download LTS version)
2. **Android Studio** - https://developer.android.com/studio
3. **Java JDK 11+** - https://adoptium.net/

**Verify installations:**
```bash
node --version    # Should show v16+
npm --version     # Should show 8+
java -version     # Should show 11+
```

---

## 📱 Option 1: Automated Setup (Easiest)

### Customer App
```bash
# Run this script
setup-customer-app.bat
```

### Restaurant App
```bash
# Run this script
setup-restaurant-app.bat
```

That's it! Android Studio will open automatically.

---

## 📱 Option 2: Manual Setup (15 minutes each)

### Customer App

```bash
# 1. Navigate to client folder
cd client

# 2. Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# 3. Initialize
npx cap init "WaitNot Customer" "com.waitnot.customer" --web-dir=dist

# 4. Build
npm run build

# 5. Add Android
npx cap add android

# 6. Sync
npx cap sync

# 7. Open Android Studio
npx cap open android
```

### Restaurant App

```bash
# 1. Create new folder
cd ..
mkdir waitnot-restaurant-app
cd waitnot-restaurant-app

# 2. Copy client files
# Windows: xcopy /E /I ..\client\* .
# Mac/Linux: cp -r ../client/* .

# 3. Install dependencies
npm install

# 4. Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# 5. Initialize
npx cap init "WaitNot Restaurant" "com.waitnot.restaurant" --web-dir=dist

# 6. Build
npm run build

# 7. Add Android
npx cap add android

# 8. Sync
npx cap sync

# 9. Open Android Studio
npx cap open android
```

---

## 🏗️ In Android Studio

### First Time Setup (5 minutes)

1. **Wait for Gradle Sync** (2-3 minutes)
   - Bottom right: "Gradle sync in progress..."
   - Wait until it says "Gradle sync finished"

2. **Connect Device or Start Emulator**
   - Physical device: Connect via USB, enable USB debugging
   - Emulator: Tools → Device Manager → Create Device

3. **Run App** (Test)
   - Click green ▶️ play button
   - Select your device
   - App will install and launch

### Build APK (2 minutes)

1. **Build Menu** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for build to complete
3. Click "locate" in notification
4. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 📤 Share Your APK

### Method 1: Direct Install
```bash
# Connect Android device
adb install app-debug.apk
```

### Method 2: File Transfer
1. Copy APK to phone
2. Open file manager
3. Tap APK file
4. Allow "Install from unknown sources"
5. Install

### Method 3: Cloud Share
1. Upload to Google Drive/Dropbox
2. Share link
3. Download on phone
4. Install

---

## 🎯 What You Get

### Customer App (com.waitnot.customer)
- Browse restaurants
- Order food
- Scan QR codes
- Track orders

### Restaurant App (com.waitnot.restaurant)
- Manage orders
- Update menu
- Generate QR codes
- View analytics
- Manage tables

---

## ⚠️ Important Notes

### Before Building:

1. **Update API URL** in `src/config.js`:
```javascript
export const API_URL = 'https://your-production-api.com/api';
```

2. **Deploy Backend First**
   - Your server must be online
   - Use Heroku, Railway, or similar
   - Get production URL

3. **Test Locally First**
   - Run `npm run dev` in client
   - Ensure everything works
   - Then build APK

---

## 🐛 Common Issues & Fixes

### Issue: "Gradle sync failed"
```bash
cd android
./gradlew clean
cd ..
npx cap sync
```

### Issue: "SDK not found"
- Open Android Studio
- Tools → SDK Manager
- Install Android SDK Platform 33

### Issue: "White screen on app launch"
- Check API URL is correct
- Verify `dist` folder has files
- Run `npm run build` again

### Issue: "App crashes immediately"
- Check logcat in Android Studio
- View → Tool Windows → Logcat
- Look for error messages

---

## 📊 Build Time Breakdown

| Step | Time |
|------|------|
| Install software | 30-60 min (one-time) |
| Customer app setup | 10-15 min |
| Restaurant app setup | 10-15 min |
| Build APKs | 5 min |
| Test on device | 5 min |
| **Total** | **30-40 min** (after software installed) |

---

## ✅ Success Checklist

- [ ] Node.js installed
- [ ] Android Studio installed
- [ ] Java JDK installed
- [ ] Backend deployed online
- [ ] Customer app APK built
- [ ] Restaurant app APK built
- [ ] Both apps tested on device
- [ ] Both apps work online

---

## 🎉 Next Steps

1. **Test thoroughly** - Try all features
2. **Get feedback** - Share with friends
3. **Fix bugs** - Improve based on feedback
4. **Sign APKs** - For Play Store release
5. **Publish** - Submit to Google Play

---

## 📞 Need Help?

**Check these files:**
- `BUILD_APK_COMPLETE_GUIDE.md` - Detailed guide
- `REQUIREMENTS_CHECKLIST.md` - Full checklist
- `MOBILE_APP_GUIDE.md` - Alternative methods

**Online Resources:**
- Capacitor Docs: https://capacitorjs.com/docs
- Stack Overflow: Search "Capacitor Android"
- YouTube: "Capacitor Android tutorial"

---

## 💡 Pro Tips

1. **Use scripts** - Automated setup is faster
2. **Test early** - Build APK early to catch issues
3. **Keep it simple** - Start with debug APK first
4. **Save keystore** - You'll need it for updates
5. **Document changes** - Keep notes of what you modify

---

**You're ready! Let's build those APKs! 🚀📱**
