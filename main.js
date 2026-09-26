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

      // ── Real-time order polling (fallback if socket still fails) ──────────
      // Polls every 3s from Node.js (no CORS), dispatches results to renderer
      const https = require('https');
      let lastOrders = '';
      let pollActive = false;

      setInterval(() => {
        if (pollActive) return;
        mainWindow.webContents.executeJavaScript(`
          (function() {
            try {
              const hash = window.location.hash || '';
              if (!hash.includes('staff-dashboard')) return null;
              const sd = localStorage.getItem('staffData');
              const tk = localStorage.getItem('staffToken');
              if (!sd || !tk) return null;
              const rid = JSON.parse(sd).restaurant_id;
              // Also grab restaurant data for auto-print bills
              const rd = localStorage.getItem('restaurantData');
              return rid ? { rid, tk, rd: rd ? JSON.parse(rd) : null } : null;
            } catch(e) { return null; }
          })()
        `).then((info) => {
          if (!info) return;
          const { rid, tk, rd } = info;

          // Cache restaurant data so auto-print bill can use the name
          if (rd && rd.name) store.set('restaurantData', rd);
          pollActive = true;

          const req = https.request({
            hostname: 'waitnot-restaurant.onrender.com',
            path: `/api/orders/restaurant/${rid}?status=active`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tk}` },
            rejectUnauthorized: false,
          }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
              pollActive = false;
              if (!body || body === lastOrders) return;
              lastOrders = body;
              // Inject updated orders into renderer
              const safe = body.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
              mainWindow.webContents.executeJavaScript(`
                (function() {
                  try {
                    const orders = JSON.parse(\`${safe}\`);
                    if (Array.isArray(orders)) {
                      window.dispatchEvent(new CustomEvent('__waitnot_orders__', { detail: orders }));
                    }
                  } catch(e) {}
                })()
              `).catch(() => {});
            });
          });
          req.on('error', () => { pollActive = false; });
          req.end();
        }).catch(() => { pollActive = false; });
      }, 3000);

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

// ─── Real-time order polling + Auto-print ────────────────────────────────────
const https = require('https');
let lastOrdersBody   = '';
let pollActive       = false;
const knownOrderIds  = new Set();  // all seen active order IDs
const printedKotIds  = new Set();  // KOTs already printed
const printedBillIds = new Set();  // Bills already printed
let pollingStarted   = false;      // skip printing on first poll (existing orders)

// Generic Node HTTPS GET → parsed JSON
function nodeGet(path, token) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'waitnot-restaurant.onrender.com',
      path,
      method: 'GET',
      headers: { Accept: 'application/json' },
      rejectUnauthorized: false,
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end',  () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function startOrderPolling() {
  console.log('🔄 Order polling started — checking every 3s');
  setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (pollActive) return;
    pollActive = true;

    try {
      // Pull session info from renderer localStorage
      const info = await mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            const sd = localStorage.getItem('staffData');
            const tk = localStorage.getItem('staffToken');
            if (!sd || !tk) return null;
            const staff = JSON.parse(sd);
            if (!staff.restaurant_id) return null;
            const rd = localStorage.getItem('restaurantData');
            return { rid: staff.restaurant_id, tk, rname: rd ? JSON.parse(rd).name : null };
          } catch(e) { return null; }
        })()
      `).catch(() => null);

      if (!info || !info.rid) {
        pollActive = false;
        return; // Not logged in yet
      }

      const { rid, tk } = info;
      const restaurantName = info.rname || store.get('restaurantName', 'Restaurant');
      if (info.rname) store.set('restaurantName', info.rname);

      // ── Fetch active orders ────────────────────────────────────────────────
      const activeOrders = await nodeGet(
        `/api/orders/restaurant/${rid}?status=active`, tk
      );
      if (!Array.isArray(activeOrders)) {
        pollActive = false;
        return;
      }

      const body = JSON.stringify(activeOrders);
      const changed = body !== lastOrdersBody;
      lastOrdersBody = body;

      // Push to renderer for UI refresh
      if (changed) {
        const safe = body.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$\{/g,'\\${');
        mainWindow.webContents.executeJavaScript(`
          (function(){
            try{
              const orders = JSON.parse(\`${safe}\`);
              if(!Array.isArray(orders)) return;

              // Method 1: Direct React state update (most reliable)
              if(typeof window.__wn_setOrders === 'function'){
                window.__wn_setOrders(orders);
                return;
              }

              // Method 2: Call React's own refetch
              if(typeof window.__wn_refreshOrders === 'function'){
                window.__wn_refreshOrders();
                return;
              }

              // Method 3: socket callbacks
              if(window.__wn_sock){
                const cbs = (window.__wn_sock._callbacks||{})['$order-updated']||[];
                if(cbs.length > 0){
                  orders.forEach(o => cbs.forEach(h=>{try{h(o)}catch(e){}}));
                  return;
                }
              }

              // Method 4: XHR injection
              const sd = localStorage.getItem('staffData');
              const rid = sd ? JSON.parse(sd).restaurant_id : null;
              if(rid){
                window.__wn_inject_orders = orders;
                window.__wn_inject_rid = rid;
              }
              document.dispatchEvent(new Event('visibilitychange'));
              window.dispatchEvent(new CustomEvent('__waitnot_orders__', {detail: orders}));
            }catch(e){}
          })()
        `).catch(() => {});
      }

      // ── Auto-print KOT for NEW orders ──────────────────────────────────────
      const autoKot = store.get('autoKot', false);
      if (autoKot) {
        const printer = store.get('kitchenPrinter','') || store.get('selectedPrinter','')
                     || await autoDetectThermalPrinter(mainWindow);

        for (const order of activeOrders) {
          if (!order._id) continue;
          if (printedKotIds.has(order._id)) continue;

          // Use order creation time to decide if it's new
          // Print KOT if order was created within the last 60 seconds
          const createdAt = new Date(order.createdAt || Date.now()).getTime();
          const ageSeconds = (Date.now() - createdAt) / 1000;
          const isRecent = ageSeconds <= 60;

          // Always track order ID
          const wasKnown = knownOrderIds.has(order._id);
          knownOrderIds.add(order._id);

          // Skip if we've seen it before OR it's older than 60 seconds
          if (wasKnown || !isRecent) continue;

          // New recent order — print KOT
          printedKotIds.add(order._id);
          console.log(`🖨️ Auto-KOT → "${printer}" | #${order.orderNumber} T${order.tableNumber} (${ageSeconds.toFixed(0)}s old)`);

          const kotData = {
            restaurantName,
            orderId        : (order._id || '').slice(-8).toUpperCase(),
            tableNumber    : order.tableNumber,
            roomNumber     : order.roomNumber,
            orderType      : order.orderType || 'dine-in',
            customerName   : order.customerName,
            deliveryAddress: order.deliveryAddress,
            items          : order.items || [],
            time           : new Date().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}),
          };

          printKOT(kotData, printer)
            .then(r  => console.log(r && r.success ? `✅ KOT #${order.orderNumber}` : `⚠ KOT fail: ${JSON.stringify(r)}`))
            .catch(e => console.error('KOT error:', e.message));
        }
      } else {
        activeOrders.forEach(o => o._id && knownOrderIds.add(o._id));
      }

      pollingStarted = true;

      // ── Auto-print Bill for recently COMPLETED orders ──────────────────────
      const autoBill = store.get('autoBill', false);
      if (autoBill) {
        const printer = store.get('billPrinter','') || store.get('selectedPrinter','')
                     || await autoDetectThermalPrinter(mainWindow);

        const completedOrders = await nodeGet(
          `/api/orders/restaurant/${rid}?status=completed&limit=20`, tk
        );

        if (Array.isArray(completedOrders)) {
          for (const order of completedOrders) {
            if (!order._id) continue;
            if (printedBillIds.has(order._id)) continue;

            // Only print if completed within the last 30 seconds
            const updatedAt  = new Date(order.updatedAt || order.createdAt).getTime();
            const ageSec     = (Date.now() - updatedAt) / 1000;
            if (ageSec > 30) continue;

            printedBillIds.add(order._id);
            console.log(`🖨️ Auto-Bill → "${printer}" | #${order.orderNumber} (${ageSec.toFixed(0)}s ago)`);

            const slotLabel = order.roomNumber ? `Room ${order.roomNumber}`
                            : order.tableNumber ? `Table ${order.tableNumber}` : '';
            const items = (order.items || []).map(i => ({
              name : i.name,
              qty  : i.quantity,
              price: parseFloat(i.price) || 0,
            }));
            const total = items.reduce((s, i) => s + i.price * i.qty, 0);
            const now   = new Date();

            const billData = {
              restaurantName,
              tableLabel    : slotLabel,
              items,
              total,
              paymentMethod : (order.paymentMethod || 'CASH').toUpperCase(),
              time          : now.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}),
              date          : now.toLocaleDateString('en-IN'),
              footerText    : 'Thank you! Please Visit Again',
            };

            printBill(billData, printer)
              .then(r  => console.log(r && r.success ? `✅ Bill #${order.orderNumber}` : `⚠ Bill fail: ${JSON.stringify(r)}`))
              .catch(e => console.error('Bill error:', e.message));
          }
        }
      }

    } catch (e) {
      console.error('Polling error:', e.message);
    } finally {
      pollActive = false;
    }
  }, 3000);
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

// ─── Auto-print KOT ──────────────────────────────────────────────────────────
// Called by preload after POST /api/orders succeeds.
// Checks autoKot setting → builds ESC/POS KOT → sends to kitchenPrinter.
ipcMain.handle('auto-print-kot', async (event, { order }) => {
  try {
    if (!store.get('autoKot', false)) return { skipped: true }; // feature off

    const printerName = store.get('kitchenPrinter', '') || store.get('selectedPrinter', '')
                     || await autoDetectThermalPrinter(mainWindow);
    if (!printerName) return { skipped: true, reason: 'no printer' };

    if (!order || !order._id) return { skipped: true, reason: 'no order data' };

    console.log(`🖨️ Auto-KOT → "${printerName}" | order #${order.orderNumber}`);

    const data = {
      restaurantName : order.restaurantName || 'Restaurant',
      orderId        : order._id.slice(-8).toUpperCase(),
      tableNumber    : order.tableNumber,
      roomNumber     : order.roomNumber,
      orderType      : order.orderType || 'dine-in',
      customerName   : order.customerName,
      deliveryAddress: order.deliveryAddress,
      items          : order.items || [],
      time           : new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }),
    };

    // Enrich with restaurant name from cached data if not present
    if (!data.restaurantName || data.restaurantName === 'Restaurant') {
      try {
        const rd = store.get('restaurantData', null);
        if (rd && rd.name) data.restaurantName = rd.name;
      } catch {}
    }

    return await printKOT(data, printerName);
  } catch (e) {
    console.error('auto-print-kot error:', e.message);
    return { success: false, error: e.message };
  }
});

// ─── Auto-print Bill ─────────────────────────────────────────────────────────
// Called by preload after POST /api/orders/batch-update succeeds.
// Fetches the full order data, builds ESC/POS bill, sends to billPrinter.
ipcMain.handle('auto-print-bill', async (event, { orderIds }) => {
  try {
    if (!store.get('autoBill', false)) return { skipped: true }; // feature off
    if (!orderIds || orderIds.length === 0) return { skipped: true, reason: 'no orderIds' };

    const printerName = store.get('billPrinter', '') || store.get('selectedPrinter', '')
                     || await autoDetectThermalPrinter(mainWindow);
    if (!printerName) return { skipped: true, reason: 'no printer' };

    console.log(`🖨️ Auto-Bill → "${printerName}" | orders: ${orderIds.join(',')}`);

    // Fetch order details from server
    const firstId = orderIds[0];
    const orderData = await new Promise((resolve) => {
      const req = https.request({
        hostname: 'waitnot-restaurant.onrender.com',
        path: `/api/orders/${firstId}`,
        method: 'GET',
        rejectUnauthorized: false,
      }, (res) => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(5000, () => { req.destroy(); resolve(null); });
      req.end();
    });

    if (!orderData) return { success: false, error: 'Could not fetch order' };

    // If multiple orders on table, fetch all and combine items
    let allOrders = [orderData];
    if (orderIds.length > 1) {
      const extras = await Promise.all(
        orderIds.slice(1).map(id => new Promise((resolve) => {
          const req = https.request({
            hostname: 'waitnot-restaurant.onrender.com',
            path: `/api/orders/${id}`,
            method: 'GET',
            rejectUnauthorized: false,
          }, (res) => {
            let body = '';
            res.on('data', c => { body += c; });
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
          });
          req.on('error', () => resolve(null));
          req.setTimeout(5000, () => { req.destroy(); resolve(null); });
          req.end();
        }))
      );
      allOrders = [orderData, ...extras.filter(Boolean)];
    }

    // Merge all items from all orders
    const allItems = allOrders.flatMap(o => (o.items || []).map(i => ({
      name  : i.name,
      qty   : i.quantity,
      price : parseFloat(i.price) || 0,
    })));
    const total = allItems.filter(i => !i.complimentary)
                          .reduce((s, i) => s + i.price * i.qty, 0);

    // Enrich restaurant name
    let restaurantName = orderData.restaurantName || '';
    if (!restaurantName) {
      try {
        const rd = store.get('restaurantData', null);
        if (rd && rd.name) restaurantName = rd.name;
      } catch {}
    }
    if (!restaurantName) restaurantName = 'Restaurant';

    const slotLabel = orderData.roomNumber
      ? `Room ${orderData.roomNumber}`
      : orderData.tableNumber ? `Table ${orderData.tableNumber}` : '';

    const now  = new Date();
    const data = {
      restaurantName,
      tableLabel    : slotLabel,
      items         : allItems,
      total,
      paymentMethod : orderData.paymentMethod || 'CASH',
      time          : now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }),
      date          : now.toLocaleDateString('en-IN'),
      footerText    : 'Thank you! Please Visit Again',
    };

    return await printBill(data, printerName);
  } catch (e) {
    console.error('auto-print-bill error:', e.message);
    return { success: false, error: e.message };
  }
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