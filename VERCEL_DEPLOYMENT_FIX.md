# 🔧 Vercel Deployment Fix - CORS Issue

## 🚨 **PROBLEM IDENTIFIED**

**Issue**: Application works on localhost but shows "Loading..." on Vercel domain
**Root Cause**: CORS configuration on Render server doesn't allow requests from Vercel domain

## ✅ **SOLUTION APPLIED**

### **CORS Configuration Updated**
```javascript
// Before (BLOCKED Vercel requests)
origin: ['https://waitnot-restaurant.onrender.com', 'https://your-domain.com']

// After (ALLOWS Vercel requests)  
origin: (origin, callback) => {
  if (!origin) return callback(null, true);
  
  if (allowedOrigins.includes(origin) || origin.includes('vercel.app')) {
    return callback(null, true);
  }
  
  console.log('❌ CORS blocked origin:', origin);
  return callback(new Error('Not allowed by CORS'));
}
```

### **Allowed Origins Added**
- ✅ `https://waitnot-restaurant-app.vercel.app` (your main Vercel domain)
- ✅ `*.vercel.app` (all Vercel preview deployments)
- ✅ Enhanced logging for debugging

---

## 🚀 **DEPLOYMENT STEPS**

### **1. Push CORS Fix**
```bash
# Run the automated script
./fix-vercel-cors.bat

# OR manual push
git add server/server.js
git commit -m "fix: Add Vercel domain to CORS configuration"
git push origin main
```

### **2. Wait for Render Deployment**
- **Time**: 2-3 minutes
- **URL**: https://dashboard.render.com
- **Check**: Deployment logs for success

### **3. Test Vercel App**
- **URL**: https://waitnot-restaurant-app.vercel.app
- **Expected**: No more "Loading..." - should show restaurant page
- **Test**: QR code functionality

---

## 🧪 **TESTING CHECKLIST**

### **Before Fix (Current State)**
- ❌ Vercel app shows "Loading..."
- ❌ Browser console shows CORS errors
- ❌ API requests blocked by server
- ✅ Localhost works fine

### **After Fix (Expected State)**
- ✅ Vercel app loads restaurant page
- ✅ No CORS errors in console
- ✅ API requests successful
- ✅ QR code functionality works
- ✅ Localhost still works

---

## 🔍 **TROUBLESHOOTING**

### **If Still Not Working After Fix:**

#### **1. Check Render Deployment**
```bash
# Check if deployment completed
curl https://waitnot-restaurant.onrender.com/health
```
**Expected Response**: `{"status":"OK","timestamp":"...","uptime":...}`

#### **2. Check Browser Console**
1. Open Vercel app: https://waitnot-restaurant-app.vercel.app
2. Press F12 → Console tab
3. Look for errors:
   - ❌ CORS errors = Server not updated yet
   - ❌ Network errors = Server down
   - ❌ 404 errors = API endpoints missing

#### **3. Check Network Tab**
1. F12 → Network tab
2. Refresh page
3. Look for failed requests:
   - Red requests = CORS or server issues
   - Check request URLs = Should point to Render, not localhost

#### **4. Manual API Test**
```bash
# Test API directly
curl -X GET "https://waitnot-restaurant.onrender.com/api/restaurants" \
  -H "Origin: https://waitnot-restaurant-app.vercel.app"
```

### **Common Issues & Solutions**

#### **Issue 1: Still Shows "Loading..."**
**Cause**: Render deployment not completed
**Solution**: 
- Wait 5 more minutes
- Check Render dashboard for deployment status
- Look for build errors in Render logs

#### **Issue 2: CORS Errors in Console**
**Cause**: Old server version still running
**Solution**:
- Force restart Render service
- Check if commit was pushed successfully
- Verify CORS code in GitHub repository

#### **Issue 3: API Requests to Localhost**
**Cause**: Frontend still configured for development
**Solution**:
- Check if `NODE_ENV=production` on Vercel
- Verify environment detection in browser console
- Check axios/api configuration logs

#### **Issue 4: 500 Server Errors**
**Cause**: Database connection issues
**Solution**:
- Check Render logs for database errors
- Verify Neon PostgreSQL connection
- Test database migration scripts

---

## 🔧 **MANUAL FIXES**

### **If Automated Script Fails:**

#### **1. Manual Git Push**
```bash
# Open Git Bash or Command Prompt
git add server/server.js
git commit -m "fix: Add Vercel domain to CORS configuration"
git push origin main
```

#### **2. Direct Render Deployment**
1. Go to Render Dashboard
2. Find your service
3. Click "Manual Deploy" → "Deploy latest commit"

#### **3. Vercel Redeploy**
1. Go to Vercel Dashboard
2. Find your project
3. Click "Redeploy" to get latest changes

---

## 📊 **VERIFICATION STEPS**

### **1. API Health Check**
```bash
curl https://waitnot-restaurant.onrender.com/health
```
**Expected**: `{"status":"OK",...}`

### **2. CORS Test**
```bash
curl -X OPTIONS "https://waitnot-restaurant.onrender.com/api/restaurants" \
  -H "Origin: https://waitnot-restaurant-app.vercel.app" \
  -H "Access-Control-Request-Method: GET"
```
**Expected**: No CORS errors, proper headers returned

### **3. Frontend Test**
1. Open: https://waitnot-restaurant-app.vercel.app
2. Should load restaurant page (not "Loading...")
3. Test QR code: https://waitnot-restaurant-app.vercel.app/qr/[restaurant-id]/[table]

### **4. Full Flow Test**
1. Scan QR code with phone
2. Should load menu page
3. Add items to cart
4. Place order
5. Check restaurant dashboard for new order

---

## 🎯 **SUCCESS INDICATORS**

- ✅ Vercel app loads without "Loading..." screen
- ✅ No CORS errors in browser console
- ✅ API requests successful (check Network tab)
- ✅ QR codes work from phone
- ✅ Orders can be placed and received
- ✅ Restaurant dashboard shows real data

---

## 📞 **SUPPORT**

### **If Issue Persists:**
1. **Check Render Logs**: Look for CORS or database errors
2. **Check Vercel Logs**: Look for build or runtime errors  
3. **Test API Directly**: Use curl or Postman to test endpoints
4. **Browser Dev Tools**: Check console and network tabs for errors

### **Emergency Rollback:**
If the fix breaks something:
```bash
git revert HEAD
git push origin main
```

---

*This fix should resolve the Vercel deployment issue and make your app work on the domain!*