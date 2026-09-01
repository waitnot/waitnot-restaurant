# 📱 Complete Guide: Build WaitNot Android APKs

This guide will help you build **TWO separate Android APKs**:
1. **Customer App** - For ordering food
2. **Restaurant App** - For managing orders and menu

---

## 📋 Prerequisites & Requirements

### 1. Software Requirements

#### Essential (Must Have):
- ✅ **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- ✅ **Android Studio** - [Download](https://developer.android.com/studio)
- ✅ **Java JDK 11 or higher** - [Download](https://www.oracle.com/java/technologies/downloads/)
- ✅ **Git** - [Download](https://git-scm.com/)

#### Optional (Recommended):
- ⭐ **VS Code** - For code editing
- ⭐ **Postman** - For API testing

### 2. System Requirements

**Minimum:**
- RAM: 8GB (16GB recommended)
- Storage: 10GB free space
- OS: Windows 10/11, macOS 10.14+, or Linux

### 3. Android SDK Requirements

In Android Studio, install:
- Android SDK Platform 33 (Android 13)
- Android SDK Build-Tools 33.0.0
- Android Emulator (for testing)

### 4. Account Requirements

- **Google Play Console Account** (if publishing) - $25 one-time fee
- **Domain & Hosting** (for backend server)

---

## 🏗️ Project Structure

```
waitnot/
├── client/                    # Customer Web App
├── server/                    # Backend API
├── waitnot-customer-app/      # Customer Android App (we'll create)
└── waitnot-restaurant-app/    # Restaurant Android App (we'll create)
```

---

## 🚀 Step-by-Step Guide

## Part 1: Prepare Your Backend Server

### Step 1.1: Deploy Backend to Production

Your backend needs to be accessible online. Options:

**Option A: Heroku (Easiest)**
```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
cd server
heroku create waitnot-api

# Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

**Option B: Railway.app (Free)**
1. Visit https://railway.app/
2. Connect your GitHub repo
3. Deploy server folder
4. Get your production URL

**Option C: DigitalOcean/AWS/Azure**
- Deploy Node.js app
- Set up MongoDB
- Configure domain

### Step 1.2: Update API URLs

Once deployed, note your production URL (e.g., `https://waitnot-api.herokuapp.com`)

---

## Part 2: Build Customer Android App

### Step 2.1: Install Capacitor

```bash
cd client
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### Step 2.2: Initialize Capacitor

```bash
npx cap init
```

Enter:
- **App name:** `WaitNot Customer`
- **App ID:** `com.waitnot.customer`
- **Web directory:** `dist`

### Step 2.3: Update API URL for Production

Create `client/src/config.js`:

```javascript
export const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-production-api.com/api'
  : 'http://localhost:5000/api';
```

Update axios calls to use this URL.

### Step 2.4: Build React App

```bash
npm run build
```

### Step 2.5: Add Android Platform

```bash
npx cap add android
```

### Step 2.6: Configure App

Edit `client/android/app/src/main/res/values/strings.xml`:

```xml
<resources>
    <string name="app_name">WaitNot Customer</string>
    <string name="title_activity_main">WaitNot</string>
    <string name="package_name">com.waitnot.customer</string>
    <string name="custom_url_scheme">waitnot</string>
</resources>
```

### Step 2.7: Add App Icon

1. Create app icon (512x512 PNG)
2. Use Android Studio's Image Asset tool:
   - Right-click `res` folder
   - New → Image Asset
   - Upload your icon
   - Generate all sizes

### Step 2.8: Sync and Build

```bash
npx cap sync
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync
2. Build → Build Bundle(s) / APK(s) → Build APK(s)
3. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## Part 3: Build Restaurant Android App

### Step 3.1: Create Separate Restaurant App

```bash
cd ..
mkdir waitnot-restaurant-app
cd waitnot-restaurant-app
```

### Step 3.2: Copy and Modify Client Code

```bash
# Copy client files
cp -r ../client/* .

# Install dependencies
npm install
```

### Step 3.3: Modify for Restaurant App

Edit `src/App.jsx` to show only restaurant routes:

```javascript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RestaurantLogin from './pages/RestaurantLogin';
import RestaurantDashboard from './pages/RestaurantDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/restaurant-login" />} />
        <Route path="/restaurant-login" element={<RestaurantLogin />} />
        <Route path="/restaurant-dashboard" element={<RestaurantDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### Step 3.4: Initialize Capacitor for Restaurant App

```bash
npx cap init
```

Enter:
- **App name:** `WaitNot Restaurant`
- **App ID:** `com.waitnot.restaurant`
- **Web directory:** `dist`

### Step 3.5: Build and Add Android

```bash
npm run build
npx cap add android
npx cap sync
npx cap open android
```

### Step 3.6: Build Restaurant APK

In Android Studio:
1. Build → Build Bundle(s) / APK(s) → Build APK(s)
2. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 📱 App Configuration Details

### Customer App Features:
- Browse restaurants
- View menus
- Add to cart
- Place orders
- Track orders
- QR code scanning

### Restaurant App Features:
- Login/Authentication
- Order management
- Menu management
- QR code generation
- Table management
- Order history

---

## 🎨 Customization

### 1. App Icons

**Customer App Icon:**
- Use food/restaurant theme
- Colors: Red (#EF4444) primary

**Restaurant App Icon:**
- Use chef/kitchen theme
- Colors: Blue/Green for distinction

### 2. Splash Screens

Create splash screens (2732x2732):
```bash
# In Android Studio
res → New → Image Asset → Launch Icons
```

### 3. App Colors

Edit `android/app/src/main/res/values/colors.xml`:

```xml
<resources>
    <color name="colorPrimary">#EF4444</color>
    <color name="colorPrimaryDark">#DC2626</color>
    <color name="colorAccent">#F59E0B</color>
</resources>
```

---

## 🔐 Signing APKs for Release

### Step 1: Generate Keystore

```bash
keytool -genkey -v -keystore waitnot-customer.keystore -alias customer-key -keyalg RSA -keysize 2048 -validity 10000
```

Answer the prompts and **SAVE THE PASSWORD!**

### Step 2: Configure Gradle

Edit `android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file('waitnot-customer.keystore')
            storePassword 'your-password'
            keyAlias 'customer-key'
            keyPassword 'your-password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Step 3: Build Release APK

```bash
cd android
./gradlew assembleRelease
```

Release APK: `android/app/build/outputs/apk/release/app-release.apk`

---

## 📤 Publishing to Google Play Store

### Step 1: Create Google Play Console Account
- Visit: https://play.google.com/console
- Pay $25 one-time registration fee

### Step 2: Create App Listing

**Customer App:**
- App name: WaitNot - Food Delivery
- Category: Food & Drink
- Description: Order food from local restaurants

**Restaurant App:**
- App name: WaitNot Restaurant Manager
- Category: Business
- Description: Manage your restaurant orders

### Step 3: Upload APK/AAB

Build AAB (Android App Bundle) - preferred format:

```bash
cd android
./gradlew bundleRelease
```

Upload: `android/app/build/outputs/bundle/release/app-release.aab`

### Step 4: Complete Store Listing

Required:
- App icon (512x512)
- Feature graphic (1024x500)
- Screenshots (at least 2)
- Privacy policy URL
- App description
- Category

### Step 5: Submit for Review

- Set pricing (Free/Paid)
- Select countries
- Submit for review
- Wait 1-7 days for approval

---

## 🧪 Testing

### Test on Real Device

1. Enable Developer Options on Android phone
2. Enable USB Debugging
3. Connect phone to computer
4. In Android Studio, select your device
5. Click Run

### Test APK Installation

```bash
# Install APK on connected device
adb install app-debug.apk

# Or share APK file and install manually
```

---

## 📊 Complete Checklist

### Backend Deployment ✅
- [ ] Deploy server to production
- [ ] Set up production database
- [ ] Configure environment variables
- [ ] Test API endpoints
- [ ] Set up SSL certificate

### Customer App ✅
- [ ] Install Capacitor
- [ ] Update API URLs
- [ ] Build React app
- [ ] Add Android platform
- [ ] Configure app icon
- [ ] Configure splash screen
- [ ] Test on device
- [ ] Build debug APK
- [ ] Build release APK
- [ ] Sign APK

### Restaurant App ✅
- [ ] Create separate project
- [ ] Modify routes for restaurant
- [ ] Install Capacitor
- [ ] Update API URLs
- [ ] Build React app
- [ ] Add Android platform
- [ ] Configure app icon (different from customer)
- [ ] Configure splash screen
- [ ] Test on device
- [ ] Build debug APK
- [ ] Build release APK
- [ ] Sign APK

### Play Store ✅
- [ ] Create Play Console account
- [ ] Create customer app listing
- [ ] Create restaurant app listing
- [ ] Upload screenshots
- [ ] Write descriptions
- [ ] Set up privacy policy
- [ ] Upload APK/AAB
- [ ] Submit for review

---

## 🛠️ Troubleshooting

### Issue: Gradle Build Failed
**Solution:**
```bash
cd android
./gradlew clean
./gradlew build
```

### Issue: White Screen on Launch
**Solution:**
- Check API URL is correct
- Verify `dist` folder has files
- Check browser console in Android Studio

### Issue: App Crashes
**Solution:**
- Check AndroidManifest.xml permissions
- Review logcat in Android Studio
- Ensure all dependencies installed

### Issue: Cannot Connect to API
**Solution:**
- Use HTTPS for production API
- Add network security config
- Check CORS settings on server

---

## 📁 File Structure After Setup

```
waitnot/
├── client/                           # Customer Web App
│   ├── android/                      # Customer Android App
│   │   └── app/build/outputs/apk/
│   ├── capacitor.config.json
│   └── dist/
│
├── waitnot-restaurant-app/           # Restaurant App
│   ├── android/                      # Restaurant Android App
│   │   └── app/build/outputs/apk/
│   ├── capacitor.config.json
│   └── dist/
│
└── server/                           # Backend (deployed)
```

---

## 💰 Cost Breakdown

| Item | Cost |
|------|------|
| Google Play Console | $25 (one-time) |
| Domain Name | $10-15/year |
| Hosting (Heroku/Railway) | $0-7/month |
| SSL Certificate | Free (Let's Encrypt) |
| **Total First Year** | **~$25-$100** |

---

## ⏱️ Time Estimate

| Task | Time |
|------|------|
| Backend Deployment | 1-2 hours |
| Customer App Setup | 2-3 hours |
| Restaurant App Setup | 2-3 hours |
| Testing | 2-4 hours |
| Play Store Setup | 2-3 hours |
| **Total** | **9-15 hours** |

---

## 🎯 Quick Commands Reference

### Customer App
```bash
cd client
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "WaitNot Customer" "com.waitnot.customer" --web-dir=dist
npm run build
npx cap add android
npx cap sync
npx cap open android
```

### Restaurant App
```bash
cd waitnot-restaurant-app
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "WaitNot Restaurant" "com.waitnot.restaurant" --web-dir=dist
npm run build
npx cap add android
npx cap sync
npx cap open android
```

---

## 📞 Support & Resources

- **Capacitor Docs:** https://capacitorjs.com/docs
- **Android Studio:** https://developer.android.com/studio
- **Play Console:** https://play.google.com/console
- **Stack Overflow:** Search "Capacitor Android"

---

## 🎉 Success Criteria

You'll know you're successful when:
- ✅ Both APKs install on Android devices
- ✅ Apps connect to production API
- ✅ Customer app can browse and order
- ✅ Restaurant app can manage orders
- ✅ Apps work online (with internet)
- ✅ Apps are published on Play Store

---

## 📝 Next Steps After Building

1. **Beta Testing:** Share APKs with friends/family
2. **Gather Feedback:** Fix bugs and improve UX
3. **Marketing:** Create social media presence
4. **Updates:** Regular updates with new features
5. **Analytics:** Add Firebase Analytics
6. **Monetization:** Add payment gateway

---

## 🚨 Important Notes

1. **API URL:** Must use HTTPS in production
2. **Permissions:** Request only needed permissions
3. **Testing:** Test on multiple Android versions
4. **Updates:** Keep dependencies updated
5. **Backup:** Keep keystore file safe (can't recover!)
6. **Privacy:** Add privacy policy (required by Play Store)

---

Good luck building your apps! 🚀📱
