'use strict';

/**
 * preload.js — WaitNot Staff Software v3.5.0
 *
 * ROOT CAUSE OF OFFLINE FAILURE (v3.4.0 bug):
 *   Axios sets xhr.onerror = handler directly as a property.
 *   Our proxy forwarded that setter straight to _xhr.onerror.
 *   When network failed, _xhr.onerror fired → Axios got the error
 *   BEFORE our addEventListener('error') listener could intercept it.
 *   Both ran simultaneously. Axios rejected the promise. Offline failed.
 *
 * FIX (v3.5.0):
 *   Intercept the onerror/ontimeout SETTERS on the proxy object itself.
 *   Store whatever Axios sets into _axiosOnerror/_axiosOntimeout.
 *   In _xhr.onerror, we run OUR offline logic FIRST (async).
 *   Only if offline logic fails do we call Axios's handler.
 *   Axios never sees the error when we handle it offline.
 */

const { contextBridge, ipcRenderer } = require('electron');

const API = 'https://waitnot-restaurant.onrender.com';

// ═══════════════════════════════════════════════════════════════════
// 1. EXPOSE electronAPI — MUST be first
// ═══════════════════════════════════════════════════════════════════
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion     : () => ipcRenderer.invoke('app-version'),
  showMessageBox : (o) => ipcRenderer.invoke('show-message-box', o),
  isElectron     : true,

  printKOT    : (data, p) => ipcRenderer.invoke('print-kot',    { data, printerName: p }),
  printBill   : (data, p) => ipcRenderer.invoke('print-bill',   { data, printerName: p }),
  silentPrint : (html, p) => ipcRenderer.invoke('silent-print', { html, printerName: p }),

  getPrinters         : ()  => ipcRenderer.invoke('get-printers'),
  getPrinterSettings  : ()  => ipcRenderer.invoke('get-printer-settings'),
  setPrinter          : (o) => ipcRenderer.invoke('set-printer', o),
  savePrinterSettings : (s) => ipcRenderer.invoke('save-printer-settings', s),
  openPrinterSettings : ()  => ipcRenderer.invoke('open-printer-settings'),
  cacheRestaurantData : (d) => ipcRenderer.invoke('cache-restaurant-data', d),

  offline: {
    getStatus      : ()        => ipcRenderer.invoke('offline:getStatus'),
    getMenu        : (rid)     => ipcRenderer.invoke('offline:getMenu', rid),
    getCategories  : (rid)     => ipcRenderer.invoke('offline:getCategories', rid),
    getTables      : (rid)     => ipcRenderer.invoke('offline:getTables', rid),
    getRestaurant  : (rid)     => ipcRenderer.invoke('offline:getRestaurant', rid),
    createOrder    : (payload) => ipcRenderer.invoke('offline:createOrder', payload),
    getOrders      : (rid)     => ipcRenderer.invoke('offline:getOrders', rid),
    getCachedStaff : (email)   => ipcRenderer.invoke('offline:getCachedStaff', { email }),
    cacheStaff     : (data)    => ipcRenderer.invoke('offline:cacheStaff', data),
  },

  sync: {
    getState       : ()    => ipcRenderer.invoke('sync:getState'),
    trigger        : ()    => ipcRenderer.invoke('sync:trigger'),
    isOfflineReady : (rid) => ipcRenderer.invoke('sync:isOfflineReady', rid),
  },

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
// ═══════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {

  // ─────────────────────────────────────────────────────────────────
  // 2a.  OfflineXHR — wraps XMLHttpRequest for offline fallback
  //
  // Axios flow (confirmed from bundle inspection):
  //   1. v = new XMLHttpRequest()
  //   2. v.open(method, url, true)
  //   3. v.timeout = N
  //   4. "onloadend" in v  → true (we have it) → v.onloadend = successHandler
  //   5. v.onerror   = axiosErrorHandler     ← we intercept this setter
  //   6. v.ontimeout = axiosTimeoutHandler   ← we intercept this setter
  //   7. v.send(body)
  //
  // When network fails:
  //   _xhr fires its onerror.
  //   We run OUR offline fallback FIRST (async IPC call).
  //   If it succeeds → synthesize HTTP 200/201 → call v.onloadend (success).
  //   If it fails    → call axiosErrorHandler (Axios sees error normally).
  // ─────────────────────────────────────────────────────────────────

  const _NativeXHR = window.XMLHttpRequest;

  function OfflineXHR() {
    const _xhr = new _NativeXHR();

    // State captured at open() time
    let _method  = 'GET';
    let _url     = '';
    let _body    = null;

    // Axios's own error handlers — stored here instead of forwarded to _xhr
    let _axiosOnerror   = null;
    let _axiosOntimeout = null;
    let _axiosOnloadend = null;

    // ── open() ────────────────────────────────────────────────────
    this.open = function (method, url) {
      _method = (method || 'GET').toUpperCase();
      _url    = (typeof url === 'string' && url.startsWith('/')) ? (API + url) : (url || '');
      _xhr.open.apply(_xhr, arguments);
    };

    // ── setRequestHeader() ────────────────────────────────────────
    this.setRequestHeader = function (k, v) { _xhr.setRequestHeader(k, v); };

    // ── Intercept onerror setter ──────────────────────────────────
    // Axios sets v.onerror = handler. We capture it instead of passing to _xhr.
    Object.defineProperty(this, 'onerror', {
      get: () => _axiosOnerror,
      set: (fn) => { _axiosOnerror = fn; },
      configurable: true, enumerable: true,
    });

    // ── Intercept ontimeout setter ────────────────────────────────
    Object.defineProperty(this, 'ontimeout', {
      get: () => _axiosOntimeout,
      set: (fn) => { _axiosOntimeout = fn; },
      configurable: true, enumerable: true,
    });

    // ── Intercept onloadend setter ────────────────────────────────
    // Axios uses onloadend as its success handler (readyState === 4, status > 0).
    // We store it so we can call it when synthesizing a success response.
    Object.defineProperty(this, 'onloadend', {
      get: () => _axiosOnloadend,
      set: (fn) => {
        _axiosOnloadend = fn;
        // Forward to _xhr so real responses still trigger it
        _xhr.onloadend = fn;
      },
      configurable: true, enumerable: true,
    });

    // ── send() ────────────────────────────────────────────────────
    this.send = function (body) {
      _body = body || null;

      // ── Case C: GET active-orders injection ───────────────────
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
          _pin(self, 'readyState',   4);
          _pin(self, 'status',       200);
          _pin(self, 'statusText',   'OK');
          _pin(self, 'responseText', data);
          _pin(self, 'response',     data);
          if (typeof self.onreadystatechange === 'function') { try { self.onreadystatechange(); } catch {} }
          if (typeof _axiosOnloadend === 'function')         { try { _axiosOnloadend();         } catch {} }
        }, 8);
        return;
      }

      // ── Case A: POST /api/staff/login ─────────────────────────
      if (_method === 'POST' && _url.includes('/api/staff/login')) {
        _xhr.onerror = _xhr.ontimeout = () => _handleOfflineLogin(this);
        _xhr.send(body);
        return;
      }

      // ── Case B: POST /api/orders ──────────────────────────────
      if (_method === 'POST' && /\/api\/orders\/?$/.test(_url)) {
        _xhr.onerror = _xhr.ontimeout = () => _handleOfflineOrder(this);
        _xhr.send(body);
        return;
      }

      // All other requests — pass through
      _xhr.send(body);
    };

    // ── Offline login handler (async) ─────────────────────────────
    const _handleOfflineLogin = async (proxy) => {
      console.log('[offline] Login network failure — checking SQLite cache...');
      try {
        let email = null;
        try { email = (_body ? JSON.parse(_body) : {}).email || null; } catch {}

        if (email && window.electronAPI && window.electronAPI.offline) {
          const cached = await window.electronAPI.offline.getCachedStaff(email);
          if (cached && cached.success) {
            console.log('[offline] ✅ Offline login granted:', cached.staff && cached.staff.name);
            _synthesizeOK(proxy, 200, { token: cached.token, staff: cached.staff });
            return;
          }
          console.warn('[offline] No cached credentials for:', email);
        }
      } catch (e) {
        console.error('[offline] Login fallback error:', e && e.message);
      }
      // No cache — let Axios see the error
      if (typeof _axiosOnerror === 'function') {
        try { _axiosOnerror(new Event('error')); } catch {}
      }
    };

    // ── Offline order handler (async) ─────────────────────────────
    const _handleOfflineOrder = async (proxy) => {
      console.log('[offline] Order network failure — saving to SQLite...');
      try {
        const payload = _body ? JSON.parse(_body) : null;
        if (payload && window.electronAPI && window.electronAPI.offline) {
          const result = await window.electronAPI.offline.createOrder(payload);
          if (result && result.success) {
            console.log('[offline] ✅ Order saved locally:', result.order && result.order._id);
            _synthesizeOK(proxy, 201, result.order);
            return;
          }
          console.warn('[offline] createOrder failed:', result && result.error);
        }
      } catch (e) {
        console.error('[offline] Order fallback error:', e && e.message);
      }
      if (typeof _axiosOnerror === 'function') {
        try { _axiosOnerror(new Event('error')); } catch {}
      }
    };

    // ── Synthesize a successful response ─────────────────────────
    // Pins the status/response on the proxy so Axios reads them,
    // then calls onloadend (Axios's success path).
    function _synthesizeOK(proxy, status, dataObj) {
      const data = JSON.stringify(dataObj);
      _pin(proxy, 'readyState',   4);
      _pin(proxy, 'status',       status);
      _pin(proxy, 'statusText',   'OK');
      _pin(proxy, 'responseText', data);
      _pin(proxy, 'response',     data);
      // Axios reads via onloadend (confirmed from bundle)
      if (typeof _axiosOnloadend === 'function') {
        try { _axiosOnloadend(); } catch (e) {
          console.error('[offline] synthesize onloadend error:', e && e.message);
        }
      }
    }

    // ── Pin a property as a fixed getter ─────────────────────────
    function _pin(obj, key, value) {
      Object.defineProperty(obj, key, { get: () => value, configurable: true });
    }

    // ── Proxy all other XHR properties to _xhr ────────────────────
    const _passthroughProps = [
      'timeout', 'withCredentials', 'responseType', 'upload',
      'readyState', 'status', 'statusText', 'response', 'responseText', 'responseURL',
      'onloadstart', 'onprogress', 'onabort', 'onload',
      'onreadystatechange',
    ];
    for (const p of _passthroughProps) {
      if (p in this) continue;
      Object.defineProperty(this, p, {
        get: ()  => _xhr[p],
        set: (v) => { _xhr[p] = v; },
        configurable: true, enumerable: true,
      });
    }

    const _passthroughMethods = [
      'abort', 'getAllResponseHeaders', 'getResponseHeader',
      'overrideMimeType', 'addEventListener', 'removeEventListener', 'dispatchEvent',
    ];
    for (const m of _passthroughMethods) {
      if (!(m in this) && typeof _xhr[m] === 'function') {
        this[m] = _xhr[m].bind(_xhr);
      }
    }
  }

  window.XMLHttpRequest = OfflineXHR;
  console.log('[WaitNot] OfflineXHR v3.5 installed ✅');

  // ─────────────────────────────────────────────────────────────────
  // 2b. fetch() fallback (belt-and-suspenders for non-Axios callers)
  // ─────────────────────────────────────────────────────────────────
  if (typeof window.fetch === 'function') {
    const _nativeFetch = window.fetch.bind(window);
    window.fetch = async function patchedFetch(input, init) {
      const url     = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      const method  = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      const fullUrl = url.startsWith('/') ? API + url : url;

      if (method === 'POST' && /\/api\/orders\/?$/.test(fullUrl)) {
        try { return await _nativeFetch(input, init); } catch {
          try {
            const bt = init && init.body
              ? (typeof init.body === 'string' ? init.body
                : init.body instanceof ArrayBuffer ? new TextDecoder().decode(init.body)
                : String(init.body)) : null;
            const p = bt ? JSON.parse(bt) : null;
            if (p && window.electronAPI && window.electronAPI.offline) {
              const r = await window.electronAPI.offline.createOrder(p);
              if (r && r.success) return new Response(JSON.stringify(r.order), { status: 201, headers: new Headers({ 'Content-Type': 'application/json' }) });
            }
          } catch {}
        }
      }

      if (method === 'POST' && fullUrl.includes('/api/staff/login')) {
        try { return await _nativeFetch(input, init); } catch {
          try {
            const bt  = init && init.body ? (typeof init.body === 'string' ? init.body : String(init.body)) : null;
            const lb  = bt ? JSON.parse(bt) : {};
            if (lb.email && window.electronAPI && window.electronAPI.offline) {
              const c = await window.electronAPI.offline.getCachedStaff(lb.email);
              if (c && c.success) return new Response(JSON.stringify({ token: c.token, staff: c.staff }), { status: 200, headers: new Headers({ 'Content-Type': 'application/json' }) });
            }
          } catch {}
        }
      }

      return _nativeFetch(input, init);
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // 2c. Socket.IO URL fix
  // ─────────────────────────────────────────────────────────────────
  let ioAttempts = 0;
  const patchIO = () => {
    if (window.io && !window.io.__wn) {
      const orig = window.io;
      window.io = function (url, opts) {
        const u = (!url || url === '' || url === '/') ? API : url;
        console.log('[WaitNot] Socket.IO →', u);
        const sock = orig(u, opts);
        sock.on('connect', () => { window.__wn_sock = sock; console.log('[WaitNot] Socket connected ✅'); });
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

  // ─────────────────────────────────────────────────────────────────
  // 2d–2f. Event listeners for order injection / sync status
  // ─────────────────────────────────────────────────────────────────
  window.addEventListener('__wn_sync_status__', (ev) => { window.__wn_sync_state = ev.detail; });

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
        if (typeof window.__wn_refreshOrders === 'function') { try { window.__wn_refreshOrders(); } catch {} }
      }
    }
  });

  window.addEventListener('__waitnot_orders__', (ev) => {
    const orders = ev.detail;
    if (!Array.isArray(orders)) return;
    try {
      if (typeof window.__wn_setOrders === 'function')    { window.__wn_setOrders(orders); return; }
      if (typeof window.__wn_refreshOrders === 'function') { window.__wn_refreshOrders(); return; }
      if (window.__wn_sock) {
        const cbs = (window.__wn_sock._callbacks || {})['$order-updated'] || [];
        if (cbs.length) { orders.forEach(o => cbs.forEach(h => { try { h(o); } catch {} })); return; }
      }
      const sd  = localStorage.getItem('staffData');
      const rid = sd ? JSON.parse(sd).restaurant_id : null;
      if (rid) { window.__wn_inject_orders = orders; window.__wn_inject_rid = rid; document.dispatchEvent(new Event('visibilitychange')); }
    } catch {}
  });

  // ─────────────────────────────────────────────────────────────────
  // 2g. Desktop styles
  // ─────────────────────────────────────────────────────────────────
  const s = document.createElement('style');
  s.textContent = `
    body { user-select:none; -webkit-user-select:none; }
    input,textarea,[contenteditable] { user-select:text !important; -webkit-user-select:text !important; }
    ::-webkit-scrollbar { width:8px; }
    ::-webkit-scrollbar-track { background:#f1f1f1; border-radius:4px; }
    ::-webkit-scrollbar-thumb { background:#c1c1c1; border-radius:4px; }
    ::-webkit-scrollbar-thumb:hover { background:#a8a8a8; }
  `;
  document.head.appendChild(s);

}); // end DOMContentLoaded

window.addEventListener('error', e => console.error('Desktop Error:', e.error));
window.addEventListener('unhandledrejection', e => console.error('Desktop Rejection:', e.reason));
