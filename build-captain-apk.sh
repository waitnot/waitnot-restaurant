#!/bin/bash
set -e
cd "$(dirname "$0")/client"

echo "🚀 Building WaitNot Captain APK..."

# Step 1: Build web assets
echo "📦 Building captain web app..."
npm run build:captain

# Step 2: Backup original capacitor config
cp capacitor.config.json capacitor.config.backup.json

# Step 3: Use captain config
cp capacitor.captain.json capacitor.config.json

# Step 4: Point webDir to dist-captain
echo "🔧 Switching to captain config..."

# Step 5: Add android if not present
if [ ! -d "android" ]; then
  echo "📱 Adding Android platform..."
  npx cap add android
fi

# Step 6: Sync
echo "🔄 Syncing..."
npx cap sync android

# Step 7: Restore original config
cp capacitor.config.backup.json capacitor.config.json
rm capacitor.config.backup.json

echo "✅ Done! Opening Android Studio..."
echo "   In Android Studio: Build → Build APK(s)"
npx cap open android
