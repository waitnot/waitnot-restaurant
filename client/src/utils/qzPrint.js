/**
 * QZ Tray direct thermal printing utility
 * QZ Tray must be running on the local machine: https://qz.io
 *
 * Flow:
 *  1. Load qz-tray.js from CDN (injected once)
 *  2. Connect to QZ Tray websocket (localhost:8181)
 *  3. Find the configured printer name
 *  4. Send raw ESC/POS or HTML print data
 */

let qz = null;
let connected = false;

// Inject qz-tray.js script once
function loadQZScript() {
  return new Promise((resolve, reject) => {
    if (window.qz) { resolve(window.qz); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
    s.onload = () => resolve(window.qz);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function connectQZ() {
  try {
    qz = await loadQZScript();
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect();
    }
    connected = true;
    return true;
  } catch (e) {
    console.warn('QZ Tray not available:', e.message);
    connected = false;
    return false;
  }
}

export async function isQZAvailable() {
  try {
    await loadQZScript();
    await qz.websocket.connect({ retries: 1, delay: 0.5 });
    connected = true;
    return true;
  } catch {
    return false;
  }
}

export async function getPrinters() {
  if (!connected) await connectQZ();
  if (!connected) return [];
  return await qz.printers.find();
}

/**
 * Print HTML content directly to thermal printer via QZ Tray
 * @param {string} printerName - printer name from getPrinters()
 * @param {string} html - HTML receipt content
 */
export async function printHTML(printerName, html) {
  if (!connected) {
    const ok = await connectQZ();
    if (!ok) return { success: false, error: 'QZ Tray not running' };
  }

  try {
    const config = qz.configs.create(printerName, {
      size: { width: 80 },  // 80mm thermal paper
      units: 'mm',
      margins: { top: 3, right: 3, bottom: 3, left: 3 },
    });

    const data = [{
      type: 'pixel',
      format: 'html',
      flavor: 'plain',
      data: html
    }];

    await qz.print(config, data);
    return { success: true };
  } catch (e) {
    console.error('QZ print error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Print via Electron silent print (desktop app) or QZ Tray,
 * falling back to browser dialog if neither is available.
 * @param {string} html - receipt HTML
 * @param {'kitchen'|'bill'} type - which printer to use
 */
export async function smartPrint(html, type = 'bill') {
  // 1. Try Electron silent print (desktop app — no third party needed)
  if (window.electronAPI?.silentPrint) {
    const restaurantId = localStorage.getItem('restaurantId');
    const savedKey = `printer_settings_${restaurantId}`;
    let printerName = '';
    try {
      const saved = JSON.parse(localStorage.getItem(savedKey) || '{}');
      printerName = type === 'kitchen' ? saved.qzKitchenPrinter : saved.qzBillPrinter;
    } catch {}
    const result = await window.electronAPI.silentPrint(html, printerName || '');
    if (result.success) return { method: 'electron' };
    console.warn('Electron silent print failed:', result.error);
  }

  // 2. Try QZ Tray (browser + QZ Tray installed)
  const restaurantId = localStorage.getItem('restaurantId');
  const savedKey = `printer_settings_${restaurantId}`;
  let printerName = '';
  try {
    const saved = JSON.parse(localStorage.getItem(savedKey) || '{}');
    if (saved.useQZTray) {
      printerName = type === 'kitchen' ? saved.qzKitchenPrinter : saved.qzBillPrinter;
    }
  } catch {}

  if (printerName) {
    const result = await printHTML(printerName, html);
    if (result.success) return { method: 'qz' };
    console.warn('QZ print failed, falling back to browser dialog');
  }

  // 3. Fallback: browser print dialog
  const w = window.open('', '_blank', 'width=400,height=600');
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); setTimeout(() => w.close(), 300); }, 400);
  }
  return { method: 'browser' };
}
