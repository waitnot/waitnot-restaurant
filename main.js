const { app, BrowserWindow, Menu, shell, dialog, ipcMain, protocol, net } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const { listPrinters, printKOT, printBill, rawPrintWindows } = require('./printer');
const { buildKOTBytes, buildBillBytes } = require('./escpos-builder');
const offlineDb     = require('./offline-db');
const syncEngine    = require('./sync-engine');
const uploadEngine  = require('./upload-engine');
const remoteConfig  = require('./remote-config');

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
                const target = (!url || url === '' || url === '/') ? remoteConfig.getApiUrl() : url;
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
            hostname: remoteConfig.getApiHost(),
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

  // Handle app updates — silent background check on startup
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.warn('[updater] Startup check failed:', err.message);
      });
    }, 15000); // wait 15s after launch before checking
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
          label: 'Check for Updates',
          click: () => {
            _updateCheckTriggeredByUser = true;
            autoUpdater.checkForUpdates().catch(err => {
              _updateCheckTriggeredByUser = false;
              dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Update Check Failed',
                message: 'Could not check for updates.',
                detail: err.message,
                buttons: ['OK']
              });
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

// Node HTTPS POST with timeout — no renderer/CORS involved
function nodePost(path, body, token) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req  = require('https').request({
      hostname: remoteConfig.getApiHost(),
      path, method: 'POST',
      headers: Object.assign({
        'Content-Type'  : 'application/json',
        'Content-Length': Buffer.byteLength(data),
        Accept          : 'application/json',
      }, token ? { Authorization: `Bearer ${token}` } : {}),
      rejectUnauthorized: false,
    }, (res) => {
      let b = '';
      res.on('data', c => { b += c; });
      res.on('end',  () => { try { resolve({ status: res.statusCode, body: JSON.parse(b) }); } catch { resolve({ status: res.statusCode, body: b }); } });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    req.write(data);
    req.end();
  });
}

// Node HTTPS GET with timeout — no renderer/CORS involved
function nodeGet(path, token) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: remoteConfig.getApiHost(),
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
  console.log('🔄 Order polling started (1.5s interval)');
  let running = false;

  setInterval(async () => {
    if (running) return;
    running = true;
    try { await doPoll(); }
    catch(e) { console.error('Poll error:', e.message); }
    finally  { running = false; }
  }, 1500);
}

async function doPoll(force = false) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  // Get session credentials from renderer (with timeout — never hangs)
  const info = await safeExecJS(`(function(){
    try {
      const sd = localStorage.getItem('staffData');
      const tk = localStorage.getItem('staffToken');
      if (!sd || !tk) return null;
      const staff = JSON.parse(sd);
      if (!staff.restaurant_id) return null;
      // Restaurant name is stored under restaurant_cache_<id> by the dashboard
      const rdCached = localStorage.getItem('restaurant_cache_' + staff.restaurant_id);
      const rdFallback = localStorage.getItem('restaurantData');
      const rd = rdCached || rdFallback;
      const rname = rd ? (JSON.parse(rd).name || null) : null;
      return { rid: staff.restaurant_id, tk, rname, staffEmail: staff.email || null };
    } catch(e) { return null; }
  })()`);

  if (!info || !info.rid) return;  // not logged in yet — running=false in finally

  const { rid, tk } = info;
  const restaurantName = info.rname || store.get('restaurantName', '') || 'Restaurant';
  if (info.rname) store.set('restaurantName', info.rname);

  // Cache staff credentials for offline login (refreshed every poll cycle)
  if (info.staffEmail && tk && offlineDb.isReady()) {
    try {
      const staffRaw = await safeExecJS(`JSON.parse(localStorage.getItem('staffData') || 'null')`);
      if (staffRaw) offlineDb.cacheStaffCredentials(staffRaw, tk);
    } catch {}
  }

  // Fetch active orders via Node (bypasses CORS, no browser involved)
  const activeOrders = await nodeGet(`/api/orders/restaurant/${rid}?status=active`, tk);
  if (!Array.isArray(activeOrders)) return;

  const body = JSON.stringify(activeOrders);
  // Skip UI push if nothing changed — UNLESS force=true (after shift/reconnect)
  if (!force && body === lastOrdersBody) return;
  lastOrdersBody = body;

  // Sync UI — only when on staff-dashboard page
  {
    const onDashboard = await safeExecJS(`
      (window.location.hash||'').includes('staff-dashboard')
    `);
    if (onDashboard) {
      // Merge server orders with pending offline orders so table grid is complete.
      // Include ALL non-uploaded statuses — LOCAL_PENDING (just saved),
      // PENDING_UPLOAD / UPLOAD_FAILED (upload in progress / retry) so the
      // table tile never disappears while the upload is happening.
      const pendingStatuses = ['LOCAL_PENDING', 'LOCAL_CONFIRMED', 'PENDING_UPLOAD', 'UPLOAD_FAILED', 'UPLOAD_UNKNOWN'];
      const offlineOrders = offlineDb.isReady()
        ? offlineDb.getOfflineOrdersByStatuses(rid, pendingStatuses).map(o => {
            const items = offlineDb.getOfflineOrderItems(o.id).map(i => ({
              _id: i.id, name: i.name_snapshot, price: i.price_snapshot,
              quantity: i.quantity, printedToKitchen: false,
            }));
            return {
              _id: o.id, orderNumber: 0, restaurantId: o.restaurant_id,
              tableNumber: o.table_number, roomNumber: o.room_number,
              orderType: o.order_type, customerName: o.customer_name,
              items, total: o.total_amount, totalAmount: o.total_amount,
              status: 'pending', paymentMethod: o.payment_method,
              paymentStatus: 'pending', source: 'staff',
              isOffline: true, createdAt: o.created_at, updatedAt: o.updated_at,
            };
          })
        : [];

      // Dedup: exclude offline orders that already appear on the server.
      // Match by tableNumber + totalAmount + createdAt within 120s
      // (catches the race where upload just finished).
      const pendingOffline = offlineOrders.filter(offlineOrder => {
        const alreadyOnServer = activeOrders.some(serverOrder => {
          const sameTable  = serverOrder.tableNumber === offlineOrder.tableNumber;
          const sameAmount = Math.abs((serverOrder.totalAmount || serverOrder.total || 0) - offlineOrder.totalAmount) < 1;
          const timeDiff   = Math.abs(new Date(serverOrder.createdAt).getTime() - new Date(offlineOrder.createdAt).getTime());
          return sameTable && sameAmount && timeDiff < 120000; // within 2 minutes
        });
        return !alreadyOnServer;
      });

      const merged = [...activeOrders, ...pendingOffline];

      console.log(`📦 Orders synced: ${activeOrders.length} server + ${pendingOffline.length} offline pending`);
      pushOrdersToUI(merged);
      // If __wn_setOrders is not available (nulled after remount), fall back to
      // triggering a React re-fetch so the table grid always stays current.
      safeExecJS(`
        if (typeof window.__wn_setOrders !== 'function' && typeof window.__wn_refreshOrders === 'function') {
          window.__wn_refreshOrders();
        }
      `).catch(() => {});
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
      (async () => {
        const _kotBuf = Buffer.from(buildKOTBytes({
          restaurantName: restaurantName,
          slotLabel     : order.tableNumber ? `Table ${order.tableNumber}` : order.roomNumber ? `Room ${order.roomNumber}` : (order.orderType||'order').toUpperCase(),
          orderId       : (order._id||'').slice(-8).toUpperCase(),
          orderType     : (order.orderType||'dine-in').toLowerCase(),
          customerName  : order.customerName || '',
          deliveryAddress: order.deliveryAddress || null,
          items         : (order.items||[]).map(i => ({ name: i.name, quantity: i.quantity || i.qty || 1 })),
          paperWidth    : store.get('paperWidth', '80mm'),
        }));
        return rawPrintWindows(printer, _kotBuf);
      })()
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
      (async () => {
        const _itemSub   = (order.items||[]).filter(i=>!i.complimentary).reduce((s,i)=>s+(parseFloat(i.price)||0)*(parseInt(i.quantity)||1), 0);
        const _orderTotal = parseFloat(order.totalAmount) || 0;
        const _derivedCharge = Math.max(0, Math.round((_orderTotal - _itemSub) * 100) / 100);
        const _pkgCharge = parseFloat(order.packagingCharge) || (order.orderType==='takeaway' ? _derivedCharge : 0);
        const _delCharge = parseFloat(order.deliveryCharge)  || (order.orderType==='delivery' ? _derivedCharge : 0);
        const _extCharge = (order.orderType==='dine-in'||order.orderType==='room') ? _derivedCharge : 0;
        const _billBuf = Buffer.from(buildBillBytes({
          restaurantName: restaurantName,
          slotLabel     : order.roomNumber ? `Room ${order.roomNumber}` : order.tableNumber ? `Table ${order.tableNumber}` : '',
          orderType     : (order.orderType||'dine-in').toLowerCase(),
          customerName  : order.customerName || '',
          paymentMethod : ((order.paymentMethod||'cash')).toLowerCase(),
          items         : (order.items||[]).map(i => ({
            name         : i.name,
            quantity     : i.quantity || i.qty || 1,
            price        : parseFloat(i.price) || 0,
            complimentary: !!i.complimentary,
          })),
          packagingCharge: _pkgCharge || undefined,
          deliveryCharge : _delCharge || undefined,
          extraCharge    : _extCharge || undefined,
          paperWidth     : store.get('paperWidth', '80mm'),
        }));
        return rawPrintWindows(printer, _billBuf);
      })()
        .then(r  => console.log(r?.success ? `✅ Bill #${order.orderNumber}` : `⚠ ${JSON.stringify(r)}`))
        .catch(e => console.error('Bill err:', e.message));
    }
  }
}

// ─── Orders history instant refresh ─────────────────────────────────────────
// Fetches completed orders from Node (no CORS) every 5s and pushes them into
// the React history tab via window.__wn_setHistory or __wn_refreshHistory.
// Falls back to triggering a React re-fetch if neither hook is available.
let lastHistoryBody = '';

async function pollCompletedOrders() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const info = await safeExecJS(`(function(){
      try {
        const hash = window.location.hash || '';
        if (!hash.includes('staff-dashboard')) return null;
        const sd = localStorage.getItem('staffData');
        const tk = localStorage.getItem('staffToken');
        if (!sd || !tk) return null;
        const rid = JSON.parse(sd).restaurant_id;
        return rid ? { rid, tk } : null;
      } catch { return null; }
    })()`);
    if (!info || !info.rid) return;

    const { rid, tk } = info;

    // Fetch completed orders directly from Node — no CORS, no browser involved
    const completed = await nodeGet(`/api/orders/restaurant/${rid}?status=completed`, tk);
    if (!Array.isArray(completed)) return;

    const body = JSON.stringify(completed);
    if (body === lastHistoryBody) return; // no change
    lastHistoryBody = body;

    const safe = body
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${');

    // Push into renderer: try direct setter first, then trigger React re-fetch
    safeExecJS(`(function(){
      try {
        const orders = JSON.parse(\`${safe}\`);
        if (!Array.isArray(orders)) return;
        // Method 1: direct history setter (if bundle exposes it)
        if (typeof window.__wn_setHistory === 'function') {
          window.__wn_setHistory(orders); return;
        }
        // Method 2: trigger React re-fetch via exposed refresh hook
        if (typeof window.__wn_refreshHistory === 'function') {
          window.__wn_refreshHistory(); return;
        }
        // Method 3: inject into window so React picks it up on next render
        window.__wn_history_cache = orders;
        window.dispatchEvent(new CustomEvent('__waitnot_history__', { detail: orders }));
      } catch(e) {}
    })()`).catch(() => {});

  } catch {}
}

// Run history refresh every 5 seconds
setInterval(() => pollCompletedOrders(), 5000);

// App event handlers

// ─── Node-side connectivity watchdog ────────────────────────────────────────
// The renderer's window.addEventListener('online') doesn't always fire when
// the physical network interface changes in Electron. This Node-side watchdog
// polls every 15s using a lightweight DNS lookup. When it detects a transition
// from offline → online, it triggers the same reconnect flow.
let _wasOnline = true; // assume online at start
function startConnectivityWatchdog() {
  const dns = require('dns');
  setInterval(() => {
    dns.lookup(remoteConfig.getApiHost(), (err) => {
      const isOnline = !err;
      if (isOnline && !_wasOnline) {
        // Just came back online
        console.log('[main] 🌐 Node watchdog: network restored — triggering reconnect flow');
        if (offlineDb.isReady()) offlineDb.resetFailedBackoff();
        uploadEngine.triggerUpload().catch(() => {});
        syncEngine.triggerSync().catch(() => {});
        setTimeout(() => doPoll(true).catch(() => {}), 1000);
      }
      _wasOnline = isOnline;
    });
  }, 15000);
}

app.whenReady().then(async () => {
  // ── Load remote server config first so API_URL is set before anything connects ─
  await remoteConfig.init(app.getPath('userData'));

  // ── Intercept all HTTP responses from the backend and inject CORS headers.
  // This runs at the Chromium network layer, so it catches every request made
  // by Axios, fetch, XHR, Socket.IO — regardless of when they initialised.
  const { session } = require('electron');
  const API_ORIGIN = remoteConfig.getApiUrl();

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
  // mimeType is set explicitly with charset=utf-8 so emoji in JS bundles render correctly.
  const appRoot = app.getAppPath();
  const _mimeMap = {
    '.js'   : 'application/javascript; charset=utf-8',
    '.mjs'  : 'application/javascript; charset=utf-8',
    '.css'  : 'text/css; charset=utf-8',
    '.html' : 'text/html; charset=utf-8',
    '.json' : 'application/json; charset=utf-8',
    '.svg'  : 'image/svg+xml',
    '.png'  : 'image/png',
    '.jpg'  : 'image/jpeg',
    '.ico'  : 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff' : 'font/woff',
    '.ttf'  : 'font/ttf',
    '.wav'  : 'audio/wav',
    '.webmanifest': 'application/manifest+json',
  };
  // Electron 28: use protocol.handle() instead of deprecated registerFileProtocol
  protocol.handle('waitnot', (request) => {
    try {
      const url      = new URL(request.url);
      const filePath = path.join(appRoot, 'renderer', url.pathname);
      const ext      = path.extname(filePath).toLowerCase();
      const mimeType = _mimeMap[ext] || 'application/octet-stream';
      return net.fetch('file://' + filePath.replace(/\\\\/g, '/'));
    } catch (e) {
      return new Response('Not found', { status: 404 });
    }
  });

  // Register custom protocol for local files (legacy, keep for compat)
  protocol.handle('app', (request) => {
    try {
      const url = request.url.substring(6);
      return net.fetch('file://' + path.join(appRoot, 'renderer', url).replace(/\\\\/g, '/'));
    } catch(e) { return new Response('Not found', { status: 404 }); }
  });
    } catch(e) { callback({ error: -6 }); }
  });

  // Register custom protocol for local sound files
  protocol.handle('app-sounds', (request) => {
    try {
      const url = request.url.substring(12);
      return net.fetch('file://' + path.join(appRoot, 'sounds', url).replace(/\\\\/g, '/'));
    } catch(e) { return new Response('Not found', { status: 404 }); }
  });
    } catch(e) { callback({ error: -6 }); }
  });

  createWindow();
  createMenu();
  startOrderPolling();
  startConnectivityWatchdog();

  // ── Offline SQLite database ──────────────────────────────────────────────
  const dbResult = offlineDb.init(app.getPath('userData'));
  if (dbResult.success) {
    console.log(`[offline-db] Initialised at ${dbResult.dbPath}`);
    // Start sync engine — runs initial sync after window loads, then every 5min
    syncEngine.init(offlineDb, mainWindow);
    // Start upload engine — uploads pending offline orders every 30s
    uploadEngine.init(offlineDb, mainWindow);
  } else {
    console.error(`[offline-db] Failed to init: ${dbResult.error} — offline features disabled`);
  }

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    uploadEngine.stop();
    syncEngine.stop();
    offlineDb.close();
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

// ─── Auto-updater ────────────────────────────────────────────────────────────
// autoUpdater is configured via the "publish" block in package.json.
// For portable builds, electron-updater downloads the new exe to a temp dir,
// launches it, and quits the current instance.

autoUpdater.autoDownload    = false;   // only download when user confirms
autoUpdater.autoInstallOnAppQuit = false;

let _updateAvailableInfo    = null;
let _updateCheckTriggeredByUser = false;

autoUpdater.on('checking-for-update', () => {
  console.log('[updater] Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  _updateAvailableInfo = info;
  console.log(`[updater] Update available: v${info.version}`);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: `WaitNot Staff v${info.version} is available`,
    detail: `You are on v${app.getVersion()}.\nDownload and install the update now?`,
    buttons: ['Download & Install', 'Later'],
    defaultId: 0,
    cancelId: 1,
  }).then(({ response }) => {
    if (response === 0) {
      autoUpdater.downloadUpdate();
      // Show a progress window
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`
          (function(){
            if (document.getElementById('__wn_update_bar')) return;
            const bar = document.createElement('div');
            bar.id = '__wn_update_bar';
            bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#1d4ed8;color:#fff;font-size:13px;font-family:sans-serif;padding:8px 16px;text-align:center;';
            bar.textContent = 'Downloading update… 0%';
            document.body.appendChild(bar);
          })()
        `).catch(() => {});
      }
    }
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[updater] Up to date.');
  if (_updateCheckTriggeredByUser) {
    _updateCheckTriggeredByUser = false;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Up to Date',
      message: `You're running the latest version (v${app.getVersion()}).`,
      buttons: ['OK'],
    });
  }
});

autoUpdater.on('error', (err) => {
  console.error('[updater] Error:', err.message);
  if (_updateCheckTriggeredByUser) {
    _updateCheckTriggeredByUser = false;
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Update Check Failed',
      message: 'Could not check for updates.',
      detail: err.message,
      buttons: ['OK'],
    });
  }
});

autoUpdater.on('download-progress', (p) => {
  const pct = Math.round(p.percent);
  const mb  = (p.transferred / 1048576).toFixed(1);
  const tot = (p.total       / 1048576).toFixed(1);
  console.log(`[updater] Downloading… ${pct}% (${mb}/${tot} MB)`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`
      (function(){
        const bar = document.getElementById('__wn_update_bar');
        if (bar) bar.textContent = 'Downloading update… ${pct}% (${mb} / ${tot} MB)';
      })()
    `).catch(() => {});
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[updater] Update downloaded — ready to install');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`
      (function(){
        const bar = document.getElementById('__wn_update_bar');
        if (bar) { bar.style.background='#15803d'; bar.textContent='Update downloaded — restarting…'; }
      })()
    `).catch(() => {});
  }
  setTimeout(() => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `v${info.version} downloaded successfully.`,
      detail: 'The app will now restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall(false, true);
    });
  }, 800);
});

// IPC handlers for renderer process
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

// ─── Offline database IPC ────────────────────────────────────────────────────
ipcMain.handle('offline:getStatus', () => {
  return offlineDb.getStatus();
});

ipcMain.handle('offline:getMenu', (event, restaurantId) => {
  return offlineDb.getMenuItems(restaurantId);
});

ipcMain.handle('offline:getCategories', (event, restaurantId) => {
  return offlineDb.getMenuCategories(restaurantId);
});

ipcMain.handle('offline:getTables', (event, restaurantId) => {
  return offlineDb.getTablesConfig(restaurantId);
});

ipcMain.handle('offline:getRestaurant', (event, restaurantId) => {
  return offlineDb.getRestaurant(restaurantId);
});

// ─── Offline order creation IPC ──────────────────────────────────────────────
// Called by preload when POST /api/orders fails with a network error.
// Saves the order atomically to SQLite with a client-generated UUID.
// Price snapshots are captured here — immutable thereafter.
// Returns a synthetic order object that matches the server response shape.
ipcMain.handle('offline:createOrder', (event, payload) => {
  try {
    if (!offlineDb.isReady()) {
      return { success: false, error: 'Offline database not ready' };
    }
    if (!payload || !payload.restaurantId) {
      return { success: false, error: 'Invalid order payload' };
    }

    const crypto = require('crypto');
    const orderId  = crypto.randomUUID();
    const now      = new Date().toISOString();

    // Build items with IMMUTABLE price snapshots
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const items    = rawItems.map(item => ({
      id            : crypto.randomUUID(),
      menuItemId    : item.menuItemId ?? null,
      nameSnapshot  : String(item.name  ?? ''),
      priceSnapshot : parseFloat(item.price ?? 0),
      quantity      : parseInt(item.quantity ?? 1, 10),
      lineTotal     : parseFloat(item.price ?? 0) * parseInt(item.quantity ?? 1, 10),
    }));

    const totalAmount = items.reduce((s, i) => s + i.lineTotal, 0)
                      + (parseFloat(payload.packagingCharge) || 0)
                      + (parseFloat(payload.deliveryCharge)  || 0);

    // Get a local order number (negative = offline, won't clash with server)
    // We use a monotonic counter stored in sync_meta
    let localMeta = offlineDb.getSyncMeta('offline_order_counter');
    const counter = localMeta ? (parseInt(localMeta.last_server_hash || '0', 10) + 1) : 1;
    offlineDb.setSyncMeta('offline_order_counter', { lastSyncedAt: now, lastServerHash: String(counter) });

    const order = {
      id                  : orderId,
      restaurantId        : payload.restaurantId,
      tableNumber         : payload.tableNumber  ?? null,
      roomNumber          : payload.roomNumber   ?? null,
      orderType           : payload.orderType    ?? 'dine-in',
      customerName        : payload.customerName ?? '',
      customerPhone       : payload.customerPhone ?? null,
      deliveryAddress     : payload.deliveryAddress ?? null,
      totalAmount,
      packagingCharge     : parseFloat(payload.packagingCharge) || 0,
      deliveryCharge      : parseFloat(payload.deliveryCharge)  || 0,
      paymentMethod       : payload.paymentMethod ?? 'cash',
      paymentStatus       : 'pending',
      source              : 'staff',
      createdByStaffId    : null,  // populated if staffData available
      createdAt           : now,
      updatedAt           : now,
    };

    // Save atomically to SQLite
    offlineDb.createOfflineOrder(order, items);

    // Enqueue for upload (Phase 4 will process this)
    offlineDb.enqueue('order', orderId, 'CREATE', JSON.stringify({ order, items, originalPayload: payload }));

    console.log(`[offline] Order ${orderId} saved locally | T${order.tableNumber} | ₹${totalAmount} | ${items.length} items`);

    // Trigger an immediate upload attempt — don't wait for the 30s timer
    setImmediate(() => uploadEngine.triggerUpload());

    // Return response shaped like server would return
    return {
      success    : true,
      order      : {
        _id          : orderId,
        orderNumber  : counter,   // local counter (negative from server perspective)
        restaurantId : order.restaurantId,
        tableNumber  : order.tableNumber,
        roomNumber   : order.roomNumber,
        orderType    : order.orderType,
        customerName : order.customerName,
        items        : items.map(i => ({
          _id             : i.id,
          name            : i.nameSnapshot,
          price           : i.priceSnapshot,
          quantity        : i.quantity,
          printedToKitchen: false,
        })),
        total          : totalAmount,
        totalAmount    : totalAmount,
        status         : 'pending',
        paymentMethod  : order.paymentMethod,
        paymentStatus  : 'pending',
        source         : 'staff',
        isOffline      : true,
        createdAt      : now,
        updatedAt      : now,
      },
    };

  } catch (err) {
    console.error('[offline] createOrder IPC error:', err.message);
    return { success: false, error: err.message };
  }
});

// Get offline orders for a restaurant
ipcMain.handle('offline:getOrders', (event, restaurantId) => {
  try {
    if (!offlineDb.isReady()) return [];
    return offlineDb.getOfflineOrders(restaurantId);
  } catch { return []; }
});

// ─── Offline cancel order ────────────────────────────────────────────────────
// Called when DELETE /api/orders/:id fails offline.
// Deletes the local-only order from SQLite (it was never on the server).
ipcMain.handle('offline:cancelOrder', (event, { orderId }) => {
  try {
    if (!offlineDb.isReady()) return { success: false, error: 'DB not ready' };
    offlineDb.deleteOfflineOrder(orderId);
    console.log(`[offline] Cancelled local order ${orderId}`);
    return { success: true };
  } catch (e) {
    console.error('[offline] cancelOrder error:', e.message);
    return { success: false, error: e.message };
  }
});

// ─── Offline clear table ─────────────────────────────────────────────────────
// Called when POST /api/orders/batch-update fails offline.
// Marks all LOCAL_PENDING orders for the table as COMPLETED_OFFLINE and
// enqueues a COMPLETE operation so they upload to server history on reconnect.
ipcMain.handle('offline:clearTable', (event, { restaurantId, tableNumber, paymentMethod }) => {
  try {
    if (!offlineDb.isReady()) return { success: false, error: 'DB not ready' };
    const completed = offlineDb.completeOfflineTable(
      restaurantId,
      tableNumber,
      paymentMethod || 'cash'
    );
    console.log(`[offline] Cleared table ${tableNumber} (${paymentMethod}): ${completed.length} orders queued for completion`);
    // Trigger immediate upload so it syncs as soon as connectivity returns
    setImmediate(() => uploadEngine.triggerUpload());
    return { success: true, completedIds: completed };
  } catch (e) {
    console.error('[offline] clearTable error:', e.message);
    return { success: false, error: e.message };
  }
});

// ─── Offline login IPC ───────────────────────────────────────────────────────

// Cache staff credentials after successful online login
ipcMain.handle('offline:cacheStaff', (event, { staffData, token }) => {
  try {
    if (!offlineDb.isReady() || !staffData || !token) return { success: false };
    offlineDb.cacheStaffCredentials(staffData, token);
    console.log(`[offline] Cached credentials for: ${staffData.name || staffData.email}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Validate offline login with cached credentials
ipcMain.handle('offline:getCachedStaff', (event, { email, password }) => {
  try {
    if (!offlineDb.isReady()) return { success: false, error: 'DB not ready' };
    const cached = offlineDb.getCachedStaffCredentials(email);
    if (!cached) return { success: false, error: 'No cached credentials for this account' };
    // Return cached staff + token — no password check
    // (the JWT in localStorage IS the credential — if they knew the password online, they can use offline)
    // For stronger security, store a PBKDF2 hash and verify password client-side
    console.log(`[offline] Offline login: ${cached.staffData?.name}`);
    return { success: true, staff: cached.staffData, token: cached.token };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── Table Shift IPC ──────────────────────────────────────────────────────────
// Called from renderer when staff taps the shift button on a table tile.
// Uses PUT /api/orders/:id (always live) to update tableNumber on each order.
// If target table is occupied, the move still happens — items stay separate
// but appear under the new table number (server handles merge via socket events).
ipcMain.handle('order:shiftTable', async (event, { orderId, fromTable, toTable, restaurantId, staffName }) => {
  const tk = await safeExecJS(`localStorage.getItem('staffToken')`);

  if (tk) {
    // ── Online: PUT /api/orders/:id — update tableNumber directly ──────────────
    const result = await new Promise((resolve) => {
      const data = JSON.stringify({ tableNumber: toTable });
      const req  = require('https').request({
        hostname: remoteConfig.getApiHost(),
        path    : `/api/orders/${orderId}`,
        method  : 'PUT',
        headers : {
          'Content-Type'  : 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Accept          : 'application/json',
          Authorization   : `Bearer ${tk}`,
        },
        rejectUnauthorized: false,
      }, (res) => {
        let b = '';
        res.on('data', c => { b += c; });
        res.on('end',  () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
          catch { resolve({ status: res.statusCode, body: b }); }
        });
      });
      req.on('error', (e) => resolve({ status: 0, error: e.message }));
      req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
      req.write(data);
      req.end();
    });

    if (result.status >= 200 && result.status < 300) {
      console.log(`[shift] ✅ Order ${orderId.substring(0,8)} T${fromTable}→T${toTable}`);
      setTimeout(() => doPoll(true).catch(() => {}), 300);
      return { success: true, merged: false, order: result.body };
    }

    const errMsg = result.body?.error || `HTTP ${result.status}`;
    console.warn(`[shift] Server rejected: ${errMsg}`);
    return { success: false, error: errMsg };
  }

  // ── Offline: update tableNumber in SQLite ──────────────────────────────────
  if (!offlineDb.isReady()) return { success: false, error: 'Offline and DB not ready' };
  try {
    const Database = require('./node_modules/better-sqlite3');
    const dbPath   = require('path').join(require('electron').app.getPath('userData'), 'waitnot-offline.db');
    const db       = new Database(dbPath);
    const rows     = db.prepare(
      `UPDATE offline_orders SET table_number=?, updated_at=? WHERE id=? AND status NOT IN ('DONE','COMPLETED_OFFLINE')`
    ).run(toTable, new Date().toISOString(), orderId);
    db.close();
    if (rows.changes === 0) return { success: false, error: 'Order not found or already completed' };
    console.log(`[shift] ✅ Offline order ${orderId.substring(0,8)} T${fromTable}→T${toTable}`);
    setTimeout(() => doPoll(true).catch(() => {}), 300);
    return { success: true, merged: false, offline: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── Mark order as already KOT/Bill printed (prevents auto-print double-fire) ─
ipcMain.handle('print:markKotPrinted', (event, orderId) => {
  if (orderId) { printedKotIds.add(orderId); knownOrderIds.add(orderId); }
  return { ok: true };
});
ipcMain.handle('print:markBillPrinted', (event, orderId) => {
  if (orderId) printedBillIds.add(orderId);
  return { ok: true };
});

// ─── Remote config IPC ────────────────────────────────────────────────────────
ipcMain.handle('config:getApiUrl', () => {
  return remoteConfig.getApiUrl();
});

ipcMain.handle('config:getStatus', () => {
  return remoteConfig.getStatus();
});

ipcMain.handle('config:refresh', async () => {
  const changed = await remoteConfig.refresh();
  return { changed, ...remoteConfig.getStatus() };
});

// ─── Sync engine IPC ──────────────────────────────────────────────────────────
ipcMain.handle('sync:getState', () => {
  return syncEngine.getState();
});

ipcMain.handle('sync:trigger', async () => {
  return syncEngine.triggerSync();
});

ipcMain.handle('sync:isOfflineReady', (event, restaurantId) => {
  return syncEngine.isOfflineReady(restaurantId);
});

// ─── Upload engine IPC ────────────────────────────────────────────────────────
ipcMain.handle('upload:getStatus', () => {
  return uploadEngine.getQueueStatus();
});

ipcMain.handle('upload:trigger', async () => {
  return uploadEngine.triggerUpload();
});

// ─── Network reconnection IPC ────────────────────────────────────────────────
// Called by preload when window.addEventListener('online') fires in renderer.
// Immediately uploads any pending offline orders and re-syncs restaurant data.
ipcMain.handle('network:reconnected', async () => {
  console.log('[main] 🌐 Network reconnected — uploading + syncing + fetching orders');
  try {
    // Reset backoff on FAILED items FIRST so they upload immediately
    if (offlineDb.isReady()) offlineDb.resetFailedBackoff();
    // Upload any pending offline orders immediately
    uploadEngine.triggerUpload().catch(() => {});
    // Re-sync menu/restaurant data
    syncEngine.triggerSync().catch(() => {});
    // Fetch fresh orders and push to UI right now — don't wait for 3s poll tick
    setTimeout(() => doPoll(true).catch(() => {}), 800);
  } catch {}
  return { ok: true };
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
    // Helper: extract the value cell for a given label in a two-column table row.
    // Handles the current template: >LABEL</td> <td style="...">VALUE<
    function extractField(label) {
      const re = new RegExp('>' + label + '<\\/td>\\s*<td[^>]*>([^<]+)<');
      const m  = html.match(re);
      return m ? m[1].trim() : null;
    }

    // Restaurant name — from the large heading div
    const nameMatch     = html.match(/font-size:2[02]px[^>]*>([^<]*)</);
    const restaurantName= (nameMatch && nameMatch[1].trim()) || store.get('restaurantName', 'RESTAURANT');

    // Detect KOT vs Bill
    const isKOT = html.includes('KITCHEN ORDER TICKET') || html.includes('ITEMS TO PREPARE');

    // Extract all info-table fields using the correct regex
    const slotLabel     = extractField('SLOT')    || '';
    const orderId       = extractField('REF')     || '';
    const customerName  = extractField('NAME')    || '';
    const date          = extractField('DATE')    || new Date().toLocaleDateString('en-IN');
    const time          = extractField('TIME')    || new Date().toLocaleTimeString('en-IN');
    const paymentMethod = extractField('PAYMENT') || 'CASH';

    // Order type — from the small subtitle div below the KOT heading
    const typeMatch = html.match(/font-size:11px[^>]*font-weight:700[^>]*>([^<]+)</);
    const orderType = typeMatch ? typeMatch[1].trim().toLowerCase() : 'dine-in';

    // Extract items
    const items = [];
    if (isKOT) {
      const rowRegex = /<tr>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>\u00d7\s*(\d+)<\/td>/g;
      let m;
      while ((m = rowRegex.exec(html)) !== null) {
        items.push({ name: m[1].trim(), quantity: parseInt(m[2]) || 1, price: 0 });
      }
    } else {
      const rowRegex = /<tr>\s*<td[^>]*>([^<]+?)<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>(?:COMP|\u20b9([\d.]+))<\/td>\s*<td[^>]*>(?:\u20b90|\u20b9([\d.]+))<\/td>/g;
      let m;
      while ((m = rowRegex.exec(html)) !== null) {
        const name         = m[1].replace(/\u2605COMP/g, '').trim();
        const qty          = parseInt(m[2]) || 1;
        const price        = parseFloat(m[3]) || 0;
        const complimentary = m[1].includes('\u2605COMP') || !m[3]; // ★COMP or no price = complimentary
        items.push({ name, quantity: qty, price, qty, complimentary });
      }
    }

    // Total
    const totalMatch = html.match(/TOTAL<\/td>\s*<td[^>]*>[^\d]*(\d[\d.]*)/);
    const total = totalMatch ? parseFloat(totalMatch[1]) : 0;

    // Extract charges from the HTML charge rows
    // Template renders: <td class="b">PACKAGING</td><td ...>₹X.XX</td>
    function extractCharge(label) {
      // Match exact label (whole word) followed by ₹amount in next cell
      const re = new RegExp('>[\\s]*' + label + '[\\s]*<\\/td>\\s*<td[^>]*>[^₹<]*₹([\\d.]+)');
      const m  = html.match(re);
      return m ? parseFloat(m[1]) || 0 : 0;
    }
    const packagingCharge = extractCharge('PACKAGING');
    const deliveryCharge  = extractCharge('DELIVERY');
    // Extra charge: look for any non-standard charge row by its label
    // Only match rows that are NOT items (items have 4 columns, charge rows have 2)
    let extraCharge = 0;
    let extraLabel  = '';
    // Match 2-column charge rows: label|amount (not item rows which have 4 columns)
    const chargeRowRegex = /<tr>\s*<td[^>]*>([A-Z][A-Z\s]{1,20})<\/td>\s*<td[^>]*>[^<]*₹([\d.]+)/g;
    const skipLabels = new Set(['PACKAGING','DELIVERY','TOTAL','SUBTOTAL','ITEM','AMT','COMPLIMENTARY']);
    let chargeMatch;
    while ((chargeMatch = chargeRowRegex.exec(html)) !== null) {
      const lbl = chargeMatch[1].trim();
      if (!skipLabels.has(lbl) && !lbl.includes('RECEIPT') && !lbl.includes('ORDER')) {
        extraCharge = parseFloat(chargeMatch[2]) || 0;
        extraLabel  = lbl;
        break;
      }
    }

    return { restaurantName, slotLabel, orderId, customerName, orderType,
             isKOT, items, total, paymentMethod, date, time,
             packagingCharge, deliveryCharge, extraCharge, extraLabel };
  }

  // ── Step 2: Try ESC/POS raw print first (fastest, most reliable) ─────────
  // paperWidth from electron store
  const storedWidth = store.get('paperWidth', '58mm');
  const paperWidth  = html.includes('size: 58mm') ? '58mm'
                    : html.includes('size: 80mm') ? '80mm'
                    : storedWidth;
  const pageWidthMicrons = paperWidth === '58mm' ? 58000 : 80000;

  try {
    const data = parseHtmlReceipt(html);
    console.log(`[silent-print] Parsed: ${data.isKOT ? 'KOT' : 'BILL'} | ${data.items.length} items | "${data.restaurantName}" | slot="${data.slotLabel}"`);

    if (data.items.length === 0 && !data.isKOT) {
      console.warn('[silent-print] 0 items parsed — will still attempt ESC/POS with empty items, may fall to HTML');
    }

    // Normalise slotLabel: if it is a bare number, prefix "Table "
    const slotLabel = data.slotLabel
      ? (/^\d+$/.test(data.slotLabel.trim()) ? `Table ${data.slotLabel.trim()}` : data.slotLabel.trim())
      : '';

    let buf;
    if (data.isKOT) {
      buf = Buffer.from(buildKOTBytes({
        restaurantName: data.restaurantName,
        slotLabel     : data.slotLabel,
        orderId       : data.orderId,
        orderType     : (data.orderType || 'dine-in').toLowerCase(),
        customerName  : data.customerName,
        items         : data.items.map(i => ({ name: i.name, quantity: i.quantity || 1 })),
        paperWidth,
      }));
    } else {
      buf = Buffer.from(buildBillBytes({
        restaurantName: data.restaurantName,
        slotLabel     : data.slotLabel,
        orderType     : (data.orderType || 'dine-in').toLowerCase(),
        customerName  : data.customerName,
        paymentMethod : (data.paymentMethod || 'cash').toLowerCase(),
        items         : data.items.map(i => ({
          name         : i.name,
          quantity     : i.quantity || 1,
          price        : i.price || 0,
          complimentary: !!i.complimentary,
        })),
        packagingCharge: data.packagingCharge || 0,
        deliveryCharge : data.deliveryCharge  || 0,
        extraCharge    : data.extraCharge     || 0,
        extraLabel     : data.extraLabel      || '',
        paperWidth,
      }));
    }

    // Pick target printer
    const savedPrinter  = store.get('selectedPrinter', '');
    const savedKitchen  = store.get('kitchenPrinter',  '');
    const savedBill     = store.get('billPrinter',     '');
    const savedForType  = data.isKOT ? (savedKitchen || savedPrinter) : (savedBill || savedPrinter);
    const targetPrinter = (printerName && printerName.trim())
      ? printerName.trim()
      : (savedForType || await autoDetectThermalPrinter(mainWindow));

    console.log(`[silent-print] ESC/POS → printer="${targetPrinter}" paperWidth=${paperWidth} bytes=${buf.length}`);

    // Use printer.js rawPrintWindows — it resolves the printer name to its
    // hardware port via WMI (e.g. "POS58 Printer" → "USB001"), bypassing the
    // "file named after the printer" trap that silently ate our bytes before.
    const { rawPrintWindows: _rawPrint } = require('./printer');
    // rawPrintWindows is not exported — use printKOT/printBill which call it internally.
    // Instead, replicate the WMI lookup directly here so we have full visibility.
    // Use Windows WritePrinter RAW API (bypasses POS58ENG GDI driver).
    // COPY /B sends through the driver which converts ESC/POS to raster — nothing prints.
    const _escResult = await (async () => {
      const { exec: _e } = require('child_process');
      const _os = require('os');
      const _base64   = buf.toString('base64');
      const _safe     = targetPrinter.replace(/'/g, "''");
      const _ps1Path  = path.join(_os.tmpdir(), `wn-sp-${Date.now()}.ps1`);
      const _psScript = [
        'Add-Type -TypeDefinition @"',
        'using System; using System.Runtime.InteropServices;',
        'public class RawPrinter2 {',
        '  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]',
        '  public struct DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }',
        '  [DllImport("winspool.drv",CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);',
        '  [DllImport("winspool.drv")] public static extern bool ClosePrinter(IntPtr h);',
        '  [DllImport("winspool.drv",CharSet=CharSet.Unicode)] public static extern Int32 StartDocPrinter(IntPtr h, Int32 l, ref DOCINFO d);',
        '  [DllImport("winspool.drv")] public static extern bool EndDocPrinter(IntPtr h);',
        '  [DllImport("winspool.drv")] public static extern bool StartPagePrinter(IntPtr h);',
        '  [DllImport("winspool.drv")] public static extern bool EndPagePrinter(IntPtr h);',
        '  [DllImport("winspool.drv")] public static extern bool WritePrinter(IntPtr h, IntPtr b, Int32 c, out Int32 w);',
        '  public static int SendRaw(string name, byte[] data) {',
        '    IntPtr hP; if (!OpenPrinter(name, out hP, IntPtr.Zero)) return -1;',
        '    var di = new DOCINFO { pDocName="ESCPOS", pOutputFile=null, pDataType="RAW" };',
        '    StartDocPrinter(hP,1,ref di); StartPagePrinter(hP);',
        '    var ptr = System.Runtime.InteropServices.Marshal.AllocHGlobal(data.Length);',
        '    System.Runtime.InteropServices.Marshal.Copy(data,0,ptr,data.Length);',
        '    int w=0; WritePrinter(hP,ptr,data.Length,out w);',
        '    System.Runtime.InteropServices.Marshal.FreeHGlobal(ptr);',
        '    EndPagePrinter(hP); EndDocPrinter(hP); ClosePrinter(hP); return w;',
        '  }',
        '}',
        '"@ -Language CSharp',
        `$b = [Convert]::FromBase64String('` + _base64 + `')`,
        `$w = [RawPrinter2]::SendRaw('` + _safe + `', $b)`,
        'Write-Host "written=$w"',
      ].join('\n');

      try { fs.writeFileSync(_ps1Path, _psScript, 'utf8'); } catch {}

      return new Promise((res) => {
        _e(`powershell -NoProfile -ExecutionPolicy Bypass -File "${_ps1Path}"`,
          { timeout: 15000 },
          (_psErr, _psOut) => {
            try { fs.unlinkSync(_ps1Path); } catch {}
            const _written = parseInt((_psOut || '').match(/written=(\d+)/)?.[1] || '-1');
            if (!_psErr && _written > 0) {
              console.log(`[silent-print] ✅ WritePrinter RAW: ${_written} bytes → "${targetPrinter}"`);
              res({ success: true });
            } else {
              console.warn(`[silent-print] WritePrinter failed (${_written}) — COPY /B fallback`);
              const _tmpBin = path.join(require('os').tmpdir(), `wn-fb-${Date.now()}.bin`);
              try { fs.writeFileSync(_tmpBin, buf); } catch {}
              _e(`COPY /B "${_tmpBin}" "USB001"`, (_cpErr) => {
                try { fs.unlinkSync(_tmpBin); } catch {}
                if (_cpErr) res({ success: false, error: _cpErr.message });
                else res({ success: true });
              });
            }
          }
        );
      });
    })();
    if (_escResult.success) return _escResult;

    // ESC/POS failed — log the reason visibly and fall through to HTML
    console.warn(`[silent-print] ESC/POS failed (${_escResult.error}) — falling back to HTML print`);
    // Notify the cashier in the renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(
        `console.warn('[print] ESC/POS fallback: ${_escResult.error?.replace(/`/g,'')}')`
      ).catch(() => {});
    }

  } catch (parseErr) {
    console.warn(`[silent-print] ESC/POS path error: ${parseErr.message} — falling back to HTML`);
    console.warn('Parse/ESC/POS error:', parseErr.message, '— falling back to HTML print');
  }

  // ── Step 3: HTML fallback — write to temp file and print via Electron ─────
  return new Promise((resolve) => {
    const printWin = new BrowserWindow({
      // Width must match the receipt CSS pixels exactly so table columns compute
      // percentages against the same viewport the @page size uses.
      // 58mm ≈ 220px at 96dpi  |  80mm ≈ 304px at 96dpi
      show: false, width: paperWidth === '58mm' ? 174 : 284, height: 800,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    // Use data: URI — avoids file:// security context differences that affect CSS rendering
    // Inject a meta viewport that locks the layout width to match the paper exactly
    const vpWidth   = paperWidth === '58mm' ? 174 : 284;
    const metaTag   = `<meta name="viewport" content="width=${vpWidth}, initial-scale=1.0">`;
    const fixedHtml = html.includes('<meta name="viewport"')
      ? html
      : html.replace('<head>', `<head>${metaTag}`);
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(fixedHtml);
    printWin.loadURL(dataUrl);

    const cleanup = (success, err) => {
      if (!printWin.isDestroyed()) printWin.close();
      resolve(success ? { success: true } : { success: false, error: err });
    };

    // Safety timeout — 15s hard limit so a stuck print job never freezes the app
    const safetyTimer = setTimeout(() => {
      console.warn('[print] Safety timeout hit — destroying print window');
      cleanup(false, 'print timeout');
    }, 15000);

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
                pageSize: { width: pageWidthMicrons, height: 500000 },
                scaleFactor: 100, landscape: false, color: false, copies: 1,
              }, (success, errorType) => { clearTimeout(safetyTimer); cleanup(success, errorType); });
            } else {
              // Truly no printer — save PDF
              const pdfPath = path.join(os.tmpdir(), `waitnot-bill-${Date.now()}.pdf`);
              printWin.webContents.printToPDF({
                printBackground: false,
                pageSize: { width: pageWidthMicrons, height: 500000 },
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
          pageSize: { width: pageWidthMicrons, height: 500000 },
          scaleFactor: 100,
          landscape: false,
          color: false,
          copies: 1,
        }, (success, errorType) => { clearTimeout(safetyTimer); cleanup(success, errorType); });
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
      paperWidth     : store.get('paperWidth', '80mm'),
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
        hostname: remoteConfig.getApiHost(),
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
            hostname: remoteConfig.getApiHost(),
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