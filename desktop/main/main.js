const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');
const { startServer, stopServer } = require('./server-manager');
const { setupPrintHandlers } = require('../printing/print-handler');
const Store = require('electron-store');

const store = new Store();

let mainWindow = null;
let loadingWindow = null;
let serverPort = null;

// ── Loading splash ────────────────────────────────────────────────────────────

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 400,
    height: 320,
    frame: false,
    transparent: false,
    resizable: false,
    center: true,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    backgroundColor: '#ef4444',
  });
  loadingWindow.loadFile(path.join(__dirname, 'loading.html'));
  loadingWindow.on('closed', () => { loadingWindow = null; });
}

// ── Main window ───────────────────────────────────────────────────────────────

function createMainWindow(port) {
  mainWindow = new BrowserWindow({
    width: store.get('windowWidth', 1400),
    height: store.get('windowHeight', 900),
    minWidth: 1024,
    minHeight: 700,
    title: 'WaitNot Restaurant',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
    show: false,
    backgroundColor: '#f3f4f6',
  });

  // Save window size on resize
  mainWindow.on('resize', () => {
    const [w, h] = mainWindow.getSize();
    store.set('windowWidth', w);
    store.set('windowHeight', h);
  });

  buildMenu();

  const url = `http://localhost:${port}`;
  let retryCount = 0;
  const maxRetries = 20; // wait up to ~10s for server to come up

  const tryLoad = () => {
    mainWindow.loadURL(url).catch(() => {
      if (retryCount++ < maxRetries) {
        setTimeout(tryLoad, 500);
      }
    });
  };

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    // Silently retry — server may still be starting
    if (retryCount++ < maxRetries) {
      setTimeout(() => mainWindow?.loadURL(url).catch(() => {}), 500);
    } else {
      console.warn(`[main] Server unavailable after retries (${code}: ${desc}). Running offline.`);
      // Load a minimal offline page so the window still opens
      const offlinePage = `data:text/html,<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f3f4f6;color:#374151}</style></head><body><div style="text-align:center"><div style="font-size:48px;margin-bottom:16px">🔴</div><h2 style="margin:0 0 8px">Offline Mode</h2><p style="color:#6b7280;margin:0 0 20px">Backend server is unavailable.<br>Billing requires a running server.</p><button onclick="location.reload()" style="background:#ef4444;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px">Retry</button></div></body></html>`;
      mainWindow?.loadURL(offlinePage).catch(() => {});
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (loadingWindow) { loadingWindow.destroy(); loadingWindow = null; }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  tryLoad();
}

// ── Application menu ──────────────────────────────────────────────────────────

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    {
      label: 'App',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.reload() },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow?.webContents.reloadIgnoringCache() },
        { type: 'separator' },
        { label: 'Toggle DevTools', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() },
        ...(!isMac ? [{ type: 'separator' }, { label: 'Quit', accelerator: 'Alt+F4', click: () => app.quit() }] : []),
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In',    accelerator: 'CmdOrCtrl+=', click: () => { const wc = mainWindow?.webContents; if (wc) wc.setZoomLevel(wc.getZoomLevel() + 0.5); } },
        { label: 'Zoom Out',   accelerator: 'CmdOrCtrl+-', click: () => { const wc = mainWindow?.webContents; if (wc) wc.setZoomLevel(wc.getZoomLevel() - 0.5); } },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => mainWindow?.webContents.setZoomLevel(0) },
        { type: 'separator' },
        { label: 'Fullscreen', accelerator: 'F11', click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', click: () => mainWindow?.minimize() },
        { label: 'Maximize', click: () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize() },
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC: general ─────────────────────────────────────────────────────────────

ipcMain.handle('get-app-version',  () => app.getVersion());
ipcMain.handle('get-server-port',  () => serverPort);
ipcMain.handle('store-get',    (_e, key)        => store.get(key));
ipcMain.handle('store-set',    (_e, key, value) => { store.set(key, value); return true; });
ipcMain.handle('store-delete', (_e, key)        => { store.delete(key); return true; });
ipcMain.handle('open-external', (_e, url)       => shell.openExternal(url));
ipcMain.handle('show-message',  (_e, opts)      => dialog.showMessageBox(mainWindow, opts));

// ── Lifecycle ─────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Register print IPC handlers early
  setupPrintHandlers(ipcMain);

  // Open the main window immediately — don't block on server startup
  // The server is an optional online service, not a prerequisite
  createLoadingWindow();

  // Start the embedded server in the background
  startServer().then(port => {
    serverPort = port;
    console.log(`✅ Embedded server running on port ${serverPort}`);
    // Notify renderer that online mode is now available
    mainWindow?.webContents.send('server-status', { online: true, port });
  }).catch(err => {
    console.warn('⚠️  Embedded server failed to start — running in offline mode:', err.message);
    // Notify renderer about offline state (non-blocking)
    mainWindow?.webContents.send('server-status', { online: false, error: err.message });
  });

  // Always open the main window, regardless of server state
  // Use port 5001 as default; renderer will handle the case where server isn't ready
  const defaultPort = 5001;
  createMainWindow(defaultPort);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow(serverPort || defaultPort);
  });
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => stopServer());
