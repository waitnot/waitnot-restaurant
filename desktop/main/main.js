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

  mainWindow.loadURL(url);

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.warn(`[main] did-fail-load: ${code} ${desc} — retrying...`);
    setTimeout(() => mainWindow.loadURL(url), 1200);
  });

  mainWindow.once('ready-to-show', () => {
    if (loadingWindow) { loadingWindow.destroy(); loadingWindow = null; }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
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
  createLoadingWindow();

  // Register print IPC handlers early
  setupPrintHandlers(ipcMain);

  try {
    serverPort = await startServer();
    console.log(`✅ Embedded server running on port ${serverPort}`);
  } catch (err) {
    console.error('Failed to start embedded server:', err);
    if (loadingWindow) loadingWindow.destroy();
    dialog.showErrorBox('Startup Error', `Could not start the backend server.\n\n${err.message}\n\nMake sure no other instance is running.`);
    app.quit();
    return;
  }

  createMainWindow(serverPort);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow(serverPort);
  });
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => stopServer());
