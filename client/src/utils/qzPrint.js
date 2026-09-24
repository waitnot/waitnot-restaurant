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

// ─── 2. Android Bluetooth ESC/POS ────────────────────────────────────────────

// ESC/POS command helpers
const ESC = '\x1B';
const GS  = '\x1D';
const INIT          = ESC + '@';           // Initialize printer
const BOLD_ON       = ESC + '\x45\x01';
const BOLD_OFF      = ESC + '\x45\x00';
const ALIGN_CENTER  = ESC + '\x61\x01';
const ALIGN_LEFT    = ESC + '\x61\x00';
const ALIGN_RIGHT   = ESC + '\x61\x02';
const FONT_NORMAL   = ESC + '\x21\x00';    // Normal size
const FONT_DOUBLE   = ESC + '\x21\x11';    // Double height+width
const FONT_LARGE    = ESC + '\x21\x10';    // Double height only
const CUT           = GS  + 'V\x42\x03';  // Partial cut
const LINE_FEED     = '\n';
const SEPARATOR_SOLID  = '================================\n';
const SEPARATOR_DASH   = '--------------------------------\n';

/** Pad/truncate string to fixed width */
function col(str, width, align = 'left') {
  const s = String(str || '').substring(0, width);
  const pad = width - s.length;
  if (align === 'right') return ' '.repeat(pad) + s;
  if (align === 'center') {
    const left = Math.floor(pad / 2);
    return ' '.repeat(left) + s + ' '.repeat(pad - left);
  }
  return s + ' '.repeat(pad);
}

/** Two-column row: left text + right text, total width 32 chars */
function twoCol(left, right, width = 32) {
  const r = String(right || '');
  const l = String(left || '').substring(0, width - r.length - 1);
  const pad = width - l.length - r.length;
  return l + ' '.repeat(Math.max(1, pad)) + r + LINE_FEED;
}

function buildKOTEscPos({ restaurantName, slotLabel, orderId, orderType, customerName, deliveryAddress, specialInstructions, items }) {
  const now = new Date();
  const d = now.toLocaleDateString('en-IN');
  const t = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const W = 32;

  let out = INIT;
  out += ALIGN_CENTER + FONT_DOUBLE + BOLD_ON;
  out += (restaurantName || 'RESTAURANT').toUpperCase().substring(0, 16) + LINE_FEED;
  out += FONT_NORMAL + BOLD_ON;
  out += '** KITCHEN ORDER TICKET **' + LINE_FEED;
  out += (orderType || 'ORDER').toUpperCase() + LINE_FEED;
  out += BOLD_OFF + SEPARATOR_SOLID;

  out += ALIGN_LEFT;
  if (slotLabel) out += BOLD_ON + twoCol('SLOT:', slotLabel, W) + BOLD_OFF;
  out += twoCol('DATE:', d, W);
  out += BOLD_ON + twoCol('TIME:', t, W) + BOLD_OFF;
  if (orderId) out += twoCol('REF:', String(orderId).slice(-6).toUpperCase(), W);
  if (customerName) out += twoCol('NAME:', customerName, W);
  if (deliveryAddress) out += 'ADDR: ' + deliveryAddress + LINE_FEED;

  out += SEPARATOR_SOLID;
  out += ALIGN_CENTER + BOLD_ON + '-- ITEMS TO PREPARE --' + LINE_FEED + BOLD_OFF;
  out += SEPARATOR_SOLID + ALIGN_LEFT;

  (items || []).forEach(item => {
    out += FONT_LARGE + BOLD_ON;
    out += twoCol(item.name.substring(0, 24), 'x' + item.quantity, W);
    out += FONT_NORMAL + BOLD_OFF;
  });

  out += SEPARATOR_SOLID;

  if (specialInstructions) {
    out += BOLD_ON + '! NOTE: ' + specialInstructions + LINE_FEED + BOLD_OFF;
    out += SEPARATOR_DASH;
  }

  out += ALIGN_CENTER + BOLD_ON + '-- PREPARE WITH CARE --' + LINE_FEED + BOLD_OFF;
  out += LINE_FEED + LINE_FEED + LINE_FEED + LINE_FEED;
  out += CUT;
  return out;
}

function buildBillEscPos({ restaurantName, slotLabel, orderType, customerName, customerPhone, deliveryAddress, items, packagingCharge = 0, deliveryCharge = 0, paymentMethod }) {
  const now = new Date();
  const d = now.toLocaleDateString('en-IN');
  const t = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const W = 32;

  const billItems = (items || []).map(i => ({
    ...i,
    price: parseFloat(i.price) || 0,
    quantity: parseInt(i.quantity) || 1,
  }));
  const subtotal = billItems.filter(i => !i.complimentary).reduce((s, i) => s + i.price * i.quantity, 0);
  const extra = (parseFloat(packagingCharge) || 0) + (parseFloat(deliveryCharge) || 0);
  const grandTotal = subtotal + extra;

  let out = INIT;
  out += ALIGN_CENTER + FONT_DOUBLE + BOLD_ON;
  out += (restaurantName || 'RESTAURANT').toUpperCase().substring(0, 16) + LINE_FEED;
  out += FONT_NORMAL + BOLD_ON;

  const receiptType = orderType === 'delivery' ? 'DELIVERY RECEIPT'
    : orderType === 'takeaway' ? 'TAKEAWAY RECEIPT'
    : orderType === 'room' ? 'ROOM RECEIPT' : 'DINE-IN RECEIPT';
  out += receiptType + LINE_FEED + BOLD_OFF + SEPARATOR_SOLID;

  out += ALIGN_LEFT;
  if (slotLabel) out += BOLD_ON + twoCol('SLOT:', slotLabel, W) + BOLD_OFF;
  out += twoCol('DATE:', d, W);
  out += twoCol('TIME:', t, W);
  if (customerName) out += twoCol('NAME:', customerName, W);
  if (customerPhone) out += twoCol('PHONE:', customerPhone, W);
  if (paymentMethod) out += BOLD_ON + twoCol('PAYMENT:', paymentMethod.toUpperCase(), W) + BOLD_OFF;
  if (deliveryAddress) out += 'ADDR: ' + deliveryAddress + LINE_FEED;

  out += SEPARATOR_SOLID;
  // Header row
  out += BOLD_ON + col('ITEM', 18) + col('QTY', 4, 'right') + col('AMT', 10, 'right') + LINE_FEED + BOLD_OFF;
  out += SEPARATOR_DASH;

  billItems.forEach(item => {
    const amt = item.complimentary ? 'COMP' : '₹' + (item.price * item.quantity).toFixed(0);
    out += col((item.name + (item.complimentary ? '★' : '')).substring(0, 18), 18)
         + col(String(item.quantity), 4, 'right')
         + col(amt, 10, 'right') + LINE_FEED;
  });

  out += SEPARATOR_SOLID;
  if (packagingCharge > 0) out += twoCol('PACKAGING:', '₹' + packagingCharge.toFixed(0), W);
  if (deliveryCharge > 0) out += twoCol('DELIVERY:', '₹' + deliveryCharge.toFixed(0), W);
  out += SEPARATOR_SOLID;

  out += ALIGN_CENTER + FONT_DOUBLE + BOLD_ON;
  out += 'TOTAL: ₹' + grandTotal.toFixed(0) + LINE_FEED;
  out += FONT_NORMAL + BOLD_OFF + SEPARATOR_SOLID;

  out += ALIGN_CENTER;
  out += 'THANK YOU! VISIT AGAIN' + LINE_FEED;
  out += '* * * * * * * *' + LINE_FEED;
  out += LINE_FEED + LINE_FEED + LINE_FEED + LINE_FEED;
  out += CUT;
  return out;
}

async function getBluetoothSerial() {
  const { BluetoothSerial } = await import('@ascentio-it/capacitor-bluetooth-serial');
  return BluetoothSerial;
}

async function ensureBluetoothReady(BT) {
  // Request runtime permissions (Android 12+ requires BLUETOOTH_SCAN + BLUETOOTH_CONNECT)
  // The plugin's checkBluetoothPermissions only checks — use Capacitor's requestPermissions as fallback
  try {
    const granted = await BT.checkBluetoothPermissions();
    if (!granted) {
      // Try to trigger permission request via Capacitor permissions API
      if (window.Capacitor?.Plugins?.Permissions) {
        try {
          await window.Capacitor.Plugins.Permissions.request({
            permissions: ['bluetooth', 'bluetoothScan', 'bluetoothConnect', 'location']
          });
        } catch (_) {}
      }
      // Also try the plugin's own event — some forks support this
      throw new Error('Bluetooth permissions not granted. Please allow Bluetooth permissions in Android Settings → Apps → WaitNot Captain → Permissions.');
    }
  } catch (e) {
    if (e.message && e.message.includes('permissions')) throw e;
    // checkBluetoothPermissions itself threw — ignore, proceed
  }

  // Ensure BT is enabled
  let state;
  try { state = await BT.isEnabled(); } catch (_) { state = { enabled: true }; }
  if (!state.enabled) {
    try {
      await BT.enable();
      await new Promise(r => setTimeout(r, 2000));
    } catch (_) {}
  }
}

async function connectBT(BT, address) {
  // Try secure connect first, fall back to insecure (most thermal printers need insecure)
  try {
    await BT.connect({ address });
  } catch (e) {
    console.warn('Secure BT connect failed, trying insecure:', e.message);
    await BT.connectInsecure({ address });
  }
}

async function bluetoothPrint(html, type, escPosData = null) {
  try {
    const saved = getSavedSettings();
    const address = type === 'kitchen' ? saved.btKitchenPrinter : saved.btBillPrinter;
    if (!address) return { success: false, error: 'No BT printer configured for ' + type };

    const BT = await getBluetoothSerial();
    await ensureBluetoothReady(BT);

    // Disconnect first in case still connected from previous print
    try { await BT.disconnect({ address }); } catch (_) {}
    await new Promise(r => setTimeout(r, 300));

    await connectBT(BT, address);
    await new Promise(r => setTimeout(r, 1000));

    // Build print data
    let printData;
    if (escPosData) {
      printData = escPosData;
    } else {
      const div = document.createElement('div');
      div.innerHTML = html;
      const lines = Array.from(div.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && el.textContent.trim())
        .map(el => el.textContent.trim());
      printData = INIT + ALIGN_CENTER + lines.join(LINE_FEED) + LINE_FEED.repeat(4) + CUT;
    }

    // Write in small chunks — BT SPP buffer is typically limited on cheap thermal printers
    const CHUNK = 200;
    for (let i = 0; i < printData.length; i += CHUNK) {
      await BT.write({ address, value: printData.slice(i, i + CHUNK) });
      await new Promise(r => setTimeout(r, 150));
    }

    await new Promise(r => setTimeout(r, 1500));
    try { await BT.disconnect({ address }); } catch (_) {}
    return { success: true };
  } catch (e) {
    console.error('BT print error:', e);
    return { success: false, error: e.message };
  }
}

/** Test BT connection — prints a test page */
export async function testBluetoothPrinter(address) {
  try {
    const BT = await getBluetoothSerial();
    await ensureBluetoothReady(BT);

    try { await BT.disconnect({ address }); } catch (_) {}
    await new Promise(r => setTimeout(r, 300));

    await connectBT(BT, address);
    await new Promise(r => setTimeout(r, 1000));

    const now = new Date();
    const testMsg = INIT
      + ALIGN_CENTER + BOLD_ON
      + '** PRINTER TEST **' + LINE_FEED + BOLD_OFF
      + '================\n'
      + now.toLocaleDateString('en-IN') + ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + LINE_FEED
      + '================\n'
      + BOLD_ON + 'CONNECTION OK!' + LINE_FEED + BOLD_OFF
      + 'WaitNot POS' + LINE_FEED
      + LINE_FEED + LINE_FEED + LINE_FEED + LINE_FEED
      + CUT;

    const CHUNK = 200;
    for (let i = 0; i < testMsg.length; i += CHUNK) {
      await BT.write({ address, value: testMsg.slice(i, i + CHUNK) });
      await new Promise(r => setTimeout(r, 150));
    }

    await new Promise(r => setTimeout(r, 1500));
    try { await BT.disconnect({ address }); } catch (_) {}
    return { success: true };
  } catch (e) {
    console.error('BT test error:', e);
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
  w.document.write(html);
  w.document.close();
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

  // 2. Android Bluetooth — with ESC/POS
  if (window.Capacitor?.isNativePlatform?.()) {
    let escPos = null;
    if (orderData) {
      try {
        if (type === 'kitchen' && orderData.order) {
          const o = orderData.order;
          escPos = buildKOTEscPos({
            restaurantName: orderData.restaurantName,
            slotLabel: o.tableNumber ? 'TABLE ' + o.tableNumber : o.roomNumber ? 'ROOM ' + o.roomNumber : (o.orderType || '').toUpperCase(),
            orderId: o._id,
            orderType: o.orderType,
            customerName: o.customerName,
            deliveryAddress: o.deliveryAddress,
            specialInstructions: o.specialInstructions,
            items: o.items,
          });
        } else if (type === 'bill' && orderData.orders) {
          const itemMap = {};
          orderData.orders.forEach(o => o.items?.forEach(i => {
            if (itemMap[i.name]) { itemMap[i.name].quantity += i.quantity; }
            else itemMap[i.name] = { name: i.name, quantity: i.quantity, price: i.price };
          }));
          const o0 = orderData.orders[0] || {};
          escPos = buildBillEscPos({
            restaurantName: orderData.restaurantName,
            slotLabel: orderData.tableLabel,
            orderType: o0.orderType,
            customerName: o0.customerName,
            customerPhone: o0.customerPhone,
            deliveryAddress: o0.deliveryAddress,
            items: Object.values(itemMap),
            packagingCharge: o0.packagingCharge,
            deliveryCharge: o0.deliveryCharge,
            paymentMethod: o0.paymentMethod,
          });
        }
      } catch (e) {
        console.warn('ESC/POS build failed, using plain fallback:', e);
      }
    }
    const res = await bluetoothPrint(html, type, escPos);
    if (res.success) return { method: 'bluetooth' };
    alert('⚠️ Bluetooth print failed: ' + (res.error || 'Unknown error') + '\n\nCheck Settings → Bluetooth Printer and ensure the printer is paired.');
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
