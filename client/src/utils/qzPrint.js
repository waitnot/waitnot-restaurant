/**
 * WaitNot Silent Printing Utility
 * Priority: 1. Electron  2. Android Bluetooth (plain text)  3. QZ Tray  4. Browser
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

// ─── 2. Android Bluetooth — plain text only ───────────────────────────────────
// IMPORTANT: ESC/POS binary bytes (\x1B etc.) get corrupted by the JS→JSON→Java
// bridge. We use plain ASCII text only — all thermal printers can print this.

function btCenter(text, width) {
  const s = String(text || '').substring(0, width);
  const pad = Math.max(0, Math.floor((width - s.length) / 2));
  return ' '.repeat(pad) + s;
}

function btLR(left, right, width) {
  const l = String(left || '');
  const r = String(right || '');
  const gap = Math.max(1, width - l.length - r.length);
  return l + ' '.repeat(gap) + r;
}

function btSep(width, ch) { return ch.repeat(width); }

function buildKOTText(params) {
  const { restaurantName, slotLabel, orderId, orderType, customerName, deliveryAddress, specialInstructions, items } = params;
  const now = new Date();
  const W = 32;
  const lines = [
    btSep(W, '='),
    btCenter(restaurantName || 'RESTAURANT', W),
    btCenter('KITCHEN ORDER TICKET', W),
  ];
  if (orderType) lines.push(btCenter(orderType.toUpperCase(), W));
  lines.push(btSep(W, '='));
  if (slotLabel) lines.push(btLR('SLOT:', slotLabel, W));
  lines.push(btLR('DATE:', now.toLocaleDateString('en-IN'), W));
  lines.push(btLR('TIME:', now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), W));
  if (orderId) lines.push(btLR('REF:', String(orderId).slice(-8).toUpperCase(), W));
  if (customerName) lines.push(btLR('NAME:', customerName, W));
  if (deliveryAddress) lines.push('ADDR: ' + deliveryAddress);
  lines.push(btSep(W, '='));
  lines.push(btCenter('-- ITEMS TO PREPARE --', W));
  lines.push(btSep(W, '='));
  (items || []).forEach(item => {
    lines.push(btLR(String(item.name).substring(0, 24), 'x' + item.quantity, W));
  });
  lines.push(btSep(W, '='));
  if (specialInstructions) { lines.push('NOTE: ' + specialInstructions); lines.push(btSep(W, '-')); }
  lines.push(btCenter('PREPARE WITH CARE', W));
  lines.push(''); lines.push(''); lines.push(''); lines.push('');
  return lines.join('\n') + '\n';
}

function buildBillText(params) {
  const { restaurantName, slotLabel, orderType, customerName, customerPhone, deliveryAddress, items, packagingCharge, deliveryCharge, paymentMethod } = params;
  const now = new Date();
  const W = 32;
  const billItems = (items || []).map(i => ({ ...i, price: parseFloat(i.price) || 0, quantity: parseInt(i.quantity) || 1 }));
  const subtotal = billItems.filter(i => !i.complimentary).reduce((s, i) => s + i.price * i.quantity, 0);
  const extra = (parseFloat(packagingCharge) || 0) + (parseFloat(deliveryCharge) || 0);
  const grandTotal = subtotal + extra;
  const receiptType = orderType === 'delivery' ? 'DELIVERY RECEIPT' : orderType === 'takeaway' ? 'TAKEAWAY RECEIPT' : orderType === 'room' ? 'ROOM RECEIPT' : 'DINE-IN RECEIPT';
  const lines = [
    btSep(W, '='), btCenter(restaurantName || 'RESTAURANT', W), btCenter(receiptType, W), btSep(W, '='),
  ];
  if (slotLabel) lines.push(btLR('SLOT:', slotLabel, W));
  lines.push(btLR('DATE:', now.toLocaleDateString('en-IN'), W));
  lines.push(btLR('TIME:', now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), W));
  if (customerName) lines.push(btLR('NAME:', customerName, W));
  if (customerPhone) lines.push(btLR('PHONE:', customerPhone, W));
  if (paymentMethod) lines.push(btLR('PAYMENT:', paymentMethod.toUpperCase(), W));
  if (deliveryAddress) lines.push('ADDR: ' + deliveryAddress);
  lines.push(btSep(W, '='));
  lines.push(btLR('ITEM', 'AMT', W));
  lines.push(btSep(W, '-'));
  billItems.forEach(item => {
    const amt = item.complimentary ? 'COMP' : 'Rs.' + (item.price * item.quantity).toFixed(0);
    lines.push(btLR(item.name.substring(0, 20) + ' x' + item.quantity, amt, W));
  });
  lines.push(btSep(W, '='));
  if (packagingCharge > 0) lines.push(btLR('PACKAGING:', 'Rs.' + Number(packagingCharge).toFixed(0), W));
  if (deliveryCharge > 0) lines.push(btLR('DELIVERY:', 'Rs.' + Number(deliveryCharge).toFixed(0), W));
  lines.push(btLR('TOTAL:', 'Rs.' + grandTotal.toFixed(0), W));
  lines.push(btSep(W, '='));
  lines.push(btCenter('THANK YOU! VISIT AGAIN', W));
  lines.push(''); lines.push(''); lines.push(''); lines.push('');
  return lines.join('\n') + '\n';
}

async function getBT() {
  const { BluetoothSerial } = await import('@ascentio-it/capacitor-bluetooth-serial');
  return BluetoothSerial;
}

async function btConnect(BT, address) {
  try {
    await BT.connect({ address });
  } catch (e) {
    console.warn('Secure connect failed, trying insecure:', e.message);
    await BT.connectInsecure({ address });
  }
}

async function btSend(BT, address, text) {
  const CHUNK = 100;
  for (let i = 0; i < text.length; i += CHUNK) {
    await BT.write({ address, value: text.slice(i, i + CHUNK) });
    await new Promise(r => setTimeout(r, 80));
  }
}

async function bluetoothPrint(html, type, textData) {
  try {
    const saved = getSavedSettings();
    const address = type === 'kitchen' ? saved.btKitchenPrinter : saved.btBillPrinter;
    if (!address) return { success: false, error: 'No BT printer selected in Settings' };

    const BT = await getBT();
    try { const s = await BT.isEnabled(); if (!s.enabled) { await BT.enable(); await new Promise(r => setTimeout(r, 2000)); } } catch (_) {}
    try { await BT.disconnect({ address }); } catch (_) {}
    await new Promise(r => setTimeout(r, 400));
    await btConnect(BT, address);
    await new Promise(r => setTimeout(r, 600));

    const printText = textData || (() => {
      const div = document.createElement('div');
      div.innerHTML = html;
      return (div.innerText || div.textContent || '').trim() + '\n\n\n\n';
    })();

    await btSend(BT, address, printText);
    await new Promise(r => setTimeout(r, 1200));
    try { await BT.disconnect({ address }); } catch (_) {}
    return { success: true };
  } catch (e) {
    console.error('BT print error:', e);
    return { success: false, error: e.message };
  }
}

export async function testBluetoothPrinter(address) {
  try {
    const BT = await getBT();
    try { const s = await BT.isEnabled(); if (!s.enabled) { await BT.enable(); await new Promise(r => setTimeout(r, 2000)); } } catch (_) {}
    try { await BT.disconnect({ address }); } catch (_) {}
    await new Promise(r => setTimeout(r, 400));
    await btConnect(BT, address);
    await new Promise(r => setTimeout(r, 600));

    const now = new Date();
    const W = 32;
    const testText = [
      btSep(W, '='), btCenter('PRINTER TEST', W), btSep(W, '='),
      btCenter(now.toLocaleDateString('en-IN') + ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), W),
      btSep(W, '-'), btCenter('CONNECTION OK', W), btCenter('WaitNot POS', W),
      btSep(W, '='), '', '', '', '',
    ].join('\n') + '\n';

    await btSend(BT, address, testText);
    await new Promise(r => setTimeout(r, 1200));
    try { await BT.disconnect({ address }); } catch (_) {}
    return { success: true };
  } catch (e) {
    console.error('BT test error:', e);
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

  // 1. Electron ESC/POS
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

  // 2. Android Bluetooth — plain text
  if (window.Capacitor?.isNativePlatform?.()) {
    let textData = null;
    if (orderData) {
      try {
        if (type === 'kitchen' && orderData.order) {
          const o = orderData.order;
          textData = buildKOTText({
            restaurantName: orderData.restaurantName,
            slotLabel: o.tableNumber ? 'TABLE ' + o.tableNumber : o.roomNumber ? 'ROOM ' + o.roomNumber : (o.orderType || '').toUpperCase(),
            orderId: o._id, orderType: o.orderType, customerName: o.customerName,
            deliveryAddress: o.deliveryAddress, specialInstructions: o.specialInstructions, items: o.items,
          });
        } else if (type === 'bill' && orderData.orders) {
          const itemMap = {};
          orderData.orders.forEach(o => o.items?.forEach(i => {
            if (itemMap[i.name]) itemMap[i.name].quantity += i.quantity;
            else itemMap[i.name] = { name: i.name, quantity: i.quantity, price: i.price };
          }));
          const o0 = orderData.orders[0] || {};
          textData = buildBillText({
            restaurantName: orderData.restaurantName, slotLabel: orderData.tableLabel,
            orderType: o0.orderType, customerName: o0.customerName, customerPhone: o0.customerPhone,
            deliveryAddress: o0.deliveryAddress, items: Object.values(itemMap),
            packagingCharge: o0.packagingCharge, deliveryCharge: o0.deliveryCharge, paymentMethod: o0.paymentMethod,
          });
        }
      } catch (e) { console.warn('BT text build failed:', e); }
    }
    const res = await bluetoothPrint(html, type, textData);
    if (res.success) return { method: 'bluetooth' };
    alert('Bluetooth print failed: ' + (res.error || 'Unknown error') + '\n\nMake sure printer is paired and selected in Settings.');
    return { method: 'none', error: res.error };
  }

  // 3. QZ Tray
  const saved = getSavedSettings();
  if (saved.useQZTray) {
    const printerName = type === 'kitchen' ? saved.qzKitchenPrinter : saved.qzBillPrinter;
    if (printerName) { const ok = await qzPrintHTML(html, printerName); if (ok) return { method: 'qz' }; }
  }

  // 4. Browser fallback
  browserPrint(html);
  return { method: 'browser' };
}
