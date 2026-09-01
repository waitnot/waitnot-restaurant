# WaitNot Restaurant Desktop App

A standalone desktop application for restaurant management built with Electron.

## Features

- 🖥️ **Native Desktop Experience** - Runs as a native Windows/Mac/Linux application
- 🔄 **Auto Updates** - Automatic updates when new versions are available
- 🖨️ **Enhanced Printing** - Better printing support for receipts and kitchen orders
- 📱 **Offline Indicators** - Shows connection status and handles offline scenarios
- 🎨 **Desktop Optimized UI** - Optimized interface for desktop usage
- 🔐 **Secure** - Sandboxed environment with security best practices

## Building the Application

### Prerequisites

1. **Node.js** (v16 or higher) - Download from [nodejs.org](https://nodejs.org/)
2. **Git** - For version control

### Quick Build (Windows)

1. **Run the build script**:
   ```cmd
   build-exe.bat
   ```

2. **Find your executable**:
   - Installer: `dist/WaitNot Restaurant Setup.exe`
   - Portable: `dist/win-unpacked/WaitNot Restaurant.exe`

### Manual Build Process

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build for your platform**:
   ```bash
   # Windows
   npm run build-win
   
   # macOS
   npm run build-mac
   
   # Linux
   npm run build-linux
   
   # All platforms
   npm run build
   ```

3. **Development mode**:
   ```bash
   npm start
   ```

## Distribution

### For End Users (Restaurants)

1. **Download the installer** (`WaitNot Restaurant Setup.exe`)
2. **Run the installer** - Creates desktop shortcut and start menu entry
3. **Launch from desktop** - Double-click the WaitNot Restaurant icon
4. **Login with credentials** - Use your restaurant login details

### For Developers

1. **Portable version** - Share the `win-unpacked` folder
2. **Custom installer** - Modify `package.json` build settings
3. **Auto-updates** - Configure update server in `main.js`

## Configuration

### Update Server

Edit `main.js` to configure your update server:

```javascript
// Change this URL to your update server
const startUrl = isDev 
  ? 'http://localhost:3000/restaurant-login'
  : 'https://your-waitnot-app.onrender.com/restaurant-login';
```

### App Icons

Replace the placeholder icons in `assets/` with your actual WaitNot logo:

- `icon.ico` - Windows icon (256x256 recommended)
- `icon.icns` - macOS icon (512x512 recommended)  
- `icon.png` - Linux icon (512x512 recommended)

### Build Settings

Modify `package.json` build configuration:

```json
{
  "build": {
    "appId": "com.waitnot.restaurant",
    "productName": "WaitNot Restaurant",
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    }
  }
}
```

## Features Included

### Core Functionality
- ✅ Restaurant dashboard access
- ✅ Order management
- ✅ Menu management
- ✅ QR code generation
- ✅ Analytics dashboard
- ✅ Kitchen printing
- ✅ Profile management

### Desktop Enhancements
- ✅ Native window controls
- ✅ Keyboard shortcuts
- ✅ System tray integration
- ✅ Auto-start options
- ✅ Offline detection
- ✅ Print optimization
- ✅ Zoom controls
- ✅ Fullscreen mode

### Security Features
- ✅ Context isolation
- ✅ Disabled node integration
- ✅ External link protection
- ✅ Certificate validation
- ✅ Secure preload scripts

## Troubleshooting

### Build Issues

1. **Node.js not found**:
   - Install Node.js from [nodejs.org](https://nodejs.org/)
   - Restart command prompt after installation

2. **Permission errors**:
   - Run command prompt as Administrator
   - Check antivirus software blocking

3. **Missing dependencies**:
   - Delete `node_modules` folder
   - Run `npm install` again

### Runtime Issues

1. **App won't start**:
   - Check if WaitNot server is running
   - Verify internet connection
   - Check Windows Defender/antivirus

2. **Login issues**:
   - Verify server URL in `main.js`
   - Check restaurant credentials
   - Clear app data and restart

3. **Printing problems**:
   - Check printer drivers
   - Verify printer settings in app
   - Test with system print dialog

## File Structure

```
restaurant-app/
├── main.js              # Main Electron process
├── preload.js           # Preload script for security
├── package.json         # App configuration
├── build-exe.bat        # Build script for Windows
├── assets/
│   ├── icon.ico         # Windows icon
│   ├── icon.icns        # macOS icon
│   └── icon.png         # Linux icon
└── dist/                # Build output (created after build)
    ├── WaitNot Restaurant Setup.exe  # Installer
    └── win-unpacked/     # Portable version
```

## Support

- 📞 **WhatsApp Support**: [+91 6364039135](https://wa.me/916364039135)
- 🌐 **Website**: [WaitNot Dashboard](https://your-waitnot-app.onrender.com)
- 📧 **Email**: waitnot.menu.storage@gmail.com

## License

MIT License - See LICENSE file for details.

---

**Built with ❤️ by the WaitNot Team**