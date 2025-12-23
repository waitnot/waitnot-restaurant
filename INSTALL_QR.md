# Install QR Code Library

## The QR tab is blank because the QR code library isn't installed yet.

### Quick Fix:

**Option 1: Install the library (Recommended)**

Open PowerShell as Administrator and run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then install the package:
```bash
cd client
npm install qrcode.react
```

**Option 2: Use CMD instead of PowerShell**

Open Command Prompt (CMD) and run:
```bash
cd client
npm install qrcode.react
```

**Option 3: Use the fallback (temporary)**

The code below uses a fallback that doesn't require the library.

### After Installation:

1. Restart the development server:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

2. Refresh the browser

3. Go to QR Codes tab - should now show QR codes

### Verify Installation:

```bash
cd client
npm list qrcode.react
```

Should show:
```
qrcode.react@3.1.0
```

### If Still Not Working:

1. Clear node_modules and reinstall:
   ```bash
   cd client
   rmdir /s /q node_modules
   npm install
   ```

2. Check browser console (F12) for errors

3. Make sure both client and server are running
