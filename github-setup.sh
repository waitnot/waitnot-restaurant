#!/bin/bash

echo "========================================"
echo "GitHub Complete Logout and Fresh Login"
echo "========================================"
echo

echo "Step 1: Logging out from GitHub CLI..."
gh auth logout 2>/dev/null || echo "⚠️  GitHub CLI not found or already logged out"
echo "✅ GitHub CLI logout attempted"
echo

echo "Step 2: Clearing Git credentials..."
git config --global --unset-all credential.helper 2>/dev/null || true
git config --global --unset user.name 2>/dev/null || true
git config --global --unset user.email 2>/dev/null || true
echo "✅ Git credentials cleared"
echo

echo "Step 3: Removing credential files..."
rm ~/.git-credentials 2>/dev/null && echo "✅ Credential file removed" || echo "ℹ️  No credential file found"
echo

echo "Step 4: Setting up fresh Git configuration..."
git config --global user.name "waitnot"
git config --global user.email "waitnot.menu.storage@gmail.com"
git config --global credential.helper store
echo "✅ Fresh Git configuration set"
echo

echo "Step 5: Checking current Git configuration..."
echo "=== Current Git Config ==="
git config --global --list | grep user || echo "No user config found"
echo

echo "Step 6: Checking repository status..."
git status
echo

echo "Step 7: Checking remote repository..."
git remote -v
echo

echo "Step 8: Attempting to push to GitHub..."
echo "⚠️  You will be prompted for GitHub credentials:"
echo "   Username: waitnot"
echo "   Password: [Use Personal Access Token from waitnot account]"
echo
read -p "Press Enter to continue with push..."
git push -u origin main

echo
echo "========================================"
echo "Process completed!"
echo "========================================"