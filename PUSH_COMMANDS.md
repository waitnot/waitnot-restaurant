# Quick Push Commands

## Option 1: Use the Batch Script (Windows)
```cmd
push-code.bat
```

## Option 2: Use the Shell Script (Git Bash)
```bash
./push-code.sh
```

## Option 3: Manual Commands
Run these commands one by one:

```bash
# 1. Add all changes
git add .

# 2. Commit with message
git commit -m "feat: Complete PostgreSQL integration with Neon database"

# 3. Set up credential storage
git config --global credential.helper store

# 4. Push to GitHub
git push origin main
```

## Option 4: PowerShell Commands
```powershell
# Add and commit
git add .
git commit -m "feat: Complete PostgreSQL integration"

# Push (will prompt for credentials)
git push origin main
```

## Authentication Details
When prompted for credentials:
- **Username**: `waitnot`
- **Password**: Use your Personal Access Token (NOT your GitHub password)

## Get Personal Access Token
1. Go to GitHub.com
2. Settings → Developer settings → Personal access tokens → Tokens (classic)
3. Generate new token
4. Select "repo" permissions
5. Copy the token and use it as password

## After Successful Push
1. Go to your Render dashboard
2. The service will automatically deploy
3. Check the deployment logs for:
   - ✅ Database connection success
   - ✅ Table creation
   - ✅ Data migration completion
4. Test your application at the Render URL

## If Push Fails
Try these troubleshooting steps:

```bash
# Clear credentials and try again
git config --global --unset credential.helper
git config --global credential.helper store
git push origin main
```

Or create a new repository and update the remote:
```bash
git remote set-url origin https://github.com/waitnot/NEW_REPO_NAME.git
git push origin main
```