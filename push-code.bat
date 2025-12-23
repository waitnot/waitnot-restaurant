@echo off
echo ========================================
echo Pushing PostgreSQL Integration to GitHub
echo ========================================

echo.
echo Step 1: Checking Git status...
git status

echo.
echo Step 2: Adding all changes...
git add .

echo.
echo Step 3: Committing changes...
git commit -m "feat: Complete PostgreSQL integration with Neon database - Replace JSON files with PostgreSQL for production scalability - Add automatic data migration preserving all existing data - Update all database operations with proper transactions - Add connection pooling and error handling - Update deployment guide with database setup"

echo.
echo Step 4: Checking remote repository...
git remote -v

echo.
echo Step 5: Attempting to push...
echo ⚠️  You will be prompted for GitHub credentials:
echo    Username: waitnot
echo    Password: [Use Personal Access Token from waitnot account]
echo.
echo 🔑 Make sure you have the Personal Access Token ready!
echo.
pause

git push origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ SUCCESS: Code pushed to GitHub successfully!
    echo.
    echo 🚀 Next steps:
    echo    1. Go to Render dashboard
    echo    2. Your service will auto-deploy
    echo    3. Check logs for database migration
    echo    4. Test the application
    echo.
) else (
    echo.
    echo ❌ PUSH FAILED
    echo.
    echo 🔧 Troubleshooting options:
    echo.
    echo Option 1: Use Personal Access Token
    echo    - Go to GitHub Settings ^> Developer settings ^> Personal access tokens
    echo    - Generate new token with repo permissions
    echo    - Use token as password when prompted
    echo.
    echo Option 2: Try different authentication
    echo    - Run: git config --global credential.helper store
    echo    - Then retry this script
    echo.
    echo Option 3: Manual push
    echo    - Open Git Bash
    echo    - Run: git push origin main
    echo    - Enter waitnot username and token
    echo.
)

echo.
echo ========================================
echo Push process completed!
echo ========================================
pause