#!/bin/bash

echo "========================================"
echo "Fixing Render Deployment Issues"
echo "========================================"
echo

echo "Step 1: Adding fixed files to git..."
git add .
echo "✅ Files added to git"

echo "Step 2: Committing deployment fixes..."
git commit -m "Fix Render deployment: Move vite to dependencies and add static file serving

- Move vite and build tools from devDependencies to dependencies
- Add static file serving for React build in production
- Update build scripts for better Render compatibility
- Add path imports for serving React app"

echo "✅ Changes committed"

echo "Step 3: Pushing fixes to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Fixes pushed to GitHub successfully!"
    echo
    echo "🚀 Now go to Render and trigger a new deployment:"
    echo "   1. Go to your Render dashboard"
    echo "   2. Find your waitnot-restaurant service"
    echo "   3. Click 'Manual Deploy' → 'Deploy latest commit'"
    echo
    echo "The build should now succeed!"
else
    echo "❌ Failed to push to GitHub"
fi

echo
echo "========================================"
echo "Deployment fix completed!"
echo "========================================"