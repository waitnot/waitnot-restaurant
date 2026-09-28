'use strict';

/**
 * preload.js — WaitNot Staff Software
 *
 * Runs in the renderer process before any page scripts.
 * contextBridge.exposeInMainWorld is called FIRST to ensure
 * window.electronAPI is available before any other patches.
 *
 * Offline support:
 *  - window.fetch patched AFTER DOMContentLoaded (fetch exists then)
 *  - POST /api/orders failure → offline:createOrder IPC → SQLite
 *  - POST /api/staff/login failure → offline:getCachedStaff IPC
 */

const { contextBridge, ipcRenderer } = require('electron');

const API = 'https://waitnot-restaurant.onrender.com';

// ═══════════════════════════════════════════════════════════════════
// 1. EXPOSE electronAPI — MUST be first so renderer can use it
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

  // Offline database
  offline: {
    getStatus      : ()       => ipcRenderer.invoke('offline:getStatus'),
    getMenu        : (rid)    => ipcRenderer.invoke('offline:getMenu', rid),
    getCategories  : (rid)    => ipcRenderer.invoke('offline:getCategories', rid),
    getTables      : (rid)    => ipcRenderer.invoke('offline:getTables', rid),
    getRestaurant  : (rid)    => ipcRenderer.invoke('offline:getRestaurant', rid),
    createOrder    : (payload)=> ipcRenderer.invoke('offline:createOrder', payload),
    getOrders      : (rid)    => ipcRenderer.invoke('offline:getOrders', rid),
    getCachedStaff : (email)  => ipcRenderer.invoke('offline:getCachedStaff', { email }),
    cacheStaff     : (data)   => ipcRenderer.invoke('offline:cacheStaff', data),
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
// 2. ALL PATCHES run inside DOMContentLoaded
//    - window.fetch exists here
//    - window.electronAPI is available (set above via contextBridge)
//    - page scripts haven't run yet
// ═══════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {

  // ── 2a. Offline fetch interceptor ───────────────────────────────
  // Patches window.fetch to handle offline order placement and login.
  // Must run INSIDE DOMContentLoaded so window.fetch exists.
  if (typeof window.fetch === 'function') {
    const _nativeFetch = window.fetch.bind(window);

    window.fetch = async function patchedFetch(input, init) {
      const url    = typeof input === 'string' ? input
                   : (input && input.url ? input.url : '');
      const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      const fullUrl = url.startsWith('/') ? API + url : url;

      // POST /api/orders — try online first, fall back to offline
      if (method === 'POST' && fullUrl.endsWith('/api/orders')) {
        try {
          return await _nativeFetch(input, init);
        } catch (netErr) {
          console.log('[offline] fetch /api/orders failed, saving locally...');
          try {
            let bodyText = null;
            if (init && init.body) {
              bodyText = typeof init.body === 'string' ? init.body
                       : (init.body instanceof ArrayBuffer
                           ? new TextDecoder().decode(init.body)
                           : String(init.body));
            }
            const payload = bodyText ? JSON.parse(bodyText) : null;
            if (payload && window.electronAPI && window.electronAPI.offline) {
              const result = await window.electronAPI.offline.createOrder(payload);
              if (result && result.success) {
                return new Response(JSON.stringify(result.order), {
                  status : 201,
                  headers: new Headers({ 'Content-Type': 'application/json' }),
                });
              }
            }
          } catch (ipcErr) {
            console.error('[offline] createOrder IPC error:', ipcErr && ipcErr.message);
          }
          throw netErr;
        }
      }

      // POST /api/staff/login — offline login with cached credentials
      if (method === 'POST' && fullUrl.includes('/api/staff/login')) {
        try {
          return await _nativeFetch(input, init);
        } catch (netErr) {
          console.log('[offline] Staff login offline — checking cached credentials');
          try {
            let bodyText = null;
            if (init && init.body) {
              bodyText = typeof init.body === 'string' ? init.body : String(init.body);
            }
            const loginBody = bodyText ? JSON.parse(bodyText) : {};
            if (loginBody.email && window.electronAPI && window.electronAPI.offline) {
              const cached = await window.electronAPI.offline.getCachedStaff(loginBody.email);
              if (cached && cached.success) {
                console.log('[offline] Offline login granted:', cached.staff && cached.staff.name);
                return new Response(JSON.stringify({ token: cached.token, staff: cached.staff }), {
                  status : 200,
                  headers: new Headers({ 'Content-Type': 'application/json' }),
                });
              }
            }
          } catch {}
          throw netErr;
        }
      }

      // All other requests — pass through
      return _nativeFetch(input, init);
    };
  }

  // ── 2b. Socket.IO URL fix ────────────────────────────────────────
  // Bundle uses io("") → connects to waitnot://app (wrong).
  // Patch to always use the real server.
  let ioAttempts = 0;
  const patchIO = () => {
    if (window.io && !window.io.__wn) {
      const orig = window.io;
      window.io = function(url, opts) {
        const u = (!url || url === '' || url === '/') ? API : url;
        console.log('[WaitNot] Socket.IO →', u);
        const sock = orig(u, opts);
        sock.on('connect', () => {
          window.__wn_sock = sock;
          console.log('[WaitNot] Socket connected ✅');
        });
        return sock;
      };
      Object.assign(window.io, orig);
      window.io.__wn = true;
      return true;
    }
    return false;
  };
  if (!patchIO()) {
    const t = setInterval(() => { if (patchIO() || ++ioAttempts > 150) clearInterval(t); }, 50);
  }

  // ── 2c. Sync status receiver ─────────────────────────────────────
  window.addEventListener('__wn_sync_status__', (ev) => {
    window.__wn_sync_state = ev.detail;
  });

  // ── 2d. Offline order injected into React state ──────────────────
  window.addEventListener('__wn_offline_order__', (ev) => {
    const order = ev.detail;
    if (!order || !order._id) return;
    if (typeof window.__wn_setOrders === 'function') {
      try {
        window.__wn_setOrders((prev) => {
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

  // ── 2e. Polled orders receiver ───────────────────────────────────
  window.addEventListener('__waitnot_orders__', (ev) => {
    const orders = ev.detail;
    if (!Array.isArray(orders)) return;
    try {
      if (typeof window.__wn_setOrders === 'function') {
        window.__wn_setOrders(orders);
        return;
      }
      if (typeof window.__wn_refreshOrders === 'function') {
        window.__wn_refreshOrders();
        return;
      }
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

  // ── 2f. XHR injection for GET active-orders ─────────────────────
  // Injects polled orders into Axios GET /api/orders/restaurant/:id?status=active
  const NativeXHR = XMLHttpRequest;
  function PatchedXHR() {
    const xhr   = new NativeXHR();
    let _method = 'GET';
    let _url    = '';

    const _open = xhr.open.bind(xhr);
    this.open = function(method, url) {
      _method = (method || 'GET').toUpperCase();
      _url    = (typeof url === 'string' && url.startsWith('/')) ? API + url : (url || '');
      _open.apply(xhr, arguments);
    };

    const _send = xhr.send.bind(xhr);
    this.send = function() {
      const inject    = window.__wn_inject_orders;
      const injectRid = window.__wn_inject_rid;
      if (inject && _method === 'GET' &&
          _url.includes('/api/orders/restaurant/') &&
          _url.includes('status=active') &&
          injectRid && _url.includes(injectRid)) {
        window.__wn_inject_orders = null;
        const data = JSON.stringify(inject);
        const self = this;
        setTimeout(() => {
          ['readyState','status','statusText','responseText','response'].forEach((k, i) => {
            const vals = [4, 200, 'OK', data, data];
            Object.defineProperty(self, k, { get: () => vals[i], configurable: true });
          });
          if (typeof self.onreadystatechange === 'function') self.onreadystatechange();
          if (typeof self.onload === 'function') self.onload();
        }, 8);
        return;
      }
      _send.apply(xhr, arguments);
    };

    const fwd = ['abort','getAllResponseHeaders','getResponseHeader','overrideMimeType',
      'setRequestHeader','timeout','withCredentials','responseType','upload',
      'onloadstart','onprogress','onabort','onerror','onload',
      'ontimeout','onloadend','onreadystatechange','addEventListener','removeEventListener','dispatchEvent'];
    fwd.forEach(p => {
      if (p in this) return;
      if (typeof xhr[p] === 'function') { this[p] = xhr[p].bind(xhr); }
      else { Object.defineProperty(this, p, { get: () => xhr[p], set: v => { xhr[p] = v; }, configurable: true }); }
    });
    xhr.onreadystatechange = () => {
      if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
    };
  }
  window.XMLHttpRequest = PatchedXHR;

  // ── 2g. Desktop styles ───────────────────────────────────────────
  const s = document.createElement('style');
  s.textContent = `
    body { user-select:none; -webkit-user-select:none; }
    input,textarea,[contenteditable] {
      user-select:text !important; -webkit-user-select:text !important; }
    ::-webkit-scrollbar { width:8px; }
    ::-webkit-scrollbar-track { background:#f1f1f1; border-radius:4px; }
    ::-webkit-scrollbar-thumb { background:#c1c1c1; border-radius:4px; }
    ::-webkit-scrollbar-thumb:hover { background:#a8a8a8; }
  `;
  document.head.appendChild(s);

}); // end DOMContentLoaded

window.addEventListener('error', e => console.error('Desktop Error:', e.error));
window.addEventListener('unhandledrejection', e => console.error('Desktop Rejection:', e.reason));
