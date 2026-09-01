#!/bin/bash

echo "========================================"
echo "Pushing PostgreSQL Integration to GitHub"
echo "========================================"

echo ""
echo "Step 1: Checking Git status..."
git status

echo ""
echo "Step 2: Adding all changes..."
git add .

echo ""
echo "Step 3: Committing changes..."
git commit -m "feat: Complete PostgreSQL integration with Neon database

- Replace JSON files with PostgreSQL for production scalability
- Add automatic data migration preserving all existing data  
- Update all database operations with proper transactions
- Add connection pooling and error handling
- Update deployment guide with database setup
- Ready for production deployment on Render"

echo ""
echo "Step 4: Checking remote repository..."
git remote -v

echo ""
echo "Step 5: Setting up authentication..."
git config --global credential.helper store

echo ""
echo "Step 6: Attempting to push..."
echo "⚠️  You will be prompted for GitHub credentials:"
echo "   Username: waitnot"
echo "   Password: [Use Personal Access Token from waitnot account]"
echo ""
echo "🔑 Make sure you have the Personal Access Token ready!"
echo ""
read -p "Press Enter when you have your Personal Access Token ready..."

git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS: Code pushed to GitHub successfully!"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Go to Render dashboard"
    echo "   2. Your service will auto-deploy"
    echo "   3. Check logs for database migration"
    echo "   4. Test the application"
    echo ""
    echo "📊 What to expect in Render logs:"
    echo "   ✅ Connected to Neon PostgreSQL database"
    echo "   ✅ Database tables created successfully"
    echo "   ✅ Data migration completed successfully!"
    echo "   📈 Migration Summary with data counts"
    echo ""
else
    echo ""
    echo "❌ PUSH FAILED"
    echo ""
    echo "🔧 Troubleshooting options:"
    echo ""
    echo "Option 1: Get Personal Access Token"
    echo "   - Go to GitHub Settings > Developer settings > Personal access tokens"
    echo "   - Generate new token with 'repo' permissions"
    echo "   - Use token as password when prompted"
    echo ""
    echo "Option 2: Try manual authentication"
    echo "   - Run: git config --global user.name 'waitnot'"
    echo "   - Run: git config --global user.email 'waitnot.menu.storage@gmail.com'"
    echo "   - Then retry: git push origin main"
    echo ""
    echo "Option 3: Alternative repository"
    echo "   - Create new repository on GitHub"
    echo "   - Run: git remote set-url origin https://github.com/waitnot/NEW_REPO_NAME.git"
    echo "   - Then retry push"
    echo ""
fi

echo ""
echo "========================================"
echo "Push process completed!"
echo "========================================"