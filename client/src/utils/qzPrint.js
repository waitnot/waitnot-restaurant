/**
 * WaitNot Silent Printing Utility
 * Priority: 1. Electron  2. Android EscPos plugin (hex ESC/POS)  3. QZ Tray  4. Browser
 */

// ─── QZ Tray ──────────────────────────────────────────────────────────────────
let qz = null;
let qzConnected = false;

function loadQZScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || window.Capacitor?.isNativePlatform?.()) {
      reject(new Error('QZ not available')); return;
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
    qzConnected = true; return true;
  } catch { qzConnected = false; return false; }
}

export async function getPrinters() {
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
  return JSON.parse(localStorage.getItem('printer_settings_' + restaurantId) || '{}');
}

// ─── 1. Electron ──────────────────────────────────────────────────────────────
async function electronPrintKOT(order, restaurantName) {
  const saved = getSavedSettings();
  const printerName = saved.qzKitchenPrinter || saved.kitchenPrinterName || '';
  if (!printerName) return { success: false, error: 'No kitchen printer configured' };
  const now = new Date();
  return await window.electronAPI.printKOT({
    restaurantName, orderId: order._id || 'N/A',
    tableNumber: order.tableNumber || null, roomNumber: order.roomNumber || null,
    orderType: order.orderType || 'dine-in',
    items: order.items.map(i => ({ name: i.name, quantity: i.quantity })),
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  }, printerName);
}

async function electronPrintBill(orders, tableLabel, total, restaurantName) {
  const saved = getSavedSettings();
  const printerName = saved.qzBillPrinter || saved.cashCounterPrinterName || '';
  if (!printerName) return { success: false, error: 'No bill printer configured' };
  const itemMap = {};
  orders.forEach(o => o.items?.forEach(i => {
    if (itemMap[i.name]) itemMap[i.name].qty += i.quantity;
    else itemMap[i.name] = { name: i.name, qty: i.quantity, price: i.price };
  }));
  const now = new Date();
  return await window.electronAPI.printBill({
    restaurantName, tableLabel, items: Object.values(itemMap), total,
    paymentMethod: orders[0]?.paymentMethod || 'cash',
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    date: now.toLocaleDateString('en-IN'), footerText: 'Thank you! Visit Again',
  }, printerName);
}

// ─── 2. Android ESC/POS via EscPosPlugin (hex encoded) ───────────────────────
// We encode ESC/POS bytes as hex string so they survive the JS→JSON→Java bridge.
// The native EscPosPlugin.java decodes hex back to raw bytes before writing.

const B = {
  INIT:         [0x1B, 0x40],
  BOLD_ON:      [0x1B, 0x45, 0x01],
  BOLD_OFF:     [0x1B, 0x45, 0x00],
  CENTER:       [0x1B, 0x61, 0x01],
  LEFT:         [0x1B, 0x61, 0x00],
  DOUBLE_ON:    [0x1B, 0x21, 0x11],
  DOUBLE_OFF:   [0x1B, 0x21, 0x00],
  CUT:          [0x1D, 0x56, 0x42, 0x03],
  LF:           [0x0A],
};

function bytes(...parts) {
  const out = [];
  for (const p of parts) {
    if (Array.isArray(p)) out.push(...p);
    else if (typeof p === 'string') {
      for (let i = 0; i < p.length; i++) out.push(p.charCodeAt(i) & 0xFF);
    } else if (typeof p === 'number') out.push(p & 0xFF);
  }
  return out;
}

function toHex(byteArr) {
  return byteArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

function lf() { return bytes(B.LF); }
function line(text) { return bytes(text, B.LF); }

function centerLine(text, width) {
  const s = String(text || '').substring(0, width);
  const pad = Math.max(0, Math.floor((width - s.length) / 2));
  return line(' '.repeat(pad) + s);
}

function lrLine(left, right, width) {
  const l = String(left || '');
  const r = String(right || '');
  const gap = Math.max(1, width - l.length - r.length);
  return line(l + ' '.repeat(gap) + r);
}

function sepLine(width, ch) { return line(ch.repeat(width)); }

function buildKOTBytes(params) {
  const { restaurantName, slotLabel, orderId, orderType, customerName, deliveryAddress, specialInstructions, items } = params;
  const now = new Date();
  const d = now.toLocaleDateString('en-IN');
  const t = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const W = 32;

  return bytes(
    B.INIT,
    B.CENTER, B.DOUBLE_ON, B.BOLD_ON,
    line((restaurantName || 'RESTAURANT').toUpperCase().substring(0, 16)),
    B.DOUBLE_OFF,
    line('KITCHEN ORDER TICKET'),
    orderType ? line(orderType.toUpperCase()) : [],
    B.BOLD_OFF,
    sepLine(W, '='),
    B.LEFT,
    slotLabel ? bytes(B.BOLD_ON, lrLine('SLOT:', slotLabel, W), B.BOLD_OFF) : [],
    lrLine('DATE:', d, W),
    bytes(B.BOLD_ON, lrLine('TIME:', t, W), B.BOLD_OFF),
    orderId ? lrLine('REF:', String(orderId).slice(-8).toUpperCase(), W) : [],
    customerName ? lrLine('NAME:', customerName, W) : [],
    deliveryAddress ? line('ADDR: ' + deliveryAddress) : [],
    sepLine(W, '='),
    B.CENTER, B.BOLD_ON, line('-- ITEMS TO PREPARE --'), B.BOLD_OFF,
    sepLine(W, '='),
    B.LEFT,
    ...(items || []).map(item => bytes(
      B.BOLD_ON,
      lrLine(String(item.name).substring(0, 24), 'x' + item.quantity, W),
      B.BOLD_OFF,
    )),
    sepLine(W, '='),
    specialInstructions ? bytes(B.BOLD_ON, line('NOTE: ' + specialInstructions), B.BOLD_OFF, sepLine(W, '-')) : [],
    B.CENTER, B.BOLD_ON, line('PREPARE WITH CARE'), B.BOLD_OFF,
    lf(), lf(), lf(), lf(),
    B.CUT,
  );
}

function buildBillBytes(params) {
  const { restaurantName, slotLabel, orderType, customerName, customerPhone, deliveryAddress, items, packagingCharge, deliveryCharge, paymentMethod } = params;
  const now = new Date();
  const d = now.toLocaleDateString('en-IN');
  const t = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const W = 32;

  const billItems = (items || []).map(i => ({ ...i, price: parseFloat(i.price) || 0, quantity: parseInt(i.quantity) || 1 }));
  const subtotal = billItems.filter(i => !i.complimentary).reduce((s, i) => s + i.price * i.quantity, 0);
  const extra = (parseFloat(packagingCharge) || 0) + (parseFloat(deliveryCharge) || 0);
  const grandTotal = subtotal + extra;
  const receiptType = orderType === 'delivery' ? 'DELIVERY RECEIPT' : orderType === 'takeaway' ? 'TAKEAWAY RECEIPT' : orderType === 'room' ? 'ROOM RECEIPT' : 'DINE-IN RECEIPT';

  return bytes(
    B.INIT,
    B.CENTER, B.DOUBLE_ON, B.BOLD_ON,
    line((restaurantName || 'RESTAURANT').toUpperCase().substring(0, 16)),
    B.DOUBLE_OFF, line(receiptType), B.BOLD_OFF,
    sepLine(W, '='),
    B.LEFT,
    slotLabel ? bytes(B.BOLD_ON, lrLine('SLOT:', slotLabel, W), B.BOLD_OFF) : [],
    lrLine('DATE:', d, W),
    lrLine('TIME:', t, W),
    customerName ? lrLine('NAME:', customerName, W) : [],
    customerPhone ? lrLine('PHONE:', customerPhone, W) : [],
    paymentMethod ? bytes(B.BOLD_ON, lrLine('PAYMENT:', paymentMethod.toUpperCase(), W), B.BOLD_OFF) : [],
    deliveryAddress ? line('ADDR: ' + deliveryAddress) : [],
    sepLine(W, '='),
    bytes(B.BOLD_ON, lrLine('ITEM', 'AMT', W), B.BOLD_OFF),
    sepLine(W, '-'),
    ...billItems.map(item => {
      const amt = item.complimentary ? 'COMP' : 'Rs.' + (item.price * item.quantity).toFixed(0);
      return lrLine(item.name.substring(0, 20) + ' x' + item.quantity, amt, W);
    }),
    sepLine(W, '='),
    packagingCharge > 0 ? lrLine('PACKAGING:', 'Rs.' + Number(packagingCharge).toFixed(0), W) : [],
    deliveryCharge > 0 ? lrLine('DELIVERY:', 'Rs.' + Number(deliveryCharge).toFixed(0), W) : [],
    bytes(B.BOLD_ON, B.DOUBLE_ON, lrLine('TOTAL:', 'Rs.' + grandTotal.toFixed(0), W), B.DOUBLE_OFF, B.BOLD_OFF),
    sepLine(W, '='),
    B.CENTER, line('THANK YOU! VISIT AGAIN'), line('* * * * * * * *'),
    lf(), lf(), lf(), lf(),
    B.CUT,
  );
}

// Cache the plugin instance
let _escPosPlugin = null;
async function getEscPosPlugin() {
  if (_escPosPlugin) return _escPosPlugin;
  // Use Capacitor.Plugins to access the natively registered plugin
  if (window.Capacitor?.Plugins?.EscPos) {
    _escPosPlugin = window.Capacitor.Plugins.EscPos;
    return _escPosPlugin;
  }
  // Fallback: registerPlugin for typed access
  const { registerPlugin } = await import('@capacitor/core');
  _escPosPlugin = registerPlugin('EscPos');
  return _escPosPlugin;
}

async function escPosPrint(address, byteArr) {
  try {
    const EscPos = await getEscPosPlugin();
    const hex = toHex(byteArr);
    console.log('EscPos.printHex → address:', address, 'hex bytes:', byteArr.length);
    const result = await Promise.race([
      EscPos.printHex({ address, hex }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('No response from printer after 12 seconds. Make sure printer is ON and in range.')), 12000))
    ]);
    console.log('EscPos.printHex ← success');
    return { success: true };
  } catch (e) {
    console.error('EscPos.printHex error:', e);
    return { success: false, error: e.message || String(e) };
  }
}

export async function testBluetoothPrinter(address) {
  try {
    const now = new Date();
    const W = 32;
    const testBytes = bytes(
      B.INIT,
      B.CENTER, B.BOLD_ON,
      sepLine(W, '='),
      line('PRINTER TEST'),
      sepLine(W, '='),
      B.BOLD_OFF,
      centerLine(now.toLocaleDateString('en-IN') + ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), W),
      sepLine(W, '-'),
      bytes(B.BOLD_ON, line('CONNECTION OK'), B.BOLD_OFF),
      line('WaitNot POS'),
      sepLine(W, '='),
      lf(), lf(), lf(), lf(),
      B.CUT,
    );
    return await escPosPrint(address, testBytes);
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── 3. QZ Tray ──────────────────────────────────────────────────────────────
async function qzPrintHTML(html, printerName) {
  if (!qzConnected) { const ok = await connectQZ(); if (!ok) return false; }
  try {
    const config = qz.configs.create(printerName, { margins: { top: 0, right: 0, bottom: 0, left: 0 }, size: { width: 80, height: null }, units: 'mm', copies: 1, colorType: 'blackwhite' });
    await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
    return true;
  } catch (e) { console.error('QZ error:', e); return false; }
}

// ─── 4. Browser fallback ─────────────────────────────────────────────────────
function browserPrint(html) {
  const w = window.open('', '_blank', 'width=420,height=700');
  if (!w) {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;visibility:hidden';
    document.body.appendChild(iframe);
    iframe.contentDocument.write(html); iframe.contentDocument.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 300);
    return;
  }
  w.document.write(html); w.document.close();
  setTimeout(() => { w.focus(); w.print(); w.onafterprint = () => w.close(); setTimeout(() => { try { w.close(); } catch {} }, 5000); }, 350);
}

// ─── Main export ─────────────────────────────────────────────────────────────
export async function smartPrint(html, type = 'bill', orderData = null) {
  console.log('smartPrint [' + type + ']');

  // 1. Electron
  if (window.electronAPI?.printKOT && orderData) {
    let result;
    if (type === 'kitchen' && orderData.order) result = await electronPrintKOT(orderData.order, orderData.restaurantName);
    else if (type === 'bill' && orderData.orders) result = await electronPrintBill(orderData.orders, orderData.tableLabel, orderData.total, orderData.restaurantName);
    if (result?.success) return { method: 'electron-escpos' };
  }
  if (window.electronAPI?.silentPrint) {
    const saved = getSavedSettings();
    const printerName = type === 'kitchen' ? (saved.qzKitchenPrinter || saved.kitchenPrinterName || '') : (saved.qzBillPrinter || saved.cashCounterPrinterName || '');
    const result = await window.electronAPI.silentPrint(html, printerName);
    if (result?.success) return { method: 'electron-html' };
  }

  // 2. Android ESC/POS via native plugin
  if (window.Capacitor?.isNativePlatform?.()) {
    const saved = getSavedSettings();
    const address = type === 'kitchen' ? saved.btKitchenPrinter : saved.btBillPrinter;
    if (!address) {
      alert('No printer selected. Go to Settings and select a Bluetooth printer.');
      return { method: 'none', error: 'No printer selected' };
    }

    let byteArr = null;
    try {
      if (type === 'kitchen' && orderData?.order) {
        const o = orderData.order;
        byteArr = buildKOTBytes({
          restaurantName: orderData.restaurantName,
          slotLabel: o.tableNumber ? 'TABLE ' + o.tableNumber : o.roomNumber ? 'ROOM ' + o.roomNumber : (o.orderType || '').toUpperCase(),
          orderId: o._id, orderType: o.orderType, customerName: o.customerName,
          deliveryAddress: o.deliveryAddress, specialInstructions: o.specialInstructions, items: o.items,
        });
      } else if (type === 'bill' && orderData?.orders) {
        const itemMap = {};
        orderData.orders.forEach(o => o.items?.forEach(i => {
          if (itemMap[i.name]) itemMap[i.name].quantity += i.quantity;
          else itemMap[i.name] = { name: i.name, quantity: i.quantity, price: i.price };
        }));
        const o0 = orderData.orders[0] || {};
        byteArr = buildBillBytes({
          restaurantName: orderData.restaurantName, slotLabel: orderData.tableLabel,
          orderType: o0.orderType, customerName: o0.customerName, customerPhone: o0.customerPhone,
          deliveryAddress: o0.deliveryAddress, items: Object.values(itemMap),
          packagingCharge: o0.packagingCharge, deliveryCharge: o0.deliveryCharge, paymentMethod: o0.paymentMethod,
        });
      }
    } catch (e) { console.warn('ESC/POS build error:', e); }

    if (!byteArr) {
      // Fallback plain text
      const div = document.createElement('div');
      div.innerHTML = html;
      const text = (div.innerText || div.textContent || '').trim() + '\n\n\n\n';
      byteArr = [];
      for (let i = 0; i < text.length; i++) byteArr.push(text.charCodeAt(i) & 0xFF);
    }

    const res = await escPosPrint(address, byteArr);
    if (res.success) return { method: 'escpos-bt' };
    alert('Bluetooth print failed: ' + (res.error || 'Unknown') + '\n\nMake sure printer is paired and selected in Settings.');
    return { method: 'none', error: res.error };
  }

  // 3. QZ Tray
  const saved = getSavedSettings();
  if (saved.useQZTray) {
    const printerName = type === 'kitchen' ? saved.qzKitchenPrinter : saved.qzBillPrinter;
    if (printerName) { const ok = await qzPrintHTML(html, printerName); if (ok) return { method: 'qz' }; }
  }

  // 4. Browser
  browserPrint(html);
  return { method: 'browser' };
}
