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

    const _open = xhr.open.bind(xhr);
    this.open = function(method, url) {
      _method = (method || 'GET').toUpperCase();
      _url    = (typeof url === 'string' && url.startsWith('/')) ? API + url : (url || '');
      _open.apply(xhr, arguments);
    };

    const _send = xhr.send.bind(xhr);
    this.send = function(body) {
      // Inject polled orders into GET active-orders so React UI refreshes
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
