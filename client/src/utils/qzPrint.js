import { BluetoothSerial } from '@ascentio-it/capacitor-bluetooth-serial';

/**
 * WaitNot Silent Printing Utility
 *
 * Priority:
 * 1. Electron ESC/POS (raw bytes → thermal driver, zero dialog) ← like Petpooja
 * 2. Android Bluetooth ESC/POS (Capacitor native)
 * 3. QZ Tray (web browser + QZ Tray service)
 * 4. Browser window.print() fallback
 */

// ─── QZ Tray ─────────────────────────────────────────────────────────────────

let qz = null;
let qzConnected = false;

function loadQZScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || window.Capacitor?.isNativePlatform?.()) {
      reject(new Error('QZ not available'));
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
  } catch { qzConnected = false; return false; }
}

export async function getPrinters() {
  // Electron: use native printer list
  if (window.electronAPI?.getPrinters) {
    const list = await window.electronAPI.getPrinters();
    return list.map(p => p.name);
  }
  if (!qzConnected) await connectQZ();
  if (!qzConnected) return [];
  try { return await qz.printers.find(); } catch { return []; }
}

export function isQZAvailable() { return qzConnected; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSavedSettings() {
  const restaurantId = localStorage.getItem('restaurantId')
    || JSON.parse(localStorage.getItem('staffData') || '{}').restaurant_id;
  return JSON.parse(localStorage.getItem(`printer_settings_${restaurantId}`) || '{}');
}

// ─── 1. Electron ESC/POS ─────────────────────────────────────────────────────

async function electronPrintKOT(order, restaurantName) {
  const saved = getSavedSettings();
  const printerName = saved.qzKitchenPrinter || saved.kitchenPrinterName || '';
  if (!printerName) return { success: false, error: 'No kitchen printer configured' };

  const now = new Date();
  const data = {
    restaurantName,
    orderId: order._id || 'N/A',
    tableNumber: order.tableNumber || null,
    roomNumber: order.roomNumber || null,
    orderType: order.orderType || 'dine-in',
    items: order.items.map(i => ({ name: i.name, quantity: i.quantity })),
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
  return await window.electronAPI.printKOT(data, printerName);
}

async function electronPrintBill(orders, tableLabel, total, restaurantName) {
  const saved = getSavedSettings();
  const printerName = saved.qzBillPrinter || saved.cashCounterPrinterName || '';
  if (!printerName) return { success: false, error: 'No bill printer configured' };

  // Merge items from all orders
  const itemMap = {};
  orders.forEach(o => o.items?.forEach(i => {
    if (itemMap[i.name]) itemMap[i.name].qty += i.quantity;
    else itemMap[i.name] = { name: i.name, qty: i.quantity, price: i.price };
  }));

  const now = new Date();
  const data = {
    restaurantName,
    tableLabel,
    items: Object.values(itemMap),
    total,
    paymentMethod: orders[0]?.paymentMethod || 'cash',
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    date: now.toLocaleDateString('en-IN'),
    footerText: 'Thank you! Visit Again',
  };
  return await window.electronAPI.printBill(data, printerName);
}

// ─── 2. Android Bluetooth ─────────────────────────────────────────────────────

async function bluetoothPrint(html, type) {
  try {
    const saved = getSavedSettings();
    const address = type === 'kitchen' ? saved.btKitchenPrinter : saved.btBillPrinter;
    if (!address) return { success: false, error: 'No BT printer configured' };

    const state = await BluetoothSerial.isEnabled();
    if (!state.enabled) await BluetoothSerial.enable();
    await BluetoothSerial.connect({ address });

    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.innerText.split('\n').filter(l => l.trim()).join('\n');
    await BluetoothSerial.write({ address, value: text + '\n\n\n\n' });
    await new Promise(r => setTimeout(r, 500));
    await BluetoothSerial.disconnect({ address });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── 3. QZ Tray ──────────────────────────────────────────────────────────────

async function qzPrintHTML(html, printerName) {
  if (!qzConnected) {
    const ok = await connectQZ();
    if (!ok) return false;
  }
  try {
    const config = qz.configs.create(printerName, {
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      size: { width: 80, height: null },
      units: 'mm',
      copies: 1,
      colorType: 'blackwhite',
    });
    await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
    return true;
  } catch (e) {
    console.error('QZ error:', e);
    return false;
  }
}

// ─── 4. Browser fallback ─────────────────────────────────────────────────────

function browserPrint(html) {
  const w = window.open('', '_blank', 'width=420,height=700');
  if (!w) {
    // Popup blocked — try iframe approach
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;visibility:hidden';
    document.body.appendChild(iframe);
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Use setTimeout instead of onload — more reliable after document.write
  setTimeout(() => {
    w.focus();
    w.print();
    w.onafterprint = () => w.close();
    setTimeout(() => { try { w.close(); } catch {} }, 5000);
  }, 350);
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * smartPrint — routes to the best available print method
 * 
 * @param {string} html - Rendered HTML for fallback printing
 * @param {string} type - 'kitchen' | 'bill'
 * @param {Object} [orderData] - { order, orders, tableLabel, total, restaurantName }
 *   Provide this for Electron ESC/POS path. Falls back to HTML if not given.
 */
export async function smartPrint(html, type = 'bill', orderData = null) {
  console.log(`🖨️ smartPrint [${type}]`);

  // 1. Electron ESC/POS — true silent thermal, no dialog
  if (window.electronAPI?.printKOT && orderData) {
    let result;
    if (type === 'kitchen' && orderData.order) {
      result = await electronPrintKOT(orderData.order, orderData.restaurantName);
    } else if (type === 'bill' && orderData.orders) {
      result = await electronPrintBill(
        orderData.orders, orderData.tableLabel,
        orderData.total, orderData.restaurantName
      );
    }
    if (result?.success) return { method: 'electron-escpos' };
    console.warn('ESC/POS failed:', result?.error, '— falling back to HTML print');
    // Fall through to silent HTML print
  }

  // 1b. Electron HTML silent print (when no orderData or ESC/POS failed)
  if (window.electronAPI?.silentPrint) {
    const saved = getSavedSettings();
    const printerName = type === 'kitchen'
      ? (saved.qzKitchenPrinter || saved.kitchenPrinterName || '')
      : (saved.qzBillPrinter || saved.cashCounterPrinterName || '');
    const result = await window.electronAPI.silentPrint(html, printerName);
    if (result?.success) return { method: 'electron-html' };
  }

  // 2. Android Bluetooth
  if (window.Capacitor?.isNativePlatform?.()) {
    const res = await bluetoothPrint(html, type);
    if (res.success) return { method: 'bluetooth' };
    alert('⚠️ Bluetooth printer not configured. Go to Settings → Bluetooth Printer.');
    return { method: 'none', error: res.error };
  }

  // 3. QZ Tray
  const saved = getSavedSettings();
  if (saved.useQZTray) {
    const printerName = type === 'kitchen' ? saved.qzKitchenPrinter : saved.qzBillPrinter;
    if (printerName) {
      const ok = await qzPrintHTML(html, printerName);
      if (ok) return { method: 'qz' };
    }
  }

  // 4. Browser fallback
  browserPrint(html);
  return { method: 'browser' };
}
