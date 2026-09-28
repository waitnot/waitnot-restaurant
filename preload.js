const { contextBridge, ipcRenderer } = require('electron');

const API = 'https://waitnot-restaurant.onrender.com';

// ═══════════════════════════════════════════════════════════════════
// 1. XHR INTERCEPTOR — only used for UI order refresh injection
//    Auto-print is handled entirely in main.js via Node.js polling.
//    This only intercepts GET active-orders to inject polled data.
// ═══════════════════════════════════════════════════════════════════
;(function() {
  const NativeXHR = XMLHttpRequest;

  function PatchedXHR() {
    const xhr    = new NativeXHR();
    let _method  = 'GET';
    let _url     = '';
    let _reqBody = null;

    const _open = xhr.open.bind(xhr);
    this.open = function(method, url) {
      _method = (method || 'GET').toUpperCase();
      _url    = (typeof url === 'string' && url.startsWith('/')) ? API + url : (url || '');
      _open.apply(xhr, arguments);
    };

    const _send = xhr.send.bind(xhr);
    this.send = function(body) {
      _reqBody = body;

      // ── A. Inject polled orders into GET active-orders (UI refresh) ──────
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
          _defineProps(self, { readyState:4, status:200, statusText:'OK',
            responseText:data, response:data });
          if (typeof self.onreadystatechange === 'function') self.onreadystatechange();
          if (typeof self.onload === 'function') self.onload();
        }, 8);
        return;
      }

      // ── B. Offline order creation intercept ──────────────────────────────
      // If POST /api/orders fails due to network error, save locally instead.
      if (_method === 'POST' && _url.endsWith('/api/orders')) {
        _send.apply(xhr, arguments);

        // Listen for error (network offline) on the real XHR
        xhr.addEventListener('error', () => {
          _handleOfflineOrder(body, this);
        });
        // Also handle timeout
        xhr.addEventListener('timeout', () => {
          _handleOfflineOrder(body, this);
        });
        return;
      }

      _send.apply(xhr, arguments);
    };

    // Forward all XHR properties
    const fwd = [
      'abort','getAllResponseHeaders','getResponseHeader','overrideMimeType',
      'setRequestHeader','timeout','withCredentials','responseType','upload',
      'onloadstart','onprogress','onabort','onerror','onload',
      'ontimeout','onloadend','onreadystatechange',
      'addEventListener','removeEventListener','dispatchEvent',
    ];
    fwd.forEach(p => {
      if (p in this) return;
      if (typeof xhr[p] === 'function') {
        this[p] = xhr[p].bind(xhr);
      } else {
        Object.defineProperty(this, p, {
          get: () => xhr[p], set: v => { xhr[p] = v; }, configurable: true,
        });
      }
    });

    xhr.onreadystatechange = () => {
      if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
    };
  }

  function _defineProps(obj, map) {
    Object.entries(map).forEach(([k, v]) => {
      Object.defineProperty(obj, k, { get: () => v, configurable: true });
    });
  }

  // ── Offline order creation ───────────────────────────────────────────────
  // Called when POST /api/orders fails with a network error (offline).
  // Saves the order to SQLite via IPC and returns a synthetic server response
  // so React sees no difference — cart clears, order appears in table grid.
  function _handleOfflineOrder(requestBody, xhrProxy) {
    try {
      const payload = typeof requestBody === 'string' ? JSON.parse(requestBody) : requestBody;
      if (!payload || !payload.restaurantId) return; // not a valid order

      // Invoke the offline:createOrder IPC handler
      if (window.electronAPI && window.electronAPI.offline && window.electronAPI.offline.createOrder) {
        window.electronAPI.offline.createOrder(payload).then((result) => {
          if (!result || !result.success) {
            console.warn('[offline] createOrder failed:', result?.error);
            // Let XHR error propagate normally — React will show "Failed to place order"
            return;
          }

          // Build a synthetic response that looks like the server would have returned
          const syntheticOrder = {
            _id            : result.order._id,
            restaurantId   : payload.restaurantId,
            orderNumber    : result.order.orderNumber,
            tableNumber    : payload.tableNumber ?? null,
            roomNumber     : payload.roomNumber  ?? null,
            orderType      : payload.orderType   ?? 'dine-in',
            customerName   : payload.customerName ?? '',
            customerPhone  : payload.customerPhone ?? null,
            deliveryAddress: payload.deliveryAddress ?? null,
            items          : result.order.items,
            total          : result.order.totalAmount,
            totalAmount    : result.order.totalAmount,
            status         : 'pending',
            paymentMethod  : payload.paymentMethod ?? 'cash',
            paymentStatus  : 'pending',
            source         : 'staff',
            isOffline      : true,   // flag so UI can show indicator if needed
            createdAt      : result.order.createdAt,
            updatedAt      : result.order.createdAt,
          };

          const responseData = JSON.stringify(syntheticOrder);
          console.log(`[offline] Order saved locally: ${syntheticOrder._id} T${syntheticOrder.tableNumber}`);

          // Inject as successful XHR response (status 201)
          _defineProps(xhrProxy, {
            readyState  : 4,
            status      : 201,
            statusText  : 'Created (offline)',
            responseText: responseData,
            response    : responseData,
          });
          if (typeof xhrProxy.onreadystatechange === 'function') xhrProxy.onreadystatechange();
          if (typeof xhrProxy.onload === 'function') xhrProxy.onload();

          // Also push this order into React's active orders state immediately
          if (typeof window.__wn_setOrders === 'function') {
            // Get current orders and prepend this one
            // We dispatch via event so the listener in DOMContentLoaded picks it up
            window.dispatchEvent(new CustomEvent('__wn_offline_order__', { detail: syntheticOrder }));
          }
        }).catch((err) => {
          console.error('[offline] IPC createOrder error:', err);
          // Let the original XHR error stand
        });
      }
    } catch (e) {
      console.error('[offline] _handleOfflineOrder error:', e.message);
    }
  }

  window.XMLHttpRequest = PatchedXHR;
})();

// ═══════════════════════════════════════════════════════════════════
// 2. SOCKET.IO FIX — bundle has io("") which hits wrong origin
// ═══════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  let n = 0;
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
    const t = setInterval(() => { if (patchIO() || ++n > 150) clearInterval(t); }, 50);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 3. POLLED ORDERS RECEIVER — main.js fires __waitnot_orders__
//    Updates React state directly via exposed window functions
// ═══════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  // Sync status events from main process via __wn_sync_status__
  window.addEventListener('__wn_sync_status__', (ev) => {
    // Store latest sync state globally so React components can read it
    window.__wn_sync_state = ev.detail;
  });

  // Offline order created locally — inject into React orders state
  window.addEventListener('__wn_offline_order__', (ev) => {
    const order = ev.detail;
    if (!order || !order._id) return;
    // Add to React's orders state (z) so table grid shows as occupied immediately
    if (typeof window.__wn_setOrders === 'function') {
      try {
        // We need the current orders — read from __wn_latest_orders if available
        // and prepend this offline order
        window.__wn_setOrders((prev) => {
          if (!Array.isArray(prev)) return [order];
          if (prev.find(o => o._id === order._id)) return prev;
          return [order, ...prev];
        });
      } catch {
        // __wn_setOrders may not accept a function — try direct approach
        try { window.__wn_refreshOrders && window.__wn_refreshOrders(); } catch {}
      }
    }
  });

  window.addEventListener('__waitnot_orders__', (ev) => {
    const orders = ev.detail;
    if (!Array.isArray(orders)) return;

    try {
      // Method 1: Directly set React orders state (fastest, no network call)
      if (typeof window.__wn_setOrders === 'function') {
        window.__wn_setOrders(orders);
        return;
      }

      // Method 2: Call React's own Me() refetch function
      if (typeof window.__wn_refreshOrders === 'function') {
        window.__wn_refreshOrders();
        return;
      }

      // Method 3: Socket callbacks
      if (window.__wn_sock) {
        const cbs = (window.__wn_sock._callbacks || {})['$order-updated'] || [];
        if (cbs.length > 0) {
          orders.forEach(o => cbs.forEach(h => { try { h(o); } catch {} }));
          return;
        }
      }

      // Method 4: XHR injection fallback
      const staffData = JSON.parse(localStorage.getItem('staffData') || '{}');
      const rid = staffData.restaurant_id;
      if (rid) {
        window.__wn_inject_orders = orders;
        window.__wn_inject_rid    = rid;
        document.dispatchEvent(new Event('visibilitychange'));
      }
    } catch {}
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. electronAPI
// ═══════════════════════════════════════════════════════════════════
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion      : () => ipcRenderer.invoke('app-version'),
  showMessageBox  : (o) => ipcRenderer.invoke('show-message-box', o),
  isElectron      : true,

  printKOT        : (data, p) => ipcRenderer.invoke('print-kot',    { data, printerName: p }),
  printBill       : (data, p) => ipcRenderer.invoke('print-bill',   { data, printerName: p }),
  silentPrint     : (html, p) => ipcRenderer.invoke('silent-print', { html, printerName: p }),

  getPrinters         : ()  => ipcRenderer.invoke('get-printers'),
  getPrinterSettings  : ()  => ipcRenderer.invoke('get-printer-settings'),
  setPrinter          : (o) => ipcRenderer.invoke('set-printer', o),
  savePrinterSettings : (s) => ipcRenderer.invoke('save-printer-settings', s),
  openPrinterSettings : ()  => ipcRenderer.invoke('open-printer-settings'),
  cacheRestaurantData : (d) => ipcRenderer.invoke('cache-restaurant-data', d),

  // ── Offline database ───────────────────────────────────────────────────────
  offline: {
    getStatus      : ()       => ipcRenderer.invoke('offline:getStatus'),
    getMenu        : (rid)    => ipcRenderer.invoke('offline:getMenu', rid),
    getCategories  : (rid)    => ipcRenderer.invoke('offline:getCategories', rid),
    getTables      : (rid)    => ipcRenderer.invoke('offline:getTables', rid),
    getRestaurant  : (rid)    => ipcRenderer.invoke('offline:getRestaurant', rid),
    createOrder    : (payload)=> ipcRenderer.invoke('offline:createOrder', payload),
    getOrders      : (rid)    => ipcRenderer.invoke('offline:getOrders', rid),
  },

  // ── Sync engine ────────────────────────────────────────────────────────────
  sync: {
    getState       : ()    => ipcRenderer.invoke('sync:getState'),
    trigger        : ()    => ipcRenderer.invoke('sync:trigger'),
    isOfflineReady : (rid) => ipcRenderer.invoke('sync:isOfflineReady', rid),
  },

  // ── Upload engine ──────────────────────────────────────────────────────────
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
// 5. DESKTOP STYLES
// ═══════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
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
});

window.addEventListener('error', e => console.error('Desktop Error:', e.error));
window.addEventListener('unhandledrejection', e => console.error('Desktop Rejection:', e.reason));
