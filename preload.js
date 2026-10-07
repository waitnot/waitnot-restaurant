'use strict';

/**
 * preload.js — WaitNot Staff Desktop v3.6.0
 *
 * Offline is handled by direct IPC calls injected into the renderer bundles
 * (StaffLogin-0F_yB8QP.js and StaffDashboard-BCZh8X0d.js), NOT by XHR/fetch
 * patching here. This file only:
 *   1. Exposes electronAPI bridge
 *   2. Fixes Socket.IO URL (bundle uses io("") which maps to waitnot://app)
 *   3. Injects order events from Node polling into React state
 *   4. Applies desktop styles
 */

const { contextBridge, ipcRenderer } = require('electron');

// API URL is resolved dynamically from remote-config via IPC.
// We start with the known fallback so Socket.IO patch works immediately,
// then replace it once the async IPC response comes back.
let API = 'https://waitnot-restaurant-2.onrender.com';
ipcRenderer.invoke('config:getApiUrl').then(url => {
  if (url && typeof url === 'string' && url.startsWith('https://')) {
    API = url;
    console.log('[WaitNot] API URL resolved from remote config:', API);
  }
}).catch(() => {});

// ═══════════════════════════════════════════════════════════════════
// 1. Expose electronAPI — called synchronously before any page script
// ═══════════════════════════════════════════════════════════════════
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion     : () => ipcRenderer.invoke('app-version'),
  showMessageBox : (o) => ipcRenderer.invoke('show-message-box', o),
  isElectron     : true,

  // Printing
  printKOT    : (data, p) => ipcRenderer.invoke('print-kot',    { data, printerName: p }),
  printBill   : (data, p) => ipcRenderer.invoke('print-bill',   { data, printerName: p }),
  silentPrint : (html, p) => ipcRenderer.invoke('silent-print', { html, printerName: p }),

  // Printer management
  getPrinters         : ()  => ipcRenderer.invoke('get-printers'),
  getPrinterSettings  : ()  => ipcRenderer.invoke('get-printer-settings'),
  setPrinter          : (o) => ipcRenderer.invoke('set-printer', o),
  savePrinterSettings : (s) => ipcRenderer.invoke('save-printer-settings', s),
  openPrinterSettings : ()  => ipcRenderer.invoke('open-printer-settings'),
  cacheRestaurantData : (d) => ipcRenderer.invoke('cache-restaurant-data', d),

  // Offline / SQLite
  offline: {
    getStatus      : ()        => ipcRenderer.invoke('offline:getStatus'),
    getMenu        : (rid)     => ipcRenderer.invoke('offline:getMenu',       rid),
    getCategories  : (rid)     => ipcRenderer.invoke('offline:getCategories', rid),
    getTables      : (rid)     => ipcRenderer.invoke('offline:getTables',     rid),
    getRestaurant  : (rid)     => ipcRenderer.invoke('offline:getRestaurant', rid),
    createOrder    : (payload) => ipcRenderer.invoke('offline:createOrder',   payload),
    getOrders      : (rid)     => ipcRenderer.invoke('offline:getOrders',     rid),
    getCachedStaff : (email)   => ipcRenderer.invoke('offline:getCachedStaff', { email }),
    cacheStaff     : (data)    => ipcRenderer.invoke('offline:cacheStaff',    data),
    cancelOrder    : (orderId) => ipcRenderer.invoke('offline:cancelOrder',   { orderId }),
    clearTable     : (restaurantId, tableNumber, paymentMethod) => ipcRenderer.invoke('offline:clearTable', { restaurantId, tableNumber, paymentMethod }),
  },

  // Sync engine
  sync: {
    getState       : ()    => ipcRenderer.invoke('sync:getState'),
    trigger        : ()    => ipcRenderer.invoke('sync:trigger'),
    isOfflineReady : (rid) => ipcRenderer.invoke('sync:isOfflineReady', rid),
  },

  // Upload engine
  upload: {
    getStatus : () => ipcRenderer.invoke('upload:getStatus'),
    trigger   : () => ipcRenderer.invoke('upload:trigger'),
  },

  // Network events
  notifyReconnected: () => ipcRenderer.invoke('network:reconnected'),

  // Prevent auto-print double-fire
  print: {
    markKotPrinted  : (id) => ipcRenderer.invoke('print:markKotPrinted',  id),
    markBillPrinted : (id) => ipcRenderer.invoke('print:markBillPrinted', id),
  },

  // Table shift
  shiftTable: (orderId, fromTable, toTable, restaurantId, staffName) =>
    ipcRenderer.invoke('order:shiftTable', { orderId, fromTable, toTable, restaurantId, staffName }),

  // Remote config
  config: {
    getApiUrl : ()  => ipcRenderer.invoke('config:getApiUrl'),
    getStatus : ()  => ipcRenderer.invoke('config:getStatus'),
    refresh   : ()  => ipcRenderer.invoke('config:refresh'),
  },

  showNotification: (title, body) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') new Notification(title, { body });
      });
    }
  },
});

// ═══════════════════════════════════════════════════════════════════
// 2. DOM patches — run after DOMContentLoaded so window.* APIs exist
// ═══════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {

  // ── Socket.IO URL fix ────────────────────────────────────────────
  // The bundle calls io("") which resolves to waitnot://app — wrong.
  // Patch window.io so every call uses the real server URL.
  let _ioTries = 0;
  const _patchIO = () => {
    if (window.io && !window.io.__wn_patched) {
      const _origIO = window.io;
      window.io = function (url, opts) {
        const u = (!url || url === '' || url === '/') ? API : url;
        console.log('[WaitNot] Socket.IO connecting to', u);
        const sock = _origIO(u, opts);
        sock.on('connect', () => {
          window.__wn_sock = sock;
          console.log('[WaitNot] Socket connected ✅');
        });
        return sock;
      };
      Object.assign(window.io, _origIO);
      window.io.__wn_patched = true;
      return true;
    }
    return false;
  };
  if (!_patchIO()) {
    const _t = setInterval(() => { if (_patchIO() || ++_ioTries > 150) clearInterval(_t); }, 50);
  }

  // ── XHR passthrough for GET active-orders injection ──────────────
  // Node polling pushes orders via __wn_inject_orders. We intercept
  // the Axios GET /api/orders/restaurant/:id?status=active and return
  // the pre-fetched data so the dashboard stays up to date offline.
  const _NativeXHR = window.XMLHttpRequest;
  function _PatchedXHR() {
    const _x  = new _NativeXHR();
    let _m    = 'GET';
    let _u    = '';

    this.open = function (method, url) {
      _m = (method || 'GET').toUpperCase();
      _u = (typeof url === 'string' && url.startsWith('/')) ? (API + url) : (url || '');
      _x.open.apply(_x, arguments);
    };

    this.send = function (body) {
      const inject = window.__wn_inject_orders;
      const rid    = window.__wn_inject_rid;
      if (inject && _m === 'GET' &&
          _u.includes('/api/orders/restaurant/') &&
          _u.includes('status=active') &&
          rid && _u.includes(rid)) {
        window.__wn_inject_orders = null;
        const raw  = JSON.stringify(inject);
        const self = this;
        setTimeout(() => {
          const pin = (k, v) => Object.defineProperty(self, k, { get: () => v, configurable: true });
          pin('readyState',   4);
          pin('status',       200);
          pin('statusText',   'OK');
          pin('responseText', raw);
          pin('response',     raw);
          if (typeof self.onreadystatechange === 'function') { try { self.onreadystatechange(); } catch {} }
          if (typeof self.onload === 'function')             { try { self.onload();             } catch {} }
        }, 8);
        return;
      }
      _x.send(body);
    };

    // Forward everything else
    const _props = ['timeout','withCredentials','responseType','upload',
      'readyState','status','statusText','response','responseText','responseURL',
      'onloadstart','onprogress','onabort','onerror','onload',
      'ontimeout','onloadend','onreadystatechange'];
    for (const p of _props) {
      if (p in this) continue;
      Object.defineProperty(this, p, {
        get: ()  => _x[p],
        set: (v) => { _x[p] = v; },
        configurable: true, enumerable: true,
      });
    }
    const _methods = ['setRequestHeader','abort','getAllResponseHeaders',
      'getResponseHeader','overrideMimeType','addEventListener',
      'removeEventListener','dispatchEvent'];
    for (const m of _methods) {
      if (!(m in this) && typeof _x[m] === 'function') this[m] = _x[m].bind(_x);
    }
  }
  window.XMLHttpRequest = _PatchedXHR;

  // ── Sync status receiver ─────────────────────────────────────────
  window.addEventListener('__wn_sync_status__', (ev) => {
    window.__wn_sync_state = ev.detail;
  });

  // ── Offline order → React state ──────────────────────────────────
  window.addEventListener('__wn_offline_order__', (ev) => {
    const order = ev.detail;
    if (!order || !order._id) return;
    if (typeof window.__wn_setOrders === 'function') {
      try {
        window.__wn_setOrders(prev => {
          if (!Array.isArray(prev)) return [order];
          if (prev.find(o => o._id === order._id)) return prev;
          return [order, ...prev];
        });
      } catch {
        if (typeof window.__wn_refreshOrders === 'function') {
          try { window.__wn_refreshOrders(); } catch {}
        }
      }
    }
  });

  // ── Node-polled orders → React state ────────────────────────────
  window.addEventListener('__waitnot_orders__', (ev) => {
    const orders = ev.detail;
    if (!Array.isArray(orders)) return;
    try {
      if (typeof window.__wn_setOrders === 'function')     { window.__wn_setOrders(orders); return; }
      if (typeof window.__wn_refreshOrders === 'function') { window.__wn_refreshOrders();   return; }
      if (window.__wn_sock) {
        const cbs = (window.__wn_sock._callbacks || {})['$order-updated'] || [];
        if (cbs.length) { orders.forEach(o => cbs.forEach(h => { try { h(o); } catch {} })); return; }
      }
      const sd  = localStorage.getItem('staffData');
      const rid = sd ? JSON.parse(sd).restaurant_id : null;
      if (rid) {
        window.__wn_inject_orders = orders;
        window.__wn_inject_rid    = rid;
        document.dispatchEvent(new Event('visibilitychange'));
      }
    } catch {}
  });

  // ── Desktop styles ───────────────────────────────────────────────
  const _s = document.createElement('style');
  _s.textContent = `
    body { user-select:none; -webkit-user-select:none; }
    input, textarea, [contenteditable] {
      user-select:text !important; -webkit-user-select:text !important; }
    ::-webkit-scrollbar { width:8px; }
    ::-webkit-scrollbar-track  { background:#f1f1f1; border-radius:4px; }
    ::-webkit-scrollbar-thumb  { background:#c1c1c1; border-radius:4px; }
    ::-webkit-scrollbar-thumb:hover { background:#a8a8a8; }
  `;
  document.head.appendChild(_s);

  console.log('[WaitNot] Preload v3.6 ready ✅');
});

// ── Network online/offline detection ────────────────────────────────────────
// When the browser detects internet is back, immediately tell the main process
// to upload any pending offline orders and re-sync.
window.addEventListener('online', () => {
  console.log('[WaitNot] 🌐 Network back online — triggering instant upload + sync');
  if (window.electronAPI && window.electronAPI.notifyReconnected) {
    window.electronAPI.notifyReconnected().catch(() => {});
  }
});

window.addEventListener('offline', () => {
  console.log('[WaitNot] 📴 Network went offline');
});

window.addEventListener('error',             e => console.error('Desktop Error:',     e.error));
window.addEventListener('unhandledrejection', e => console.error('Desktop Rejection:', e.reason));
