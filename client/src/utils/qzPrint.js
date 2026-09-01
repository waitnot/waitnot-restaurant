import { BluetoothSerial } from '@ascentio-it/capacitor-bluetooth-serial';

/**
 * WaitNot Silent Printing Utility
 *
 * Priority order:
 * 1. Native Android Bluetooth (Capacitor app)
 * 2. Electron desktop silent print (no dialog)
 * 3. QZ Tray (web browser with QZ Tray installed)
 * 4. Browser window.print() fallback
 */

let qz = null;
let qzConnected = false;

// ─── QZ Tray ────────────────────────────────────────────────────────────────

function loadQZScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || window.Capacitor?.isNativePlatform?.()) {
      reject(new Error('QZ not available in native app'));
      return;
    }
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
    if (!qz.websocket.isActive()) await qz.websocket.connect();
    qzConnected = true;
    return true;
  } catch (e) {
    qzConnected = false;
    return false;
  }
}

export async function getPrinters() {
  if (!qzConnected) await connectQZ();
  if (!qzConnected) return [];
  try { return await qz.printers.find(); } catch { return []; }
}

export function isQZAvailable() { return qzConnected; }

// ─── QZ Tray silent print ────────────────────────────────────────────────────

async function qzPrint(html, printerName) {
  if (!qzConnected) {
    const ok = await connectQZ();
    if (!ok) return false;
  }
  try {
    const config = qz.configs.create(printerName, {
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      size: { width: 80, height: null }, // mm, null = auto (roll)
      units: 'mm',
      copies: 1,
      colorType: 'blackwhite',
      density: 203,
    });
    const data = [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }];
    await qz.print(config, data);
    return true;
  } catch (e) {
    console.error('QZ print error:', e);
    return false;
  }
}

// ─── Bluetooth (Android Capacitor) ──────────────────────────────────────────

async function bluetoothPrint(html, type) {
  try {
    const restaurantId = localStorage.getItem('restaurantId')
      || JSON.parse(localStorage.getItem('staffData') || '{}').restaurant_id;
    const saved = JSON.parse(localStorage.getItem(`printer_settings_${restaurantId}`) || '{}');
    const address = type === 'kitchen' ? saved.btKitchenPrinter : saved.btBillPrinter;
    if (!address) return { success: false, error: 'No Bluetooth printer configured' };

    const state = await BluetoothSerial.isEnabled();
    if (!state.enabled) await BluetoothSerial.enable();
    await BluetoothSerial.connect({ address });

    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.innerText.split('\n').filter(l => l.trim()).join('\n');
    const feed = '\n\n\n\n';

    await BluetoothSerial.write({ address, value: text + feed });
    await new Promise(r => setTimeout(r, 500));
    await BluetoothSerial.disconnect({ address });
    return { success: true };
  } catch (e) {
    console.error('BT print error:', e);
    return { success: false, error: e.message };
  }
}

// ─── Browser fallback ────────────────────────────────────────────────────────

function browserPrint(html) {
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => {
    w.focus();
    w.print();
    w.onafterprint = () => w.close();
    setTimeout(() => { try { w.close(); } catch (e) {} }, 4000);
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function smartPrint(html, type = 'bill') {
  console.log(`🖨️ smartPrint [${type}]`);

  // 1. Android Bluetooth
  if (window.Capacitor?.isNativePlatform?.()) {
    const res = await bluetoothPrint(html, type);
    if (res.success) return { method: 'bluetooth' };
    alert('⚠️ Bluetooth printer not configured. Go to Settings → Bluetooth Printer to pair your printer.');
    return { method: 'none', error: res.error };
  }

  // 2. Electron desktop silent print
  if (window.electronAPI?.silentPrint) {
    const restaurantId = localStorage.getItem('restaurantId')
      || JSON.parse(localStorage.getItem('staffData') || '{}').restaurant_id;
    const saved = JSON.parse(localStorage.getItem(`printer_settings_${restaurantId}`) || '{}');
    const printerName = type === 'kitchen'
      ? (saved.qzKitchenPrinter || saved.kitchenPrinterName || '')
      : (saved.qzBillPrinter || saved.cashCounterPrinterName || '');
    const result = await window.electronAPI.silentPrint(html, printerName);
    if (result.success) return { method: 'electron' };
    console.warn('Electron silent print failed:', result.error, '— falling back');
    // Fall through to browser print as last resort
  }

  // 3. QZ Tray (web browser)
  if (!window.electronAPI) {
    const restaurantId = localStorage.getItem('restaurantId');
    const saved = JSON.parse(localStorage.getItem(`printer_settings_${restaurantId}`) || '{}');
    if (saved.useQZTray) {
      const printerName = type === 'kitchen' ? saved.qzKitchenPrinter : saved.qzBillPrinter;
      if (printerName) {
        const ok = await qzPrint(html, printerName);
        if (ok) return { method: 'qz' };
      }
    }
  }

  // 4. Browser fallback
  browserPrint(html);
  return { method: 'browser' };
}
