/**
 * Desktop print handler.
 *
 * Print path for KOT / Bill on PC:
 *   1. Build raw ESC/POS bytes via escpos-bytes.js  (same code as mobile)
 *   2. Convert bytes → hex string
 *   3. Send hex to printer via:
 *      a) pdf-to-printer raw (Windows)   — identical output to mobile BT
 *      b) TCP socket to printer IP:9100  — for network/WiFi printers
 *      c) BrowserWindow silent print     — HTML fallback (silentPrint IPC)
 *
 * The byte builder (escpos-bytes.js) is a direct port of the mobile
 * buildKOTBytes / buildBillBytes from client/src/utils/qzPrint.js.
 * W=32, Rs. currency, names truncated (never wrapped).
 */

'use strict';

const { BrowserWindow }                    = require('electron');
const net                                  = require('net');
const { buildKOTBytes, buildBillBytes, toHex } = require('./escpos-bytes');
const { buildKOTEscPos, buildBillEscPos }  = require('./escpos-builder'); // HTML fallback

// ── Paper / width helpers ─────────────────────────────────────────────────────

function resolveWidth(data, printerName) {
  if (data?.paperWidth === '58mm' || data?.paperWidth === '80mm') return data.paperWidth;
  if (printerName?.toLowerCase().includes('80')) return '80mm';
  return '58mm';
}

function viewportPx(width) { return width === '58mm' ? 220 : 304; }

function thermalPageSize(width) {
  return width === '58mm'
    ? { width: 58000,  height: 2970000 }
    : { width: 80000,  height: 2970000 };
}

// ── Raw TCP send (WiFi / network printer) ────────────────────────────────────

function sendRawTCP(ip, port, hexStr) {
  return new Promise((resolve, reject) => {
    const buf  = Buffer.from(hexStr, 'hex');
    const sock = new net.Socket();
    sock.setTimeout(10000);
    sock.connect(port || 9100, ip, () => {
      sock.write(buf, () => { sock.destroy(); resolve(); });
    });
    sock.on('error',   err  => { sock.destroy(); reject(err); });
    sock.on('timeout', ()   => { sock.destroy(); reject(new Error('TCP timeout')); });
  });
}

// ── Try pdf-to-printer raw bytes (Windows) ───────────────────────────────────

async function sendRawWindows(printerName, hexStr) {
  // pdf-to-printer can send a raw Buffer to a named Windows printer
  const buf = Buffer.from(hexStr, 'hex');
  const tmp = require('os').tmpdir() + '\\waitnot_print_' + Date.now() + '.bin';
  require('fs').writeFileSync(tmp, buf);
  try {
    const print = require('pdf-to-printer');
    await print.print(tmp, { printer: printerName, sumatraPath: undefined });
    require('fs').unlinkSync(tmp);
    return true;
  } catch {
    try { require('fs').unlinkSync(tmp); } catch { /* ignore */ }
    return false;
  }
}

// ── Silent HTML fallback (BrowserWindow) ─────────────────────────────────────

function silentPrintHTML(html, printerName, width) {
  const vpWidth = viewportPx(width);
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      show: false, width: vpWidth, height: 1200,
      webPreferences: { nodeIntegration: false, contextIsolation: true, javascript: true },
    });
    const meta   = `<meta name="viewport" content="width=${vpWidth},initial-scale=1.0">`;
    const fixed  = html.includes('<meta name="viewport"') ? html : html.replace('<head>', '<head>' + meta);
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fixed));
    win.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        win.webContents.print(
          { silent: true, printBackground: true, deviceName: printerName || '',
            margins: { marginType: 'none' }, pageSize: thermalPageSize(width),
            scaleFactor: 100, landscape: false },
          (ok, reason) => {
            win.destroy();
            ok ? resolve({ success: true }) : resolve({ success: false, error: reason });
          }
        );
      }, 200);
    });
    win.webContents.on('did-fail-load', (_e, _c, desc) => {
      win.destroy(); resolve({ success: false, error: desc });
    });
    setTimeout(() => {
      if (!win.isDestroyed()) { win.destroy(); resolve({ success: false, error: 'Timeout' }); }
    }, 15000);
  });
}

// ── Core: build bytes → send → fallback ──────────────────────────────────────

async function printEscPosBytes(hexStr, data, printerName) {
  // 1. Try Windows raw printer
  if (process.platform === 'win32' && printerName) {
    const ok = await sendRawWindows(printerName, hexStr);
    if (ok) return { success: true, method: 'raw-win32' };
  }

  // 2. Try WiFi TCP (if wifiPrinterIp in data)
  if (data?.wifiPrinterIp) {
    try {
      await sendRawTCP(data.wifiPrinterIp, data.wifiPrinterPort || 9100, hexStr);
      return { success: true, method: 'wifi-tcp' };
    } catch (e) {
      console.warn('[print] TCP failed:', e.message);
    }
  }

  // 3. HTML fallback — not ideal but keeps the receipt printed
  console.warn('[print] Falling back to HTML render for', printerName || 'default printer');
  return null; // caller uses HTML fallback
}

// ── Printer list ──────────────────────────────────────────────────────────────

function getPrinters() {
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) return wins[0].webContents.getPrintersAsync();
  return new Promise(resolve => {
    const w = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    w.loadURL('about:blank');
    w.webContents.once('did-finish-load', async () => {
      const list = await w.webContents.getPrintersAsync();
      w.destroy(); resolve(list);
    });
  });
}

// ── IPC registration ──────────────────────────────────────────────────────────

function setupPrintHandlers(ipcMain) {

  ipcMain.handle('print:get-printers', async () => {
    try { return await getPrinters(); }
    catch (e) { return []; }
  });

  // HTML path — used by silentPrint fallback in qzPrint.js
  ipcMain.handle('print:silent-html', async (_e, { html, printerName }) => {
    try {
      if (!html) return { success: false, error: 'No HTML' };
      const width = resolveWidth(null, printerName);
      return await silentPrintHTML(html, printerName || '', width);
    } catch (e) { return { success: false, error: e.message }; }
  });

  // KOT — ESC/POS bytes (same as mobile), HTML fallback if raw fails
  ipcMain.handle('print:kot', async (_e, { data, printerName }) => {
    try {
      if (!data) return { success: false, error: 'No KOT data' };

      // Build raw ESC/POS bytes — identical to mobile
      const byteArr = buildKOTBytes({
        restaurantName:      data.restaurantName,
        slotLabel:           data.slotLabel
                               || (data.tableNumber ? 'TABLE ' + data.tableNumber
                               :   data.roomNumber  ? 'ROOM '  + data.roomNumber
                               :   (data.orderType  || 'ORDER').toUpperCase()),
        orderId:             data.orderId,
        orderType:           data.orderType,
        customerName:        data.customerName,
        deliveryAddress:     data.deliveryAddress,
        specialInstructions: data.specialInstructions,
        items:               data.items || [],
      });
      const hex = toHex(byteArr);

      const raw = await printEscPosBytes(hex, data, printerName);
      if (raw) return raw;

      // HTML fallback
      const width = resolveWidth(data, printerName);
      const html  = buildKOTEscPos(data, width);
      return await silentPrintHTML(html, printerName || '', width);

    } catch (e) { return { success: false, error: e.message }; }
  });

  // Bill — ESC/POS bytes (same as mobile), HTML fallback if raw fails
  ipcMain.handle('print:bill', async (_e, { data, printerName }) => {
    try {
      if (!data) return { success: false, error: 'No bill data' };

      // Normalise items — desktop sends {qty} field, builder expects {quantity}
      const items = (data.items || []).map(i => ({
        name:         i.name,
        price:        parseFloat(i.price)          || 0,
        quantity:     parseInt(i.quantity || i.qty) || 1,
        complimentary: !!i.complimentary,
      }));

      // Build raw ESC/POS bytes — identical to mobile
      const byteArr = buildBillBytes({
        restaurantName:  data.restaurantName,
        slotLabel:       data.tableLabel || data.slotLabel,
        orderType:       data.orderType,
        customerName:    data.customerName,
        customerPhone:   data.customerPhone,
        deliveryAddress: data.deliveryAddress,
        paymentMethod:   data.paymentMethod,
        packagingCharge: data.packagingCharge,
        deliveryCharge:  data.deliveryCharge,
        items,
      });
      const hex = toHex(byteArr);

      const raw = await printEscPosBytes(hex, data, printerName);
      if (raw) return raw;

      // HTML fallback
      const width = resolveWidth(data, printerName);
      const html  = buildBillEscPos(data, width);
      return await silentPrintHTML(html, printerName || '', width);

    } catch (e) { return { success: false, error: e.message }; }
  });
}

module.exports = { setupPrintHandlers };
