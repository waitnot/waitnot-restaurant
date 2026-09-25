const { contextBridge, ipcRenderer } = require('electron');

const API = 'https://waitnot-restaurant.onrender.com';

// ═══════════════════════════════════════════════════════════════════
// 1. XHR INTERCEPTOR
//    Patches XMLHttpRequest BEFORE React/Axios loads.
//    Intercepts:
//      POST /api/orders          → auto-print KOT  (if enabled)
//      POST /api/orders/batch-update → auto-print Bill (if enabled)
//      GET  /api/orders/restaurant/:id?status=active → inject polled orders
// ═══════════════════════════════════════════════════════════════════
;(function() {
  const NativeXHR = XMLHttpRequest;

  function PatchedXHR() {
    const xhr  = new NativeXHR();
    let _method = 'GET';
    let _url    = '';
    let _reqBody = null;

    /* ── open ─────────────────────────────────────── */
    const _open = xhr.open.bind(xhr);
    this.open = function(method, url) {
      _method = (method || 'GET').toUpperCase();
      // Normalise relative URL → absolute
      _url = (typeof url === 'string' && url.startsWith('/')) ? API + url : (url || '');
      _open.apply(xhr, arguments);
    };

    /* ── send ─────────────────────────────────────── */
    const _send = xhr.send.bind(xhr);
    this.send = function(body) {
      _reqBody = body;

      // ── A: inject polled orders into GET active-orders ──────────
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

      // ── B: intercept POST /api/orders → auto-print KOT ──────────
      if (_method === 'POST' && _url.endsWith('/api/orders')) {
        _send.apply(xhr, arguments);
        xhr.addEventListener('load', () => {
          try {
            if (xhr.status >= 200 && xhr.status < 300) {
              const order = JSON.parse(xhr.responseText);
              ipcRenderer.invoke('auto-print-kot', { order }).catch(() => {});
            }
          } catch {}
        });
        return;
      }

      // ── C: intercept POST /api/orders/batch-update → auto-print Bill ─
      if (_method === 'POST' && _url.includes('/api/orders/batch-update')) {
        // Capture the orderIds before sending
        let orderIds = [];
        try { orderIds = JSON.parse(_reqBody || '{}').orderIds || []; } catch {}
        _send.apply(xhr, arguments);
        xhr.addEventListener('load', () => {
          try {
            if (xhr.status >= 200 && xhr.status < 300 && orderIds.length > 0) {
              ipcRenderer.invoke('auto-print-bill', { orderIds }).catch(() => {});
            }
          } catch {}
        });
        return;
      }

      _send.apply(xhr, arguments);
    };

    /* ── forward all other XHR props ─────────────── */
    const forward = [
      'abort','getAllResponseHeaders','getResponseHeader','overrideMimeType',
      'setRequestHeader','timeout','withCredentials','responseType','upload',
      'onloadstart','onprogress','onabort','onerror','onload',
      'ontimeout','onloadend','onreadystatechange',
      'addEventListener','removeEventListener','dispatchEvent',
    ];
    forward.forEach(p => {
      if (p in this) return;
      if (typeof xhr[p] === 'function') {
        this[p] = xhr[p].bind(xhr);
      } else {
        Object.defineProperty(this, p, {
          get: () => xhr[p],
          set: v  => { xhr[p] = v; },
          configurable: true,
        });
      }
    });

    // Mirror readyState changes
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
// 2. SOCKET.IO FIX
//    Bundle has io("") → connects to waitnot://app (wrong).
//    Patch to always use the real server.
// ═══════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  let n = 0;
  const patchIO = () => {
    if (window.io && !window.io.__wn) {
      const orig = window.io;
      window.io = function(url, opts) {
        const u = (!url || url === '' || url === '/') ? API : url;
        console.log('[WaitNot] Socket →', u);
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
// 3. POLLED ORDERS RECEIVER
//    main.js polls every 3s from Node. When data changes it fires
//    __waitnot_orders__ here. We inject it via XHR interceptor or
//    socket callbacks.
// ═══════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('__waitnot_orders__', (ev) => {
    const orders = ev.detail;
    if (!Array.isArray(orders)) return;
    try {
      const staffData = JSON.parse(localStorage.getItem('staffData') || '{}');
      const rid = staffData.restaurant_id;
      if (!rid) return;

      // Try socket handlers first (React's own listener)
      if (window.__wn_sock) {
        const cbs = (window.__wn_sock._callbacks || {})['$order-updated'] || [];
        if (cbs.length > 0) {
          orders.forEach(o => cbs.forEach(h => { try { h(o); } catch {} }));
          return;
        }
      }

      // Fallback: inject via XHR on next React fetch
      window.__wn_inject_orders = orders;
      window.__wn_inject_rid    = rid;
      document.dispatchEvent(new Event('visibilitychange'));
    } catch {}
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. EXPOSE electronAPI
// ═══════════════════════════════════════════════════════════════════
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion     : () => ipcRenderer.invoke('app-version'),
  showMessageBox : (o) => ipcRenderer.invoke('show-message-box', o),
  isElectron     : true,

  // Printing
  printKOT    : (data, p) => ipcRenderer.invoke('print-kot',   { data, printerName: p }),
  printBill   : (data, p) => ipcRenderer.invoke('print-bill',  { data, printerName: p }),
  silentPrint : (html, p) => ipcRenderer.invoke('silent-print',{ html, printerName: p }),

  // Printer management
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
