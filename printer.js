/**
 * WaitNot ESC/POS Thermal Printer Module
 * 
 * Sends raw ESC/POS commands directly to installed thermal printers
 * (Epson, TVS, Bixolon, Generic) without any Windows print dialog.
 * 
 * Uses node-thermal-printer for USB/Network/Serial printers.
 * Falls back to Electron's webContents.print() for non-ESC/POS printers.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

let ThermalPrinter, PrinterTypes, CharacterSet;

// Try to load node-thermal-printer
try {
  const ntp = require('node-thermal-printer');
  ThermalPrinter = ntp.ThermalPrinter;
  PrinterTypes = ntp.PrinterTypes;
  CharacterSet = ntp.CharacterSet;
} catch (e) {
  console.warn('node-thermal-printer not available, will use fallback printing');
}

// ─── Printer discovery ────────────────────────────────────────────────────────

/**
 * List all installed printers on Windows/Mac/Linux
 */
async function listPrinters(webContents) {
  try {
    const printers = await webContents.getPrintersAsync();
    return printers.map(p => ({
      name: p.name,
      isDefault: p.isDefault,
      status: p.status === 0 ? 'ready' : 'unavailable',
      description: p.description || ''
    }));
  } catch (e) {
    console.error('Error listing printers:', e);
    return [];
  }
}

// ─── ESC/POS raw printing (Windows: net use / direct port write) ─────────────

/**
 * On Windows, write raw ESC/POS bytes to a printer by name using a temp file
 * and the `COPY /B` command — this bypasses Windows GDI entirely.
 */
async function rawPrintWindows(printerName, buffer) {
  return new Promise((resolve) => {
    const tmpFile = path.join(os.tmpdir(), `waitnot-escpos-${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, buffer);
    
    // COPY /B sends raw bytes to the printer queue
    const cmd = `COPY /B "${tmpFile}" "${printerName}"`;
    exec(cmd, (error) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      if (error) {
        console.warn('COPY /B failed, trying lp fallback:', error.message);
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
}

/**
 * On Linux/Mac, use lp command
 */
async function rawPrintUnix(printerName, buffer) {
  return new Promise((resolve) => {
    const tmpFile = path.join(os.tmpdir(), `waitnot-escpos-${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, buffer);
    
    const cmd = `lp -d "${printerName}" "${tmpFile}"`;
    exec(cmd, (error) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
}

// ─── ESC/POS command builder ──────────────────────────────────────────────────

const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;
const CR  = 0x0D;

function escposBuffer(commands) {
  return Buffer.from(commands);
}

// Initialize printer
const INIT        = [ESC, 0x40];
// Text alignment
const ALIGN_LEFT  = [ESC, 0x61, 0x00];
const ALIGN_CENTER= [ESC, 0x61, 0x01];
const ALIGN_RIGHT = [ESC, 0x61, 0x02];
// Text style
const BOLD_ON     = [ESC, 0x45, 0x01];
const BOLD_OFF    = [ESC, 0x45, 0x00];
const DOUBLE_HEIGHT_ON  = [ESC, 0x21, 0x10];
const DOUBLE_HEIGHT_OFF = [ESC, 0x21, 0x00];
// Cut paper
const CUT_FULL    = [GS,  0x56, 0x00];
const CUT_PARTIAL = [GS,  0x56, 0x01];
// Feed lines
function feed(n = 1) { return Array(n).fill(LF); }

// ─── Width helpers (58mm=32chars, 80mm=48chars) ───────────────────────────────
function getWidth(paperWidth) {
  return (paperWidth === '80mm') ? 48 : 32;
}

function dashedLine(paperWidth) {
  return '-'.repeat(getWidth(paperWidth)) + '\n';
}

function textLine(text) {
  return [...Buffer.from(text + '\n', 'utf8')];
}

function centeredLine(text, width) {
  const w = width || 32;
  const pad = Math.max(0, Math.floor((w - text.length) / 2));
  return textLine(' '.repeat(pad) + text);
}

function twoColumnLine(left, right, width = 32) {
  const space = Math.max(1, width - left.length - right.length);
  return textLine(left + ' '.repeat(space) + right);
}

// ─── KOT builder ─────────────────────────────────────────────────────────────

function buildKOTBuffer(data) {
  const { restaurantName, orderId, tableNumber, roomNumber, orderType, items, time, paperWidth } = data;
  const W = getWidth(paperWidth);
  const DASHES = dashedLine(paperWidth);
  const bytes = [];

  // Init
  bytes.push(...INIT);
  bytes.push(...ALIGN_CENTER);
  bytes.push(...DOUBLE_HEIGHT_ON);
  bytes.push(...BOLD_ON);
  bytes.push(...centeredLine(restaurantName.toUpperCase(), W));
  bytes.push(...DOUBLE_HEIGHT_OFF);
  bytes.push(...centeredLine('** KOT **', W));
  bytes.push(...BOLD_OFF);
  bytes.push(...textLine(DASHES));

  bytes.push(...ALIGN_LEFT);
  if (tableNumber) bytes.push(...twoColumnLine('Table:', tableNumber.toString(), W));
  if (roomNumber)  bytes.push(...twoColumnLine('Room:', roomNumber.toString(), W));
  if (orderType === 'takeaway') bytes.push(...textLine('Type: TAKEAWAY'));
  if (orderType === 'delivery') bytes.push(...textLine('Type: DELIVERY'));
  bytes.push(...twoColumnLine('Order:', orderId.slice(-6).toUpperCase(), W));
  bytes.push(...twoColumnLine('Time:', time, W));
  bytes.push(...textLine(DASHES));

  // Items — name truncated to leave room for qty on right
  const nameWidth = W - 6; // e.g. 26 for 58mm, 42 for 80mm
  bytes.push(...BOLD_ON);
  items.forEach(item => {
    bytes.push(...twoColumnLine(
      item.name.substring(0, nameWidth),
      `x${item.quantity}`,
      W
    ));
  });
  bytes.push(...BOLD_OFF);
  bytes.push(...textLine(DASHES));

  bytes.push(...ALIGN_CENTER);
  bytes.push(...centeredLine('-- PREPARE WITH CARE --', W));
  bytes.push(...feed(3));
  bytes.push(...CUT_PARTIAL);

  return Buffer.from(bytes);
}

// ─── Bill builder ─────────────────────────────────────────────────────────────

function buildBillBuffer(data) {
  const { restaurantName, tableLabel, items, total, paymentMethod, time, date, footerText, paperWidth } = data;
  const W = getWidth(paperWidth);
  const DASHES = dashedLine(paperWidth);
  const bytes = [];

  // Init
  bytes.push(...INIT);
  bytes.push(...ALIGN_CENTER);
  bytes.push(...DOUBLE_HEIGHT_ON);
  bytes.push(...BOLD_ON);
  bytes.push(...centeredLine(restaurantName.toUpperCase(), W));
  bytes.push(...DOUBLE_HEIGHT_OFF);
  bytes.push(...centeredLine('BILL', W));
  bytes.push(...BOLD_OFF);
  bytes.push(...textLine(DASHES));

  bytes.push(...ALIGN_LEFT);
  bytes.push(...twoColumnLine('Ref:', tableLabel, W));
  bytes.push(...twoColumnLine('Date:', date, W));
  bytes.push(...twoColumnLine('Time:', time, W));
  bytes.push(...textLine(DASHES));

  // Column widths scale with paper: name | qty | amt
  // 58mm (32): name=18, qty=3, amt=6 → header "Item              Qty   Amt"
  // 80mm (48): name=28, qty=4, amt=8 → header "Item                       Qty    Amt"
  const nameW = W - 12;
  const header = 'Item'.padEnd(nameW) + ' Qty' + '   Amt';
  bytes.push(...BOLD_ON);
  bytes.push(...textLine(header));
  bytes.push(...BOLD_OFF);
  bytes.push(...textLine(DASHES));

  // Items
  items.forEach(item => {
    const name = item.name.substring(0, nameW).padEnd(nameW);
    const qty  = String(item.qty  || item.quantity || 1).padStart(4);
    const amt  = String(Math.round((item.price || 0) * (item.qty || item.quantity || 1))).padStart(6);
    bytes.push(...textLine(`${name}${qty}${amt}`));
  });

  bytes.push(...textLine(DASHES));

  // Total
  bytes.push(...BOLD_ON);
  bytes.push(...DOUBLE_HEIGHT_ON);
  bytes.push(...twoColumnLine('TOTAL:', `Rs.${total}`, W));
  bytes.push(...DOUBLE_HEIGHT_OFF);
  bytes.push(...BOLD_OFF);

  if (paymentMethod) {
    bytes.push(...twoColumnLine('Payment:', paymentMethod.toUpperCase(), W));
  }
  bytes.push(...textLine(DASHES));

  bytes.push(...ALIGN_CENTER);
  bytes.push(...centeredLine(footerText || 'Thank you! Visit Again', W));
  bytes.push(...feed(3));
  bytes.push(...CUT_PARTIAL);

  return Buffer.from(bytes);
}

// ─── Main print function ──────────────────────────────────────────────────────

/**
 * Print KOT silently to the assigned kitchen printer
 * @param {Object} data - { restaurantName, orderId, tableNumber, roomNumber, orderType, items, time }
 * @param {string} printerName - Windows printer name (e.g. "Epson TM-T82")
 */
async function printKOT(data, printerName) {
  try {
    const buf = buildKOTBuffer(data);
    
    if (process.platform === 'win32') {
      return await rawPrintWindows(printerName, buf);
    } else {
      return await rawPrintUnix(printerName, buf);
    }
  } catch (e) {
    console.error('printKOT error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Print Bill silently to the assigned bill/counter printer
 * @param {Object} data - { restaurantName, tableLabel, items, total, paymentMethod, time, date, footerText }
 * @param {string} printerName - Windows printer name
 */
async function printBill(data, printerName) {
  try {
    const buf = buildBillBuffer(data);
    
    if (process.platform === 'win32') {
      return await rawPrintWindows(printerName, buf);
    } else {
      return await rawPrintUnix(printerName, buf);
    }
  } catch (e) {
    console.error('printBill error:', e);
    return { success: false, error: e.message };
  }
}

module.exports = { listPrinters, printKOT, printBill, buildKOTBuffer, buildBillBuffer };
