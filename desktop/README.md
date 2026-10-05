# WaitNot Restaurant — Desktop App

Electron wrapper around the existing WaitNot web application.

## Architecture

```
waitnot-restaurant/
├── server/          ← Existing Express backend (unchanged)
├── client/          ← Existing React frontend (unchanged)
└── desktop/         ← Electron wrapper (new, isolated)
    ├── main/
    │   ├── main.js           — Electron entry, window management
    │   └── server-manager.js — Spawns existing Node server as child process
    ├── preload/
    │   └── preload.js        — Secure IPC bridge (contextBridge)
    ├── printing/
    │   ├── print-handler.js  — IPC handlers for all print operations
    │   └── escpos-builder.js — Thermal receipt HTML generator
    ├── assets/               — App icons (see assets/README.md)
    ├── electron-builder.json — Build configuration
    └── package.json          — Desktop-only dependencies
```

## How it works

1. Electron starts and spawns the **existing** `server/server.js` as a child process on a free port.
2. A `BrowserWindow` loads `http://localhost:<port>` — the existing React app.
3. A secure `preload.js` exposes `window.electronAPI` with printing and settings APIs.
4. The existing `qzPrint.js` already checks `window.electronAPI?.silentPrint` and routes to it — **no web app changes needed**.

## Development

```bash
# From project root — runs web + desktop simultaneously
npm run desktop:dev
```

This starts:
- Node server on port 5001
- Vite dev server on port 3000  
- Electron loading http://localhost:3000

## Build

```bash
# Build client first, then package desktop
npm run desktop:build        # current platform
npm run desktop:build:win    # Windows installer
npm run desktop:build:mac    # macOS DMG
```

Output goes to `dist-desktop/`.

## Silent Printing

The desktop app prints without showing any print dialog by:
1. Creating a hidden `BrowserWindow`
2. Loading the receipt HTML
3. Calling `webContents.print({ silent: true, deviceName: printerName })`

Printer name is read from `localStorage` settings (`printer_settings_<restaurantId>`),
the same settings used by the web version for QZ Tray / Bluetooth.

## Adding printer settings

Open **Settings → Printer Settings** in the app.
- Set **Kitchen Printer** name (for KOT)
- Set **Bill Printer** name (for customer receipt)

Printer names must match exactly what Windows/macOS shows in the OS printer list.

## Web version

The web version (`npm run dev`) is completely unaffected.
`window.electronAPI` is `undefined` in a browser, so `qzPrint.js` falls back to
QZ Tray → Bluetooth → browser `window.print()` automatically.
