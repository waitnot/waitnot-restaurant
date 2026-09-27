const { app, BrowserWindow, Menu, shell, dialog, ipcMain, protocol } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const { listPrinters, printKOT, printBill } = require('./printer');

// Register 'waitnot' as a privileged scheme BEFORE app is ready.
// This gives it the same permissions as https:// — localStorage, cookies,
// fetch, Service Workers, etc. all work correctly.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'waitnot',
    privileges: {
      standard: true,        // enables standard URL parsing (origin, host, pathname)
      secure: true,          // treated as a secure origin (like https)
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    }
  }
]);

// Keep a global reference of the window object
let mainWindow;

// Hide console window in production
if (process.env.NODE_ENV !== 'development') {
  // Hide console window for production builds
  if (process.platform === 'win32') {
    app.commandLine.appendSwitch('disable-logging');
    app.commandLine.appendSwitch('disable-dev-shm-usage');
  }
}

// Enable live reload for development
if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    icon: path.join(__dirname, 'logo.png'), // Set window icon
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false
    },
    show: false, // Don't show until ready
    titleBarStyle: 'default',
    autoHideMenuBar: false
  });

  // Load the built React app locally, but API calls will go to production
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // Development: load from dev server
    const startUrl = 'http://localhost:3000/restaurant-login';
    console.log('Development mode - Loading URL:', startUrl);
    mainWindow.loadURL(startUrl);
  } else {
    // Production: serve via custom protocol so absolute /assets/ paths resolve correctly
    console.log('Production mode - Loading via waitnot:// protocol');

    // Attach listener BEFORE loadURL so we never miss the did-finish-load event
    mainWindow.webContents.once('did-finish-load', () => {
      console.log('✅ Local files loaded successfully via waitnot://');
      // Set initial route — only if no hash already set
      setTimeout(() => {
        mainWindow.webContents.executeJavaScript(`
          if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '') {
            window.location.replace(window.location.href.split('#')[0] + '#/staff-login');
          }
        `).catch(() => {});
      }, 500);
    });

    // ── Fix Socket.IO origin ────────────────────────────────────────────────
    // The bundle uses io("") which connects to waitnot://app — patch it.
    // We inject this on every page load via did-navigate.
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.executeJavaScript(`
        (function() {
          if (window.__io_patched) return;
          let attempts = 0;
          const patch = () => {
            if (typeof window.io === 'function' && !window.io.__patched) {
              const orig = window.io;
              window.io = function(url, opts) {
                const target = (!url || url === '' || url === '/') ? 'https://waitnot-restaurant.onrender.com' : url;
                return orig(target, opts);
              };
              Object.assign(window.io, orig);
              window.io.__patched = true;
              window.__io_patched = true;
              console.log('[WaitNot] Socket.IO patched to correct server');
              return true;
            }
            return false;
          };
          if (!patch()) {
            const t = setInterval(() => { if (patch() || ++attempts > 100) clearInterval(t); }, 50);
          }
        })()
      `).catch(() => {});
    });

    mainWindow.loadURL('waitnot://app/index.html').catch((error) => {
      console.error('❌ waitnot:// failed, trying loadFile fallback:', error);
      const indexPath = path.join(app.getAppPath(), 'renderer', 'index.html');
      mainWindow.webContents.once('did-finish-load', () => {
        setTimeout(() => {
          mainWindow.webContents.executeJavaScript(`
            if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '') {
              window.location.replace(window.location.href.split('#')[0] + '#/staff-login');
            }
          `).catch(() => {});
        }, 500);
      });
      mainWindow.loadFile(indexPath).catch(err => {
        console.error('❌ loadFile also failed:', err);
        mainWindow.loadFile(path.join(app.getAppPath(), 'fallback.html'));
      });
    });
  }

  // Remove the timeout fallback — the waitnot:// protocol handles loading reliably
  // const loadTimeout = setTimeout(...)  <-- removed

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('Window ready and shown');
  });

  // Only redirect to fallback if the MAIN document fails — not sub-resources (fonts/chunks)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('did-fail-load:', errorCode, errorDescription, validatedURL);
    // Ignore sub-resource failures (fonts, lazy JS chunks) — only act on the main frame
    if (errorCode === -3) return; // ERR_ABORTED — navigation was cancelled, not a real error
    if (validatedURL && !validatedURL.endsWith('index.html') && !validatedURL.endsWith('/')) return;
    console.log('Main frame failed — ignoring (all assets are local)');
  });

  // Handle navigation errors
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent navigation to external sites
  // Handle external link clicks — open in browser, not in the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Only block actual cross-origin navigations (e.g. if a link opens a new page)
  // Do NOT intercept hash-based React Router navigation — HashRouter handles it internally
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      const currentUrl = new URL(mainWindow.webContents.getURL());

      // Allow same-origin navigation (waitnot://app/index.html stays allowed)
      if (parsed.origin === currentUrl.origin) return;

      // Block all cross-origin navigations — open externally
      event.preventDefault();
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(navigationUrl);
      }
    } catch (e) {
      event.preventDefault();
    }
  });

  // Handle app updates
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Refresh',
          accelerator: 'CmdOrCtrl+R',
          click: () => { if (mainWindow) mainWindow.reload(); }
        },
        {
          label: 'Force Refresh',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => { if (mainWindow) mainWindow.webContents.reloadIgnoringCache(); }
        },
        { type: 'separator' },
        {
          label: '🖨️  Printer Settings',
          accelerator: 'CmdOrCtrl+P',
          click: () => openPrinterSettingsWindow()
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomLevel();
              mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
            }
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomLevel();
              mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
            }
          }
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.setZoomLevel(0);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About WaitNot Restaurant',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About WaitNot Staff',
              message: 'WaitNot Staff Dashboard',
              detail: `Version: ${app.getVersion()}\n\nA complete staff management solution with:\n• Order Management\n• Table & Room Service\n• KOT Printing\n• Real-time Notifications\n• And much more!\n\nDeveloped by WaitNot Team`,
              buttons: ['OK']
            });
          }
        },
        {
          label: 'Contact Support',
          click: () => {
            shell.openExternal('https://wa.me/916364039135?text=Hello%2C%20I%20need%20help%20with%20WaitNot%20Restaurant%20App');
          }
        },
        {
          label: 'Visit Website',
          click: () => {
            shell.openExternal('https://your-waitnot-app.onrender.com');
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        {
          label: 'About ' + app.getName(),
          role: 'about'
        },
        { type: 'separator' },
        {
          label: 'Services',
          role: 'services',
          submenu: []
        },
        { type: 'separator' },
        {
          label: 'Hide ' + app.getName(),
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => app.quit()
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── Order polling + Real-time UI sync + Auto-print ─────────────────────────
const https        = require('https');
const knownOrderIds  = new Set();
const printedKotIds  = new Set();
const printedBillIds = new Set();
let   lastOrdersBody = '';

// Node HTTPS GET with timeout — no renderer/CORS involved
function nodeGet(path, token) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'waitnot-restaurant.onrender.com',
      path, method: 'GET',
      headers: Object.assign({ Accept: 'application/json' },
               token ? { Authorization: `Bearer ${token}` } : {}),
      rejectUnauthorized: false,
    }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end',  () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// Execute JS in renderer with a hard timeout — prevents infinite hangs
function safeExecJS(js, ms = 2500) {
  if (!mainWindow || mainWindow.isDestroyed()) return Promise.resolve(null);
  return Promise.race([
    mainWindow.webContents.executeJavaScript(js).catch(() => null),
    new Promise(r => setTimeout(() => r(null), ms)),
  ]);
}

// Push fresh orders array into React state (tries 4 methods)
function pushOrdersToUI(orders) {
  const safe = JSON.stringify(orders)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

  safeExecJS(`(function(){
    try {
      const o = JSON.parse(\`${safe}\`);
      if (!Array.isArray(o)) return;
      // Method 1: direct setOrders (exposed by our bundle patch)
      if (typeof window.__wn_setOrders === 'function') { window.__wn_setOrders(o); return; }
      // Method 2: re-fetch via Me()
      if (typeof window.__wn_refreshOrders === 'function') { window.__wn_refreshOrders(); return; }
      // Method 3: socket callbacks
      if (window.__wn_sock) {
        const cbs = (window.__wn_sock._callbacks || {})['$order-updated'] || [];
        if (cbs.length) { o.forEach(x => cbs.forEach(h => { try { h(x); } catch(e) {} })); return; }
      }
      // Method 4: XHR injection
      const sd = localStorage.getItem('staffData');
      const rid = sd ? JSON.parse(sd).restaurant_id : null;
      if (rid) { window.__wn_inject_orders = o; window.__wn_inject_rid = rid; }
      document.dispatchEvent(new Event('visibilitychange'));
    } catch(e) {}
  })()`);
}

function startOrderPolling() {
  console.log('🔄 Order polling started (3s interval)');
  let running = false;

  setInterval(async () => {
    if (running) return;
    running = true;
    try { await doPoll(); }
    catch(e) { console.error('Poll error:', e.message); }
    finally  { running = false; }
  }, 3000);
}

async function doPoll() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  // Get session credentials from renderer (with timeout — never hangs)
  const info = await safeExecJS(`(function(){
    try {
      const sd = localStorage.getItem('staffData');
      const tk = localStorage.getItem('staffToken');
      if (!sd || !tk) return null;
      const staff = JSON.parse(sd);
      if (!staff.restaurant_id) return null;
      const rd = localStorage.getItem('restaurantData');
      return { rid: staff.restaurant_id, tk, rname: rd ? JSON.parse(rd).name : null };
    } catch(e) { return null; }
  })()`);

  if (!info || !info.rid) return;  // not logged in yet — running=false in finally

  const { rid, tk } = info;
  const restaurantName = info.rname || store.get('restaurantName', 'Restaurant');
  if (info.rname) store.set('restaurantName', info.rname);

  // Fetch active orders via Node (bypasses CORS, no browser involved)
  const activeOrders = await nodeGet(`/api/orders/restaurant/${rid}?status=active`, tk);
  if (!Array.isArray(activeOrders)) return;

  const body    = JSON.stringify(activeOrders);
  const changed = body !== lastOrdersBody;
  lastOrdersBody = body;

  // Sync UI — only when on staff-dashboard page
  if (changed) {
    const onDashboard = await safeExecJS(`
      (window.location.hash||'').includes('staff-dashboard')
    `);
    if (onDashboard) {
      console.log(`📦 Orders synced: ${activeOrders.length} active`);
      pushOrdersToUI(activeOrders);
    }
  }

  // ── Auto-print KOT ─────────────────────────────────────────────────────────
  if (store.get('autoKot', false)) {
    const printer = store.get('kitchenPrinter','') || store.get('selectedPrinter','')
                 || await autoDetectThermalPrinter(mainWindow);

    for (const order of activeOrders) {
      if (!order._id || printedKotIds.has(order._id)) continue;
      const age     = (Date.now() - new Date(order.createdAt||0).getTime()) / 1000;
      const wasKnown = knownOrderIds.has(order._id);
      knownOrderIds.add(order._id);
      if (wasKnown || age > 60) continue;

      printedKotIds.add(order._id);
      console.log(`🖨️ KOT → "${printer}" | #${order.orderNumber} T${order.tableNumber} (${age.toFixed(0)}s)`);
      printKOT({
        restaurantName,
        orderId        : (order._id||'').slice(-8).toUpperCase(),
        tableNumber    : order.tableNumber,
        roomNumber     : order.roomNumber,
        orderType      : order.orderType || 'dine-in',
        customerName   : order.customerName,
        deliveryAddress: order.deliveryAddress,
        items          : order.items || [],
        time           : new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),
      }, printer)
        .then(r  => console.log(r?.success ? `✅ KOT #${order.orderNumber}` : `⚠ ${JSON.stringify(r)}`))
        .catch(e => console.error('KOT err:', e.message));
    }
  } else {
    activeOrders.forEach(o => o._id && knownOrderIds.add(o._id));
  }

  // ── Auto-print Bill ────────────────────────────────────────────────────────
  if (store.get('autoBill', false)) {
    const printer = store.get('billPrinter','') || store.get('selectedPrinter','')
                 || await autoDetectThermalPrinter(mainWindow);

    const completed = await nodeGet(`/api/orders/restaurant/${rid}?status=completed`, tk);
    if (!Array.isArray(completed)) return;

    for (const order of completed) {
      if (!order._id || printedBillIds.has(order._id)) continue;
      const age = (Date.now() - new Date(order.updatedAt||order.createdAt||0).getTime()) / 1000;
      if (age > 30) continue;
      printedBillIds.add(order._id);
      console.log(`🖨️ Bill → "${printer}" | #${order.orderNumber} (${age.toFixed(0)}s ago)`);

      const items = (order.items||[]).map(i=>({name:i.name,qty:i.quantity,price:parseFloat(i.price)||0}));
      const total = items.reduce((s,i)=>s+i.price*i.qty, 0);
      const now   = new Date();
      printBill({
        restaurantName,
        tableLabel   : order.roomNumber ? `Room ${order.roomNumber}` : order.tableNumber ? `Table ${order.tableNumber}` : '',
        items, total,
        paymentMethod: (order.paymentMethod||'CASH').toUpperCase(),
        time         : now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),
        date         : now.toLocaleDateString('en-IN'),
        footerText   : 'Thank you! Please Visit Again',
      }, printer)
        .then(r  => console.log(r?.success ? `✅ Bill #${order.orderNumber}` : `⚠ ${JSON.stringify(r)}`))
        .catch(e => console.error('Bill err:', e.message));
    }
  }
}
// App event handlers
app.whenReady().then(() => {
  // ── Intercept all HTTP responses from the backend and inject CORS headers.
  // This runs at the Chromium network layer, so it catches every request made
  // by Axios, fetch, XHR, Socket.IO — regardless of when they initialised.
  const { session } = require('electron');
  const API_ORIGIN = 'https://waitnot-restaurant.onrender.com';

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: [`${API_ORIGIN}/*`] },
    (details, callback) => {
      const headers = { ...details.responseHeaders };
      // Wildcard origin + credentials cannot be combined — use the request origin instead
      const reqOrigin = (details.requestHeaders && (details.requestHeaders['Origin'] || details.requestHeaders['origin'])) || '*';
      headers['Access-Control-Allow-Origin']      = [reqOrigin === '*' ? '*' : reqOrigin];
      headers['Access-Control-Allow-Methods']     = ['GET, POST, PUT, PATCH, DELETE, OPTIONS'];
      headers['Access-Control-Allow-Headers']     = ['Content-Type, Authorization, Accept, X-Requested-With'];
      if (reqOrigin !== '*') {
        headers['Access-Control-Allow-Credentials'] = ['true'];
      }
      // Remove Vary header conflicts
      delete headers['vary'];
      delete headers['Vary'];
      callback({ responseHeaders: headers });
    }
  );

  // Also handle preflight OPTIONS requests — return 200 immediately with CORS headers
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: [`${API_ORIGIN}/*`] },
    (details, callback) => {
      // Remove the Origin header so it looks like a same-origin or server-side request
      const headers = { ...details.requestHeaders };
      delete headers['Origin'];
      delete headers['origin'];
      callback({ requestHeaders: headers });
    }
  );

  // Register 'waitnot://' protocol — serves renderer/ as the root.
  // Uses app.getAppPath() so it works both in dev and inside a packed .asar
  const appRoot = app.getAppPath();
  protocol.registerFileProtocol('waitnot', (request, callback) => {
    try {
      const url = new URL(request.url);
      // url.pathname: /assets/xxx.js  OR  /fonts/xxx.woff2  OR  /index.html etc.
      const filePath = path.join(appRoot, 'renderer', url.pathname);
      callback({ path: filePath });
    } catch (e) {
      callback({ error: -6 });
    }
  });

  // Register custom protocol for local files (legacy, keep for compat)
  protocol.registerFileProtocol('app', (request, callback) => {
    try {
      const url = request.url.substr(6);
      callback({ path: path.join(appRoot, 'renderer', url) });
    } catch(e) { callback({ error: -6 }); }
  });

  // Register custom protocol for local sound files
  protocol.registerFileProtocol('app-sounds', (request, callback) => {
    try {
      const url = request.url.substr(12);
      callback({ path: path.join(appRoot, 'sounds', url) });
    } catch(e) { callback({ error: -6 }); }
  });

  createWindow();
  createMenu();
  startOrderPolling();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available.');
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: 'A new version is available. It will be downloaded in the background.',
    buttons: ['OK']
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available.');
});

autoUpdater.on('error', (err) => {
  console.log('Error in auto-updater. ' + err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  console.log(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded');
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded. The application will restart to apply the update.',
    buttons: ['Restart Now', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

// IPC handlers for renderer process
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

// ─── API Proxy — bypasses CORS by making requests from Node (no Origin header) ─
// The renderer sends { method, url, headers, body } and gets back
// { ok, status, headers, data } — data is a string (JSON or text).
ipcMain.handle('api-request', async (event, { method, url, headers, body }) => {
  const https = require('https');
  const http  = require('http');
  const { URL } = require('url');

  return new Promise((resolve) => {
    try {
      const parsed   = new URL(url);
      const isHttps  = parsed.protocol === 'https:';
      const lib      = isHttps ? https : http;
      const port     = parsed.port || (isHttps ? 443 : 80);

      // Strip browser-side headers that cause CORS pre-flights; let Node send none
      const safeHeaders = {};
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          const lower = k.toLowerCase();
          // Keep auth, content-type, accept — drop origin/referer/host
          if (!['origin','referer','host','sec-fetch-site','sec-fetch-mode',
                'sec-fetch-dest','sec-ch-ua','sec-ch-ua-mobile',
                'sec-ch-ua-platform'].includes(lower)) {
            safeHeaders[k] = v;
          }
        }
      }

      const bodyBuf = body ? Buffer.from(body, 'utf8') : null;
      if (bodyBuf) safeHeaders['Content-Length'] = bodyBuf.length;

      const options = {
        hostname : parsed.hostname,
        port,
        path     : parsed.pathname + parsed.search,
        method   : method || 'GET',
        headers  : safeHeaders,
        rejectUnauthorized: false,   // handle corporate SSL inspection
      };

      const req = lib.request(options, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const data = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok      : res.statusCode >= 200 && res.statusCode < 300,
            status  : res.statusCode,
            headers : res.headers,
            data,
          });
        });
      });

      req.on('error', (err) => {
        resolve({ ok: false, status: 0, headers: {}, data: JSON.stringify({ error: err.message }) });
      });

      if (bodyBuf) req.write(bodyBuf);
      req.end();
    } catch (err) {
      resolve({ ok: false, status: 0, headers: {}, data: JSON.stringify({ error: err.message }) });
    }
  });
});

// ─── ESC/POS silent print — KOT ─────────────────────────────────────────────
// data: { restaurantName, orderId, tableNumber, roomNumber, orderType, items, time }
ipcMain.handle('print-kot', async (event, { data, printerName }) => {
  const target = (printerName && printerName.trim())
    ? printerName.trim()
    : (store.get('kitchenPrinter','') || store.get('selectedPrinter','') || await autoDetectThermalPrinter(mainWindow));
  console.log(`🖨️ KOT → "${target}"`);
  return await printKOT(data, target);
});

// ─── ESC/POS silent print — Bill ────────────────────────────────────────────
// data: { restaurantName, tableLabel, items, total, paymentMethod, time, date, footerText }
ipcMain.handle('print-bill', async (event, { data, printerName }) => {
  const target = (printerName && printerName.trim())
    ? printerName.trim()
    : (store.get('billPrinter','') || store.get('selectedPrinter','') || await autoDetectThermalPrinter(mainWindow));
  console.log(`🖨️ Bill → "${target}"`);
  return await printBill(data, target);
});

// ─── Simple JSON settings store ───────────────────────────────────────────────
// Lazy-initialized after app is ready so app.getPath('userData') works correctly
let _settingsPath = null;
const store = {
  _data: null,
  get _settingsFile() {
    if (!_settingsPath) {
      _settingsPath = path.join(app.getPath('userData'), 'waitnot-settings.json');
    }
    return _settingsPath;
  },
  get data() {
    if (!this._data) {
      try { this._data = JSON.parse(fs.readFileSync(this._settingsFile, 'utf8')); }
      catch { this._data = {}; }
    }
    return this._data;
  },
  get(key, def = '') {
    const v = this.data[key];
    return (v !== undefined && v !== null && v !== '') ? v : def;
  },
  set(key, val) {
    this.data[key] = val;
    try { fs.writeFileSync(this._settingsFile, JSON.stringify(this.data, null, 2)); }
    catch (e) { console.error('store.set error:', e.message); }
  },
};

// Auto-detect first thermal/POS printer from the system
async function autoDetectThermalPrinter(win) {
  try {
    const w = win || mainWindow;
    if (!w || w.isDestroyed()) return '';
    const printers = await w.webContents.getPrintersAsync();
    if (!printers || printers.length === 0) return '';
    // Prefer thermal keywords
    const thermal = printers.find(p =>
      /pos|thermal|receipt|epson|tsp|tm-|bixolon|star|citizen|58|80mm/i.test(p.name)
    );
    const chosen = thermal ? thermal.name : (printers.find(p => p.isDefault) || printers[0]).name;
    // Save it so next time we don't need to detect again
    if (chosen) {
      if (!store.get('kitchenPrinter','')) store.set('kitchenPrinter', chosen);
      if (!store.get('billPrinter',''))    store.set('billPrinter',    chosen);
      if (!store.get('selectedPrinter','')) store.set('selectedPrinter', chosen);
    }
    console.log(`🔍 Auto-detected printer: "${chosen}"`);
    return chosen;
  } catch (e) {
    console.warn('autoDetectThermalPrinter error:', e.message);
    return '';
  }
}

// Save selected printer
ipcMain.handle('set-printer', (event, { printerName, printerType }) => {
  const key = printerType === 'kitchen' ? 'kitchenPrinter'
             : printerType === 'bill'    ? 'billPrinter'
             :                            'selectedPrinter';
  store.set(key, printerName);
  store.set('selectedPrinter', printerName);
  console.log(`💾 Saved ${key}: "${printerName}"`);
  return { success: true };
});

// Get saved printer settings
ipcMain.handle('get-printer-settings', () => ({
  selectedPrinter : store.get('selectedPrinter', ''),
  kitchenPrinter  : store.get('kitchenPrinter',  ''),
  billPrinter     : store.get('billPrinter',     ''),
  autoKot         : store.get('autoKot',  false),
  autoBill        : store.get('autoBill', false),
  paperWidth      : store.get('paperWidth', '80mm'),
}));

// Save all printer settings at once
ipcMain.handle('save-printer-settings', (event, settings) => {
  Object.entries(settings).forEach(([k, v]) => store.set(k, v));
  console.log('💾 Printer settings saved:', settings);
  return { success: true };
});

// Cache restaurant data for use in auto-print bills
ipcMain.handle('cache-restaurant-data', (event, data) => {
  if (data && data.name) store.set('restaurantData', data);
  return { success: true };
});

// Open the printer settings window
ipcMain.handle('open-printer-settings', () => {
  openPrinterSettingsWindow();
  return { success: true };
});

function openPrinterSettingsWindow() {
  const win = new BrowserWindow({
    width: 560,
    height: 680,
    title: 'Printer Settings — WaitNot Staff',
    icon: path.join(app.getAppPath(), 'logo.png'),
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow,
    modal: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(app.getAppPath(), 'preload.js'),
    }
  });
  win.setMenu(null);
  win.loadFile(path.join(app.getAppPath(), 'printer-settings.html'));
}

// ─── Silent print — parses HTML receipt and sends raw ESC/POS to thermal printer ─
ipcMain.handle('silent-print', async (event, { html, printerName }) => {
  const os = require('os');

  console.log(`🖨️ silent-print → printer: "${printerName}"`);

  // ── Step 1: Parse bill data from the HTML ────────────────────────────────
  // The HTML is generated by printTemplates.js — extract data from it
  function parseHtmlReceipt(html) {
    // Extract restaurant name (first big bold div)
    const nameMatch = html.match(/font-size:2[02]px[^>]*>([^<]+)</);
    const restaurantName = nameMatch ? nameMatch[1].trim() : 'RESTAURANT';

    // Detect if KOT or Bill
    const isKOT = html.includes('KITCHEN ORDER TICKET') || html.includes('ITEMS TO PREPARE');

    // Extract slot/table
    const slotMatch = html.match(/SLOT<\/td>[^>]*>[^>]*>([^<]+)</);
    const slotLabel = slotMatch ? slotMatch[1].trim() : '';

    // Extract date/time
    const dateMatch = html.match(/DATE<\/td>[^>]*>[^>]*>([^<]+)</);
    const timeMatch = html.match(/TIME<\/td>[^>]*>[^>]*>([^<]+)</);
    const date = dateMatch ? dateMatch[1].trim() : new Date().toLocaleDateString('en-IN');
    const time = timeMatch ? timeMatch[1].trim() : new Date().toLocaleTimeString('en-IN');

    // Extract payment method
    const payMatch = html.match(/PAYMENT<\/td>[^>]*>[^>]*>([^<]+)</);
    const paymentMethod = payMatch ? payMatch[1].trim() : 'CASH';

    // Extract items from table rows
    const items = [];
    if (isKOT) {
      // KOT: two columns — name | × qty
      const rowRegex = /<tr>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>×\s*(\d+)<\/td>/g;
      let m;
      while ((m = rowRegex.exec(html)) !== null) {
        items.push({ name: m[1].trim(), quantity: parseInt(m[2]) || 1, price: 0 });
      }
    } else {
      // Bill: four columns — name | qty | rate | amt
      const rowRegex = /<tr>\s*<td[^>]*>([^<]+?)<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>(?:COMP|₹([\d.]+))<\/td>\s*<td[^>]*>(?:₹0|₹([\d.]+))<\/td>/g;
      let m;
      while ((m = rowRegex.exec(html)) !== null) {
        const name = m[1].replace(/★COMP/g, '').trim();
        const qty = parseInt(m[2]) || 1;
        const price = parseFloat(m[3]) || 0;
        items.push({ name, quantity: qty, price, qty });
      }
    }

    // Extract total
    const totalMatch = html.match(/TOTAL<\/td>\s*<td[^>]*>₹([\d.]+)/);
    const total = totalMatch ? parseFloat(totalMatch[1]) : 0;

    return { restaurantName, slotLabel, isKOT, items, total, paymentMethod, date, time };
  }

  // ── Step 2: Try ESC/POS raw print first (fastest, most reliable) ─────────
  const { buildKOTBuffer, buildBillBuffer } = require('./printer');

  try {
    const data = parseHtmlReceipt(html);
    console.log(`📋 Parsed: ${data.isKOT ? 'KOT' : 'BILL'} | ${data.items.length} items | ${data.restaurantName}`);

    let buf;
    if (data.isKOT) {
      buf = buildKOTBuffer({
        restaurantName: data.restaurantName,
        orderId: data.slotLabel || 'ORDER',
        tableNumber: data.slotLabel,
        orderType: 'dine-in',
        items: data.items,
        time: data.time,
      });
    } else {
      buf = buildBillBuffer({
        restaurantName: data.restaurantName,
        tableLabel: data.slotLabel,
        items: data.items.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
        total: data.total,
        paymentMethod: data.paymentMethod,
        time: data.time,
        date: data.date,
        footerText: 'Thank you! Please Visit Again',
      });
    }

    // Send raw ESC/POS to printer
    // Priority: 1) passed printerName  2) saved kitchen/bill  3) auto-detect
    const savedPrinter = store.get('selectedPrinter', '');
    const savedKitchen = store.get('kitchenPrinter', '');
    const savedBill    = store.get('billPrinter', '');
    const autoKot      = store.get('autoKot', false);
    const autoBill     = store.get('autoBill', false);

    // Pick the right saved printer based on what we're printing
    const savedForType = data.isKOT ? (savedKitchen || savedPrinter) : (savedBill || savedPrinter);
    const targetPrinter = (printerName && printerName.trim())
      ? printerName.trim()
      : (savedForType || await autoDetectThermalPrinter(mainWindow));
    console.log(`🖨️ Target printer: "${targetPrinter}" (${data.isKOT ? 'KOT' : 'BILL'})`);

    // Write ESC/POS buffer to a temp binary file then send via COPY /B
    const tmpBin = path.join(require('os').tmpdir(), `waitnot-escpos-${Date.now()}.bin`);
    fs.writeFileSync(tmpBin, buf);

    const result = await new Promise((res) => {
      const { exec } = require('child_process');
      const cmd = `COPY /B "${tmpBin}" "${targetPrinter}"`;
      console.log(`🖨️ Running: ${cmd}`);
      exec(cmd, (err, stdout, stderr) => {
        try { fs.unlinkSync(tmpBin); } catch {}
        if (err) {
          console.warn('COPY /B failed:', err.message);
          res({ success: false, error: err.message });
        } else {
          console.log('✅ ESC/POS print sent successfully');
          res({ success: true });
        }
      });
    });

    if (result.success) return result;

    // ESC/POS failed — fall through to HTML print
    console.warn('ESC/POS failed, falling back to HTML print');
  } catch (parseErr) {
    console.warn('Parse/ESC/POS error:', parseErr.message, '— falling back to HTML print');
  }

  // ── Step 3: HTML fallback — write to temp file and print via Electron ─────
  return new Promise((resolve) => {
    const tmpHtml = path.join(os.tmpdir(), `waitnot-bill-${Date.now()}.html`);
    try { fs.writeFileSync(tmpHtml, html, 'utf8'); } catch (e) {
      return resolve({ success: false, error: e.message });
    }

    const printWin = new BrowserWindow({
      show: false, width: 400, height: 800,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    printWin.loadFile(tmpHtml);

    const cleanup = (success, err) => {
      if (!printWin.isDestroyed()) printWin.close();
      try { fs.unlinkSync(tmpHtml); } catch {}
      resolve(success ? { success: true } : { success: false, error: err });
    };

    printWin.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        const target = printerName && printerName.trim() ? printerName.trim() : '';
        if (!target) {
          // No printer configured — try auto-detect before falling back to PDF
          autoDetectThermalPrinter(mainWindow).then(detected => {
            if (detected) {
              printWin.webContents.print({
                silent: true, printBackground: false,
                deviceName: detected,
                margins: { marginType: 'none' },
                pageSize: { width: 58000, height: 500000 },
                scaleFactor: 100, landscape: false, color: false, copies: 1,
              }, (success, errorType) => cleanup(success, errorType));
            } else {
              // Truly no printer — save PDF
              const pdfPath = path.join(os.tmpdir(), `waitnot-bill-${Date.now()}.pdf`);
              printWin.webContents.printToPDF({
                printBackground: false,
                pageSize: { width: 58000, height: 500000 },
                margins: { top: 0, bottom: 0, left: 3, right: 3 },
              }).then(data => {
                fs.writeFileSync(pdfPath, data);
                if (!printWin.isDestroyed()) printWin.close();
                try { fs.unlinkSync(tmpHtml); } catch {}
                shell.openPath(pdfPath);
                resolve({ success: true, pdf: pdfPath });
              }).catch(e => cleanup(false, e.message));
            }
          });
          return;
        }

        printWin.webContents.print({
          silent: true,
          printBackground: false,
          deviceName: target,
          margins: { marginType: 'none' },
          pageSize: { width: 58000, height: 500000 },
          scaleFactor: 100,
          landscape: false,
          color: false,
          copies: 1,
        }, (success, errorType) => cleanup(success, errorType));
      }, 800);
    });

    setTimeout(() => cleanup(false, 'timeout'), 25000);
  });
});

// ─── Get available printers ──────────────────────────────────────────────────
ipcMain.handle('get-printers', async () => {
  return await listPrinters(mainWindow.webContents);
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // In development, ignore certificate errors
  if (process.env.NODE_ENV === 'development') {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});