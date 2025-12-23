# ✅ Requirements Checklist for Building APKs

## 📥 Software Installation Checklist

### Essential Software (Must Install)

- [ ] **Node.js (v16+)**
  - Download: https://nodejs.org/
  - Verify: `node --version`
  - Should show: v16.x.x or higher

- [ ] **npm (comes with Node.js)**
  - Verify: `npm --version`
  - Should show: 8.x.x or higher

- [ ] **Android Studio**
  - Download: https://developer.android.com/studio
  - Size: ~1GB download, ~3GB installed
  - Install with default settings

- [ ] **Java JDK 11+**
  - Download: https://www.oracle.com/java/technologies/downloads/
  - Or use OpenJDK: https://adoptium.net/
  - Verify: `java -version`
  - Should show: version 11 or higher

- [ ] **Git**
  - Download: https://git-scm.com/
  - Verify: `git --version`

### Android Studio Components

After installing Android Studio, install these via SDK Manager:

- [ ] Android SDK Platform 33 (Android 13)
- [ ] Android SDK Build-Tools 33.0.0
- [ ] Android Emulator
- [ ] Android SDK Platform-Tools
- [ ] Intel x86 Emulator Accelerator (HAXM) - for Windows/Mac

### Environment Variables (Windows)

- [ ] ANDROID_HOME
  - Path: `C:\Users\YourName\AppData\Local\Android\Sdk`
  
- [ ] Add to PATH:
  - `%ANDROID_HOME%\platform-tools`
  - `%ANDROID_HOME%\tools`
  - `%ANDROID_HOME%\tools\bin`

- [ ] JAVA_HOME
  - Path: `C:\Program Files\Java\jdk-11.x.x`

---

## 💻 System Requirements

### Minimum Requirements
- [ ] RAM: 8GB
- [ ] Storage: 10GB free space
- [ ] Processor: Intel i3 or equivalent
- [ ] OS: Windows 10/11, macOS 10.14+, or Linux

### Recommended Requirements
- [ ] RAM: 16GB
- [ ] Storage: 20GB free space (SSD preferred)
- [ ] Processor: Intel i5/i7 or equivalent
- [ ] Graphics: Dedicated GPU (for emulator)

---

## 🌐 Backend Requirements

### Server Deployment
- [ ] Backend deployed to production server
- [ ] Production URL available (e.g., https://api.waitnot.com)
- [ ] SSL certificate installed (HTTPS)
- [ ] Database accessible from production
- [ ] CORS configured for mobile apps

### Recommended Hosting Platforms
- [ ] Heroku (Free tier available)
- [ ] Railway.app (Free tier available)
- [ ] DigitalOcean ($5/month)
- [ ] AWS/Azure (Pay as you go)

---

## 📱 Mobile Development Setup

### Android Device (Choose One)

**Option 1: Physical Device**
- [ ] Android phone/tablet (Android 7.0+)
- [ ] USB cable
- [ ] Developer options enabled
- [ ] USB debugging enabled

**Option 2: Emulator**
- [ ] Android Emulator installed
- [ ] Virtual device created (Pixel 5 recommended)
- [ ] At least 4GB RAM allocated

---

## 🎨 Design Assets Required

### App Icons
- [ ] Customer app icon (512x512 PNG)
- [ ] Restaurant app icon (512x512 PNG)
- [ ] Icons should be different colors/themes

### Splash Screens
- [ ] Customer splash screen (2732x2732 PNG)
- [ ] Restaurant splash screen (2732x2732 PNG)

### Screenshots (for Play Store)
- [ ] At least 2 screenshots per app
- [ ] Size: 1080x1920 or 1440x2560
- [ ] Show key features

### Feature Graphic
- [ ] 1024x500 PNG
- [ ] For Play Store listing

---

## 📄 Legal Requirements

### Privacy Policy
- [ ] Privacy policy document created
- [ ] Hosted on accessible URL
- [ ] Covers data collection and usage

### Terms of Service
- [ ] Terms of service document
- [ ] Hosted on accessible URL

### App Descriptions
- [ ] Customer app description (4000 chars max)
- [ ] Restaurant app description (4000 chars max)
- [ ] Short description (80 chars max)

---

## 💳 Account Requirements

### Google Play Console
- [ ] Google account created
- [ ] $25 registration fee paid
- [ ] Developer account verified

### Optional Services
- [ ] Firebase account (for analytics)
- [ ] Crashlytics account (for crash reporting)
- [ ] Payment gateway account (Stripe/Razorpay)

---

## 🔧 Project Setup Checklist

### Customer App
- [ ] Capacitor installed
- [ ] App initialized with correct package name
- [ ] API URLs updated to production
- [ ] App built successfully
- [ ] Android platform added
- [ ] App icon configured
- [ ] Splash screen configured
- [ ] Tested on device/emulator
- [ ] Debug APK generated
- [ ] Release APK signed

### Restaurant App
- [ ] Separate project created
- [ ] Routes modified for restaurant only
- [ ] Capacitor installed
- [ ] App initialized with different package name
- [ ] API URLs updated to production
- [ ] App built successfully
- [ ] Android platform added
- [ ] App icon configured (different from customer)
- [ ] Splash screen configured
- [ ] Tested on device/emulator
- [ ] Debug APK generated
- [ ] Release APK signed

---

## 🧪 Testing Checklist

### Customer App Testing
- [ ] App installs successfully
- [ ] Can browse restaurants
- [ ] Can view menu items
- [ ] Can add items to cart
- [ ] Can place orders
- [ ] Can scan QR codes
- [ ] Language switching works
- [ ] Numbers display correctly
- [ ] Images load properly
- [ ] No crashes or errors

### Restaurant App Testing
- [ ] App installs successfully
- [ ] Can login as restaurant
- [ ] Can view orders
- [ ] Can update order status
- [ ] Can manage menu items
- [ ] Can upload images
- [ ] Can generate QR codes
- [ ] Can view order history
- [ ] Can manage tables
- [ ] Language switching works
- [ ] No crashes or errors

---

## 📤 Play Store Submission Checklist

### Customer App Listing
- [ ] App name: "WaitNot - Food Delivery"
- [ ] Package name: com.waitnot.customer
- [ ] Category: Food & Drink
- [ ] App icon uploaded
- [ ] Feature graphic uploaded
- [ ] Screenshots uploaded (min 2)
- [ ] Description written
- [ ] Privacy policy URL added
- [ ] Content rating completed
- [ ] Pricing set (Free)
- [ ] Countries selected
- [ ] Release APK/AAB uploaded

### Restaurant App Listing
- [ ] App name: "WaitNot Restaurant Manager"
- [ ] Package name: com.waitnot.restaurant
- [ ] Category: Business
- [ ] App icon uploaded
- [ ] Feature graphic uploaded
- [ ] Screenshots uploaded (min 2)
- [ ] Description written
- [ ] Privacy policy URL added
- [ ] Content rating completed
- [ ] Pricing set (Free)
- [ ] Countries selected
- [ ] Release APK/AAB uploaded

---

## 🔐 Security Checklist

### Keystore Files
- [ ] Customer app keystore generated
- [ ] Restaurant app keystore generated
- [ ] Keystore passwords saved securely
- [ ] Keystore files backed up (CRITICAL!)

### API Security
- [ ] HTTPS enabled on backend
- [ ] API keys not exposed in code
- [ ] Environment variables used
- [ ] CORS properly configured
- [ ] Rate limiting enabled

---

## 📊 Pre-Launch Checklist

### Final Checks
- [ ] All features working
- [ ] No console errors
- [ ] No crashes
- [ ] Performance is good
- [ ] Battery usage is reasonable
- [ ] App size is reasonable (<50MB)
- [ ] Tested on multiple devices
- [ ] Tested on different Android versions
- [ ] Beta testing completed
- [ ] Feedback incorporated

### Marketing Preparation
- [ ] Social media accounts created
- [ ] Website/landing page ready
- [ ] Demo video created
- [ ] Press release prepared
- [ ] Launch date set

---

## ⏱️ Time Estimates

| Task | Time Required |
|------|---------------|
| Software installation | 2-3 hours |
| Backend deployment | 1-2 hours |
| Customer app setup | 2-3 hours |
| Restaurant app setup | 2-3 hours |
| Testing both apps | 3-4 hours |
| Design assets creation | 2-4 hours |
| Play Store setup | 2-3 hours |
| **Total** | **14-22 hours** |

---

## 💰 Cost Estimates

| Item | Cost |
|------|------|
| Google Play Console | $25 (one-time) |
| Domain name | $10-15/year |
| Hosting (Heroku/Railway) | $0-7/month |
| SSL certificate | Free (Let's Encrypt) |
| Design tools (optional) | $0-20/month |
| **First Year Total** | **$25-$200** |

---

## 📞 Support Resources

### Documentation
- Capacitor: https://capacitorjs.com/docs
- Android Studio: https://developer.android.com/docs
- React: https://react.dev/
- Node.js: https://nodejs.org/docs

### Community
- Stack Overflow: https://stackoverflow.com/
- Reddit: r/androiddev, r/reactjs
- Discord: Capacitor Community

### Troubleshooting
- GitHub Issues: Check Capacitor repo
- Google: Search error messages
- ChatGPT: Ask for help

---

## ✅ Ready to Build?

You're ready when you have:
- ✅ All software installed
- ✅ Backend deployed
- ✅ Design assets ready
- ✅ Google Play account
- ✅ 2-3 days of dedicated time

---

## 🎯 Success Metrics

You'll know you're successful when:
1. Both APKs install on Android devices
2. Apps connect to your production API
3. All features work as expected
4. Apps are published on Play Store
5. Users can download and use them

---

**Good luck! You've got this! 🚀**
