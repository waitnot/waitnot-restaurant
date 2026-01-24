# WaitNot Desktop Access Guide

## 🖥️ Desktop Shortcuts Created

### 1. **WaitNot Restaurant System** 📱
- **File**: `WaitNot-Launcher.bat`
- **Purpose**: Main launcher for the complete system
- **What it does**:
  - Starts both server and client
  - Opens the main website in your browser
  - Shows all login credentials
- **Use when**: Starting WaitNot for the first time or full system launch

### 2. **WaitNot Admin Panel** 👨‍💼
- **File**: `WaitNot-Admin.bat`
- **Purpose**: Direct access to admin dashboard
- **What it does**:
  - Checks if servers are running (starts them if needed)
  - Opens admin login page directly
  - Shows admin credentials
- **Use when**: Managing restaurants, toggling QR ordering, system administration

### 3. **WaitNot Restaurant** 🏪
- **File**: `WaitNot-Restaurant.bat`
- **Purpose**: Direct access to restaurant dashboard
- **What it does**:
  - Checks if servers are running (starts them if needed)
  - Opens restaurant login page directly
  - Shows restaurant credentials
- **Use when**: Managing menu, viewing orders, restaurant operations

### 4. **WaitNot QR Test** 📱
- **File**: `WaitNot-QR-Test.bat`
- **Purpose**: Test QR ordering functionality
- **What it does**:
  - Opens QR ordering page for Hotel King, Table 1
  - Perfect for testing customer experience
  - Shows testing instructions
- **Use when**: Testing QR ordering, demonstrating to clients

### 5. **WaitNot Stop** 🛑
- **File**: `WaitNot-Stop.bat`
- **Purpose**: Stop all WaitNot services
- **What it does**:
  - Stops all Node.js processes
  - Closes server and client windows
  - Frees up system resources
- **Use when**: Finished using WaitNot, need to free resources

## 🚀 Quick Start Instructions

### First Time Setup
1. **Run**: `Create-Desktop-Shortcuts.bat`
2. **Result**: 5 shortcuts created on your desktop
3. **Ready**: Click any shortcut to start using WaitNot

### Daily Usage

#### For System Administration
1. **Double-click**: "WaitNot Admin Panel" on desktop
2. **Login**: admin / admin123
3. **Manage**: Restaurants, QR ordering control, system settings

#### For Restaurant Management
1. **Double-click**: "WaitNot Restaurant" on desktop
2. **Login**: king@gmail.com / password123
3. **Manage**: Menu items, orders, restaurant settings

#### For Testing/Demo
1. **Double-click**: "WaitNot QR Test" on desktop
2. **Test**: Customer ordering experience
3. **Demo**: Show clients how QR ordering works

#### When Finished
1. **Double-click**: "WaitNot Stop" on desktop
2. **Result**: All services stopped, resources freed

## 🌐 Application URLs

### Main URLs
- **Website**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin-login
- **Restaurant Dashboard**: http://localhost:3000/restaurant-login

### QR Ordering URLs
- **Hotel King Table 1**: http://localhost:3000/qr-order/3a0d1b05-6ace-4a0c-8625-20e618740534/1
- **Hotel King Table 2**: http://localhost:3000/qr-order/3a0d1b05-6ace-4a0c-8625-20e618740534/2
- **Hotel King Table 3**: http://localhost:3000/qr-order/3a0d1b05-6ace-4a0c-8625-20e618740534/3

## 🔐 Login Credentials

### Admin Access
- **Username**: admin
- **Password**: admin123
- **Permissions**: Full system control, restaurant management, QR ordering control

### Restaurant Access
- **Email**: king@gmail.com
- **Password**: password123
- **Restaurant**: Hotel King
- **Permissions**: Menu management, order viewing, restaurant settings

## 🎯 Key Features Available

### Admin Features
- ✅ Restaurant management (create, edit, view)
- ✅ QR ordering control (enable/disable per restaurant)
- ✅ System analytics and reporting
- ✅ User management
- ✅ Feature toggles

### Restaurant Features
- ✅ Digital menu management
- ✅ Order management and tracking
- ✅ QR code generation for tables
- ✅ Payment settings (UPI/Cash)
- ✅ Analytics and reports
- ✅ Profile and settings management

### Customer Features (QR Ordering)
- ✅ Scan QR code to access menu
- ✅ Browse menu by categories
- ✅ Add items to cart
- ✅ Multiple payment options (UPI/Cash)
- ✅ Order tracking
- ✅ Contactless ordering experience

## 📊 Google Analytics Tracking

### What's Being Tracked
- **Marketing Website**: Page views, pricing plan clicks, WhatsApp interactions
- **QR Ordering**: Menu interactions, cart additions, order completions
- **Admin Actions**: Feature toggles, restaurant management
- **User Journey**: Complete customer and admin experience

### Analytics ID
- **Tracking ID**: G-735FX9347D
- **Real-time Data**: Available in Google Analytics dashboard

## 🛠️ Troubleshooting

### If Shortcuts Don't Work
1. **Right-click** shortcut → Properties
2. **Check**: "Start in" field should point to WaitNot folder
3. **Fix**: Update path to your WaitNot installation directory

### If Servers Don't Start
1. **Check**: Node.js is installed
2. **Check**: npm dependencies installed (`npm install` in both server and client folders)
3. **Check**: Database connection (should connect to Neon PostgreSQL)

### If Browser Doesn't Open
1. **Manual**: Open browser and go to http://localhost:3000
2. **Check**: Windows firewall isn't blocking localhost
3. **Alternative**: Use different browser

### If Database Issues
1. **Check**: Internet connection (uses Neon PostgreSQL cloud database)
2. **Check**: Database credentials in environment variables
3. **Restart**: Stop and restart the server

## 💡 Pro Tips

### For Demonstrations
1. **Use**: "WaitNot QR Test" for quick customer experience demo
2. **Show**: Admin panel QR ordering control in real-time
3. **Highlight**: Professional "Contact Admin" message when QR ordering disabled

### For Development
1. **Use**: "WaitNot Restaurant System" for full development environment
2. **Monitor**: Server and client console windows for debugging
3. **Test**: All features using provided credentials

### For Production
1. **Deploy**: Code to production server (Render, Vercel, etc.)
2. **Update**: Database connection for production environment
3. **Configure**: Domain name and SSL certificate

## 🎉 Success Indicators

### System Running Successfully
- ✅ Server console shows "Server running on port 5000"
- ✅ Client console shows "Local: http://localhost:3000/"
- ✅ Browser opens WaitNot website automatically
- ✅ All login pages accessible

### Features Working
- ✅ Admin can toggle QR ordering (green/red buttons)
- ✅ QR ordering shows "Contact Admin" when disabled
- ✅ Restaurant dashboard loads with menu items
- ✅ QR ordering allows adding items to cart and placing orders

### Analytics Active
- ✅ Google Analytics Real-Time shows active users
- ✅ Page views tracked on navigation
- ✅ Custom events tracked on interactions
- ✅ E-commerce data tracked on orders

---

**Enjoy using WaitNot Restaurant Management System!** 🚀

For support or questions, refer to the documentation files or check the console outputs for debugging information.