#!/bin/bash

echo "========================================="
echo "🚀 Pushing WaitNot Code to GitHub"
echo "========================================="

echo ""
echo "Step 1: Checking current status..."
git status

echo ""
echo "Step 2: Adding all changes..."
git add .

echo ""
echo "Step 3: Committing changes..."
git commit -m "feat: Complete restaurant system with PostgreSQL and profile editing

✅ PostgreSQL Integration:
- Full database migration from JSON to PostgreSQL
- Automatic data migration preserving all existing data
- Connection pooling and transaction support
- Production-ready database operations

✅ Restaurant Profile Editing:
- Complete profile management interface
- Image upload with compression
- Edit all restaurant details (name, description, phone, address, etc.)
- Cuisine management and operational settings

✅ Login System Fixed:
- Resolved password authentication issues
- Proper bcrypt hashing and validation
- Debug tools and startup data creation

✅ Analytics & Features:
- Real-time analytics dashboard
- QR code ordering system
- Kitchen printing functionality
- Order management system

Ready for production deployment on Render!"

echo ""
echo "Step 4: Pushing to GitHub..."
echo "⚠️  You will be prompted for credentials:"
echo "   Username: waitnot"
echo "   Password: [Your Personal Access Token]"
echo ""

# Push to GitHub
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 SUCCESS! Code pushed to GitHub successfully!"
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Go to your Render dashboard"
    echo "   2. Your service will auto-deploy"
    echo "   3. Check deployment logs"
    echo "   4. Test your application"
    echo ""
    echo "📝 Login credentials for testing:"
    echo "   Email: king@gmail.com"
    echo "   Password: password123"
    echo ""
else
    echo ""
    echo "❌ Push failed!"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "1. Make sure you have a Personal Access Token"
    echo "2. Go to GitHub.com → Settings → Developer settings → Personal access tokens"
    echo "3. Generate new token with 'repo' permissions"
    echo "4. Use the token as your password (not your GitHub password)"
    echo ""
fi

echo "========================================="
echo "Push process completed!"
echo "========================================="