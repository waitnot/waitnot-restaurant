# 🚀 Deploy WaitNot to Production Server

## ⚠️ **Important: Server Not Deployed Yet**

The desktop app is configured to connect to `https://waitnot-restaurant.onrender.com`, but this server is not deployed yet. You need to deploy your WaitNot server first.

## 🎯 **Quick Deployment Steps:**

### **Step 1: Push Code to GitHub**
```bash
git add .
git commit -m "feat: Complete WaitNot system with desktop app"
git push origin main
```

### **Step 2: Deploy to Render**
1. **Go to [render.com](https://render.com)**
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**
4. **Configure deployment:**
   - **Name**: `waitnot-restaurant`
   - **Environment**: Node
   - **Build Command**: `npm run render-build`
   - **Start Command**: `npm start`

### **Step 3: Set Environment Variables**
```
NODE_ENV=production
PORT=10000
DATABASE_URL=your_postgresql_url_here
JWT_SECRET=your_secure_jwt_secret_here
```

### **Step 4: Deploy**
- Click "Create Web Service"
- Wait for deployment (5-10 minutes)
- Your server will be available at: `https://waitnot-restaurant.onrender.com`

## 🖥️ **Then Test Desktop App**

Once your server is deployed:

1. **Rebuild desktop app** (it's already configured correctly):
   ```bash
   cd restaurant-app
   npm run build-win
   ```

2. **Test the installer**: `restaurant-app/dist/WaitNot Restaurant Setup 1.0.0.exe`

3. **Desktop app will connect** to your production server automatically

## 📱 **Login Credentials for Production:**
- **Email**: `king@gmail.com`
- **Password**: `password123`

## ✅ **What's Already Configured:**

The desktop app is already properly configured to connect to your production server:
- ✅ **Production URL**: `https://waitnot-restaurant.onrender.com/restaurant-login`
- ✅ **Development URL**: `http://localhost:3000/restaurant-login`
- ✅ **Professional installer** ready
- ✅ **Network connectivity** configured
- ✅ **Analytics tracking** integrated

## 🚀 **Ready for Distribution!**

Once deployed, you can immediately distribute the desktop app to restaurants:
- **Installer**: `WaitNot Restaurant Setup 1.0.0.exe`
- **Connects to**: Your production server
- **Professional experience** for restaurants
- **Real-time data sync** with cloud server