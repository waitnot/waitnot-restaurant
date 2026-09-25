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
// Dashed line for 48-char width printer
const DASHES = '-'.repeat(32) + '\n';

function textLine(text) {
  return [...Buffer.from(text + '\n', 'utf8')];
}

function centeredLine(text, width = 32) {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return textLine(' '.repeat(pad) + text);
}

function twoColumnLine(left, right, width = 32) {
  const space = Math.max(1, width - left.length - right.length);
  return textLine(left + ' '.repeat(space) + right);
}

// ─── KOT builder ─────────────────────────────────────────────────────────────

function buildKOTBuffer(data) {
  const { restaurantName, orderId, tableNumber, roomNumber, orderType, items, time } = data;
  const bytes = [];

  // Init
  bytes.push(...INIT);
  bytes.push(...ALIGN_CENTER);
  bytes.push(...DOUBLE_HEIGHT_ON);
  bytes.push(...BOLD_ON);
  bytes.push(...textLine(restaurantName.toUpperCase()));
  bytes.push(...DOUBLE_HEIGHT_OFF);
  bytes.push(...textLine('** KOT **'));
  bytes.push(...BOLD_OFF);
  bytes.push(...textLine(DASHES));

  bytes.push(...ALIGN_LEFT);
  if (tableNumber) bytes.push(...twoColumnLine('Table:', tableNumber.toString()));
  if (roomNumber)  bytes.push(...twoColumnLine('Room:', roomNumber.toString()));
  if (orderType === 'takeaway') bytes.push(...textLine('Type: TAKEAWAY'));
  if (orderType === 'delivery') bytes.push(...textLine('Type: DELIVERY'));
  bytes.push(...twoColumnLine('Order:', orderId.slice(-6).toUpperCase()));
  bytes.push(...twoColumnLine('Time:', time));
  bytes.push(...textLine(DASHES));

  // Items
  bytes.push(...BOLD_ON);
  items.forEach(item => {
    bytes.push(...twoColumnLine(
      item.name.substring(0, 24),
      `x${item.quantity}`
    ));
  });
  bytes.push(...BOLD_OFF);
  bytes.push(...textLine(DASHES));

  bytes.push(...ALIGN_CENTER);
  bytes.push(...textLine('-- PREPARE WITH CARE --'));
  bytes.push(...feed(3));
  bytes.push(...CUT_PARTIAL);

  return Buffer.from(bytes);
}

// ─── Bill builder ─────────────────────────────────────────────────────────────

function buildBillBuffer(data) {
  const { restaurantName, tableLabel, items, total, paymentMethod, time, date, footerText } = data;
  const bytes = [];

  // Init
  bytes.push(...INIT);
  bytes.push(...ALIGN_CENTER);
  bytes.push(...DOUBLE_HEIGHT_ON);
  bytes.push(...BOLD_ON);
  bytes.push(...textLine(restaurantName.toUpperCase()));
  bytes.push(...DOUBLE_HEIGHT_OFF);
  bytes.push(...textLine('BILL'));
  bytes.push(...BOLD_OFF);
  bytes.push(...textLine(DASHES));

  bytes.push(...ALIGN_LEFT);
  bytes.push(...twoColumnLine('Ref:', tableLabel));
  bytes.push(...twoColumnLine('Date:', date));
  bytes.push(...twoColumnLine('Time:', time));
  bytes.push(...textLine(DASHES));

  // Header row
  bytes.push(...BOLD_ON);
  bytes.push(...textLine('Item                Qty   Amt'));
  bytes.push(...BOLD_OFF);
  bytes.push(...textLine(DASHES));

  // Items
  items.forEach(item => {
    const name  = item.name.substring(0, 18).padEnd(18);
    const qty   = String(item.qty).padStart(3);
    const amt   = `${item.price * item.qty}`.padStart(6);
    bytes.push(...textLine(`${name} ${qty} ${amt}`));
  });

  bytes.push(...textLine(DASHES));

  // Total
  bytes.push(...BOLD_ON);
  bytes.push(...DOUBLE_HEIGHT_ON);
  bytes.push(...twoColumnLine('TOTAL:', `Rs.${total}`));
  bytes.push(...DOUBLE_HEIGHT_OFF);
  bytes.push(...BOLD_OFF);

  if (paymentMethod) {
    bytes.push(...twoColumnLine('Payment:', paymentMethod.toUpperCase()));
  }
  bytes.push(...textLine(DASHES));

  bytes.push(...ALIGN_CENTER);
  bytes.push(...textLine(footerText || 'Thank you! Visit Again'));
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
