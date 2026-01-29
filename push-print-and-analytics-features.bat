@echo off
echo ========================================
echo  PUSHING PRINT & ANALYTICS FEATURES
echo ========================================
echo.
echo Features being pushed:
echo - Print Receipt Buttons (Order History)
echo - Order History Auto-Clear
echo - Thermal Printer Optimization
echo - Enhanced Analytics with Clearing
echo.

REM Add all changes
echo [1/6] Adding all changes to git...
git add .

REM Check if there are changes to commit
git diff --staged --quiet
if %errorlevel% equ 0 (
    echo No changes to commit.
    pause
    exit /b 0
)

REM Commit changes
echo [2/6] Committing changes...
git commit -m "feat: Print Receipt & Analytics Features

✨ New Features:
- Print receipt buttons in Order History section
- Order history auto-clear after report generation
- Manual order history clearing button
- Enhanced thermal printer optimization

🖨️ Print Quality Improvements:
- Bold fonts for better thermal printer output
- Enhanced styling with solid borders
- Improved text clarity and readability
- Professional receipt formatting

📊 Analytics Enhancements:
- Clear history option in report generation
- Manual clear history button
- Confirmation dialogs for safety
- Auto-refresh after clearing

🔧 Technical Improvements:
- Enhanced print CSS for thermal printers
- Better font rendering and spacing
- Improved receipt templates
- Database cleanup functionality

🐛 Bug Fixes:
- Fixed print receipt button visibility
- Resolved thermal printer text quality issues
- Enhanced print styling consistency
- Improved receipt formatting"

if %errorlevel% neq 0 (
    echo Error: Failed to commit changes
    pause
    exit /b 1
)

REM Push to origin main
echo [3/6] Pushing to GitHub...
git push origin main

if %errorlevel% neq 0 (
    echo Error: Failed to push to GitHub
    echo Trying to set upstream...
    git push --set-upstream origin main
    if %errorlevel% neq 0 (
        echo Error: Failed to push with upstream
        pause
        exit /b 1
    )
)

REM Check git status
echo [4/6] Checking git status...
git status

REM Show recent commits
echo [5/6] Recent commits:
git log --oneline -5

echo [6/6] Push completed successfully!
echo.
echo ========================================
echo  DEPLOYMENT READY
echo ========================================
echo.
echo Latest features pushed to GitHub:
echo ✅ Print Receipt Buttons
echo ✅ Order History Auto-Clear  
echo ✅ Thermal Printer Optimization
echo ✅ Enhanced Analytics
echo.
echo Next steps:
echo 1. Deploy to production server
echo 2. Test print functionality
echo 3. Verify analytics clearing
echo.
pause