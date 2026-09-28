'use strict';

/**
 * preload.js — WaitNot Staff Software v3.4.0
 *
 * KEY FIX: The renderer uses Axios, which uses XMLHttpRequest — NOT window.fetch.
 * The old approach of patching window.fetch was dead code for Axios calls.
 * This version patches XMLHttpRequest to handle ALL offline cases:
 *   - POST /api/staff/login  → on network failure, serve cached JWT from SQLite
 *   - POST /api/orders       → on network failure, save to SQLite and return synthetic response
 *   - GET  active orders     → inject polled orders from Node process
 *
 * Architecture:
 *   contextBridge.exposeInMainWorld()  ← FIRST (sync, before any scripts run)
 *   DOMContentLoaded                   ← XHR patch + Socket.IO patch + styles
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
// 2. ALL PATCHES inside DOMContentLoaded
//    window.XMLHttpRequest and window.fetch both exist here.
// ═══════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {

  // ── 2a. XHR Interceptor (Axios uses XHR, not fetch) ─────────────
  //
  // Handles three cases:
  //   A) POST /api/staff/login  — on network failure, serve cached creds
  //   B) POST /api/orders       — on network failure, save to SQLite
  //   C) GET  active-orders     — inject pre-polled orders from Node process
  //
  // How Axios error detection works:
  //   Axios sets xhr.onerror and xhr.ontimeout before calling xhr.send().
  //   We intercept those setters so we can wrap them with our offline fallback.
  //   When the underlying XHR fires onerror (no network), we intercept it,
  //   call IPC, and synthesize a successful response instead of propagating
  //   the error to Axios — which makes Axios think the request succeeded.

  const _NativeXHR = window.XMLHttpRequest;

  function OfflineXHR() {
    const _xhr  = new _NativeXHR();
    let _method = 'GET';
    let _url    = '';
    let _body   = null;

    // ── open(): capture method + url ──────────────────────────────
    this.open = function(method, url, ...rest) {
      _method = (method || 'GET').toUpperCase();
      // Normalise relative URLs to absolute so matching is simple
      _url = (typeof url === 'string' && url.startsWith('/')) ? (API + url) : (url || '');
      _xhr.open(method, url, ...rest);
    };

    // ── setRequestHeader(): forward straight through ──────────────
    this.setRequestHeader = function(k, v) { _xhr.setRequestHeader(k, v); };

    // ── send(): core intercept logic ──────────────────────────────
    this.send = function(body) {
      _body = body || null;

      // ── Case C: GET active orders injection ────────────────────
      const inject    = window.__wn_inject_orders;
      const injectRid = window.__wn_inject_rid;
      if (
        inject && _method === 'GET' &&
        _url.includes('/api/orders/restaurant/') &&
        _url.includes('status=active') &&
        injectRid && _url.includes(injectRid)
      ) {
        window.__wn_inject_orders = null;
        const data = JSON.stringify(inject);
        const self = this;
        setTimeout(() => {
          _defineReadOnly(self, 'readyState',   4);
          _defineReadOnly(self, 'status',       200);
          _defineReadOnly(self, 'statusText',   'OK');
          _defineReadOnly(self, 'responseText', data);
          _defineReadOnly(self, 'response',     data);
          if (typeof self.onreadystatechange === 'function') self.onreadystatechange();
          if (typeof self.onload === 'function') self.onload();
        }, 8);
        return;
      }

      // ── Case A: POST /api/staff/login ──────────────────────────
      if (_method === 'POST' && _url.includes('/api/staff/login')) {
        _xhr.addEventListener('error',   () => _offlineLogin(this));
        _xhr.addEventListener('timeout', () => _offlineLogin(this));
        _xhr.send(body);
        return;
      }

      // ── Case B: POST /api/orders ───────────────────────────────
      // Match /api/orders but NOT /api/orders/restaurant/ (GET list endpoint)
      if (_method === 'POST' && /\/api\/orders\/?$/.test(_url)) {
        _xhr.addEventListener('error',   () => _offlineOrder(this, _body));
        _xhr.addEventListener('timeout', () => _offlineOrder(this, _body));
        _xhr.send(body);
        return;
      }

      // All other requests — pass through unchanged
      _xhr.send(body);
    };

    // ── Offline login fallback ────────────────────────────────────
    const _offlineLogin = async (proxyXhr) => {
      console.log('[offline] XHR /api/staff/login failed — trying cached credentials');
      try {
        let email = null;
        try {
          const parsed = _body ? JSON.parse(_body) : {};
          email = parsed.email || null;
        } catch {}

        if (email && window.electronAPI && window.electronAPI.offline) {
          const cached = await window.electronAPI.offline.getCachedStaff(email);
          if (cached && cached.success) {
            console.log('[offline] Offline login granted for:', cached.staff && cached.staff.name);
            const data = JSON.stringify({ token: cached.token, staff: cached.staff });
            _synthesizeSuccess(proxyXhr, 200, data);
            return;
          }
          console.warn('[offline] No cached credentials for:', email);
        }
      } catch (e) {
        console.error('[offline] offlineLogin error:', e && e.message);
      }
      // No cached creds — let Axios see the original error
      _synthesizeError(proxyXhr);
    };

    // ── Offline order creation fallback ──────────────────────────
    const _offlineOrder = async (proxyXhr, rawBody) => {
      console.log('[offline] XHR POST /api/orders failed — saving to SQLite');
      try {
        const payload = rawBody ? JSON.parse(rawBody) : null;
        if (payload && window.electronAPI && window.electronAPI.offline) {
          const result = await window.electronAPI.offline.createOrder(payload);
          if (result && result.success) {
            console.log('[offline] Order saved locally:', result.order && result.order._id);
            const data = JSON.stringify(result.order);
            _synthesizeSuccess(proxyXhr, 201, data);
            return;
          }
          console.warn('[offline] createOrder IPC returned:', result && result.error);
        }
      } catch (e) {
        console.error('[offline] offlineOrder error:', e && e.message);
      }
      // Could not save — let Axios see the original error
      _synthesizeError(proxyXhr);
    };

    // ── Synthesize a successful HTTP response on this proxy XHR ──
    function _synthesizeSuccess(proxyXhr, status, data) {
      _defineReadOnly(proxyXhr, 'readyState',   4);
      _defineReadOnly(proxyXhr, 'status',       status);
      _defineReadOnly(proxyXhr, 'statusText',   'OK');
      _defineReadOnly(proxyXhr, 'responseText', data);
      _defineReadOnly(proxyXhr, 'response',     data);
      // Fire readystatechange first (Axios uses this), then onload
      if (typeof proxyXhr.onreadystatechange === 'function') {
        try { proxyXhr.onreadystatechange(); } catch {}
      }
      if (typeof proxyXhr.onload === 'function') {
        try { proxyXhr.onload(); } catch {}
      }
    }

    // ── Synthesize an error response (pass-through to Axios error) ─
    function _synthesizeError(proxyXhr) {
      _defineReadOnly(proxyXhr, 'readyState', 4);
      _defineReadOnly(proxyXhr, 'status',     0);
      _defineReadOnly(proxyXhr, 'statusText', '');
      if (typeof proxyXhr.onerror === 'function') {
        try { proxyXhr.onerror(new Event('error')); } catch {}
      }
    }

    // ── Helper: define a non-writable, configurable property ──────
    function _defineReadOnly(obj, key, value) {
      Object.defineProperty(obj, key, { get: () => value, configurable: true });
    }

    // ── Forward all remaining XHR properties/methods ──────────────
    // Properties that Axios reads or sets — we proxy them to the real XHR
    const _proxyProps = [
      'timeout', 'withCredentials', 'responseType', 'upload',
      'readyState', 'status', 'statusText', 'response', 'responseText',
      'onloadstart', 'onprogress', 'onabort', 'onerror', 'onload',
      'ontimeout', 'onloadend', 'onreadystatechange',
    ];
    for (const prop of _proxyProps) {
      if (prop in this) continue; // already defined above
      Object.defineProperty(this, prop, {
        get: () => _xhr[prop],
        set: (v) => { _xhr[prop] = v; },
        configurable: true,
        enumerable: true,
      });
    }

    const _proxyMethods = [
      'abort', 'getAllResponseHeaders', 'getResponseHeader',
      'overrideMimeType', 'addEventListener', 'removeEventListener', 'dispatchEvent',
    ];
    for (const m of _proxyMethods) {
      if (!(m in this) && typeof _xhr[m] === 'function') {
        this[m] = _xhr[m].bind(_xhr);
      }
    }

    // Axios reads readyState changes via onreadystatechange on the XHR itself
    // AND via addEventListener('readystatechange') — both need to go to our proxy
    _xhr.addEventListener('readystatechange', () => {
      if (typeof this.onreadystatechange === 'function') {
        // Only forward non-4 states (state 4 is handled by onload/onerror)
        // to avoid double-firing after we synthesize a success/error
        try { this.onreadystatechange(); } catch {}
      }
    });
  }

  window.XMLHttpRequest = OfflineXHR;
  console.log('[WaitNot] XHR offline interceptor installed ✅');

  // ── 2b. fetch() interceptor (fallback for non-Axios callers) ────
  // Some code paths (service worker, native fetch calls) may use fetch.
  // Keep the fetch patch as a belt-and-suspenders fallback.
  if (typeof window.fetch === 'function') {
    const _nativeFetch = window.fetch.bind(window);

    window.fetch = async function patchedFetch(input, init) {
      const url     = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      const method  = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      const fullUrl = url.startsWith('/') ? API + url : url;

      // POST /api/orders
      if (method === 'POST' && /\/api\/orders\/?$/.test(fullUrl)) {
        try { return await _nativeFetch(input, init); }
        catch {
          try {
            const bodyText = init && init.body
              ? (typeof init.body === 'string' ? init.body
                 : init.body instanceof ArrayBuffer ? new TextDecoder().decode(init.body)
                 : String(init.body))
              : null;
            const payload = bodyText ? JSON.parse(bodyText) : null;
            if (payload && window.electronAPI && window.electronAPI.offline) {
              const result = await window.electronAPI.offline.createOrder(payload);
              if (result && result.success) {
                return new Response(JSON.stringify(result.order), {
                  status: 201,
                  headers: new Headers({ 'Content-Type': 'application/json' }),
                });
              }
            }
          } catch {}
        }
      }

      // POST /api/staff/login
      if (method === 'POST' && fullUrl.includes('/api/staff/login')) {
        try { return await _nativeFetch(input, init); }
        catch {
          try {
            const bodyText = init && init.body
              ? (typeof init.body === 'string' ? init.body : String(init.body))
              : null;
            const loginBody = bodyText ? JSON.parse(bodyText) : {};
            if (loginBody.email && window.electronAPI && window.electronAPI.offline) {
              const cached = await window.electronAPI.offline.getCachedStaff(loginBody.email);
              if (cached && cached.success) {
                return new Response(JSON.stringify({ token: cached.token, staff: cached.staff }), {
                  status: 200,
                  headers: new Headers({ 'Content-Type': 'application/json' }),
                });
              }
            }
          } catch {}
        }
      }

      return _nativeFetch(input, init);
    };
  }

  // ── 2c. Socket.IO URL fix ────────────────────────────────────────
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

  // ── 2d. Sync status receiver ─────────────────────────────────────
  window.addEventListener('__wn_sync_status__', (ev) => {
    window.__wn_sync_state = ev.detail;
  });

  // ── 2e. Offline order pushed into React state ────────────────────
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

  // ── 2f. Polled orders receiver ───────────────────────────────────
  window.addEventListener('__waitnot_orders__', (ev) => {
    const orders = ev.detail;
    if (!Array.isArray(orders)) return;
    try {
      if (typeof window.__wn_setOrders === 'function') {
        window.__wn_setOrders(orders); return;
      }
      if (typeof window.__wn_refreshOrders === 'function') {
        window.__wn_refreshOrders(); return;
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
