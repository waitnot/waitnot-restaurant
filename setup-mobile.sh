#!/bin/bash

# WaitNot Mobile App Setup Script
# This script sets up Capacitor for Android APK generation

echo "🚀 Setting up WaitNot Mobile App..."
echo ""

# Navigate to client directory
cd client

# Install Capacitor
echo "📦 Installing Capacitor..."
npm install @capacitor/core @capacitor/cli @capacitor/android

# Initialize Capacitor
echo "⚙️ Initializing Capacitor..."
npx cap init "WaitNot" "com.waitnot.app" --web-dir=dist

# Build the React app
echo "🔨 Building React app..."
npm run build

# Add Android platform
echo "📱 Adding Android platform..."
npx cap add android

# Sync web assets
echo "🔄 Syncing assets..."
npx cap sync

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Open Android Studio: npx cap open android"
echo "2. Wait for Gradle sync"
echo "3. Click Run to test on device/emulator"
echo "4. Build APK: Build → Build Bundle(s) / APK(s) → Build APK(s)"
echo ""
echo "APK will be in: android/app/build/outputs/apk/debug/"
