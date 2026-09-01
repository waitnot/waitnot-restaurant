#!/bin/bash

echo "========================================"
echo "Force Fresh GitHub Authentication"
echo "========================================"
echo

echo "Step 1: Adding new files to commit..."
git add github-logout-login.bat github-setup.sh force-fresh-auth.sh
git commit -m "Add GitHub authentication scripts"
echo "✅ New files committed"
echo

echo "Step 2: Clearing Windows Credential Manager entries..."
# Force clear Windows credentials for GitHub
git config --global --unset credential.helper
git config --global credential.helper ""
echo "✅ Credential helper cleared"
echo

echo "Step 3: Setting up manual credential entry..."
# This forces Git to prompt for credentials every time
git config --global credential.helper ""
echo "✅ Manual credential entry enabled"
echo

echo "Step 4: Verify Git configuration..."
echo "=== Current Git Config ==="
echo "User: $(git config --global user.name)"
echo "Email: $(git config --global user.email)"
echo "Credential Helper: $(git config --global credential.helper)"
echo

echo "Step 5: Testing authentication with fresh credentials..."
echo "🔑 Git will now prompt for credentials:"
echo "   Username: waitnot"
echo "   Password: [Personal Access Token from waitnot GitHub account]"
echo
echo "⚠️  IMPORTANT: Use Personal Access Token as password, NOT your GitHub password!"
echo
read -p "Press Enter when you have your Personal Access Token ready..."

# Force authentication by trying to push
echo "Attempting push with fresh authentication..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo
    echo "🎉 SUCCESS! Code pushed to GitHub successfully!"
    echo "Repository: https://github.com/waitnot/waitnot-restaurant"
else
    echo
    echo "❌ Push failed. Let's try alternative methods..."
    echo
    echo "Alternative 1: Create repository first"
    echo "Make sure https://github.com/waitnot/waitnot-restaurant exists"
    echo
    echo "Alternative 2: Use different repository URL"
    echo "Try: git remote set-url origin https://github.com/waitnot/waitnot-system.git"
    echo
    echo "Alternative 3: Use SSH instead of HTTPS"
    echo "Try: git remote set-url origin git@github.com:waitnot/waitnot-restaurant.git"
fi

echo
echo "========================================"
echo "Authentication process completed!"
echo "========================================"