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

    // Look up the port name from the Windows printer registry so COPY /B goes
    // to the hardware port (e.g. USB001), not a file that happens to share the
    // printer's display name in the current working directory.
    function getPortForPrinter(name, cb) {
      const { exec: _exec } = require('child_process');
      _exec(
        `powershell -NoProfile -Command "(Get-WmiObject Win32_Printer | Where-Object { $_.Name -eq '${name}' } | Select-Object -First 1).PortName"`,
        { timeout: 3000 },
        (err, stdout) => {
          const port = stdout && stdout.trim();
          cb(port && port.length > 0 ? port : null);
        }
      );
    }

    function sendToTarget(target) {
      const cmd = `COPY /B "${tmpFile}" "${target}"`;
      console.log(`[printer] COPY /B → "${target}"`);
      exec(cmd, (error) => {
        try { fs.unlinkSync(tmpFile); } catch {}
        if (error) {
          console.warn('[printer] COPY /B failed:', error.message);
          resolve({ success: false, error: error.message });
        } else {
          console.log(`[printer] ✅ ESC/POS sent to "${target}"`);
          resolve({ success: true });
        }
      });
    }

    // Try to resolve printer name → port name first.
    // This avoids the "file named after the printer" trap where Windows
    // writes bytes to a local file instead of the USB/serial port.
    getPortForPrinter(printerName, (port) => {
      if (port) {
        sendToTarget(port);       // e.g. USB001, COM3, LPT1
      } else {
        sendToTarget(printerName); // fallback: use the name as-is
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
  // dashedLine already has \n via textLine — strip the extra \n from dashedLine()
  const DASHES = '-'.repeat(W);
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

  // Column layout for bill items — must sum exactly to W:
  //   58mm W=32:  name=16 | qty=3 | rate=7 | amt=6  → 16+3+7+6=32
  //   80mm W=48:  name=24 | qty=3 | rate=10 | amt=11 → 24+3+10+11=48
  const amtW  = W >= 48 ? 11 : 6;
  const rateW = W >= 48 ? 10 : 7;
  const qtyW  = 3;
  const nameW = W - qtyW - rateW - amtW;
  const header = 'ITEM'.padEnd(nameW) + 'QTY'.padStart(qtyW) + 'RATE'.padStart(rateW) + 'AMT'.padStart(amtW);
  bytes.push(...BOLD_ON);
  bytes.push(...textLine(header));
  bytes.push(...BOLD_OFF);
  bytes.push(...textLine(DASHES));

  // Items — if name is longer than nameW, print it on its own line first,
  // then the qty/rate/amt on the next line (right-aligned).
  items.forEach(item => {
    const qty   = item.qty || item.quantity || 1;
    const price = parseFloat(item.price || 0);
    const amt   = Math.round(price * qty);
    const fullName = (item.name || '');
    const qtyS  = String(qty).padStart(qtyW);
    const rateS = Math.round(price).toString().padStart(rateW);
    const amtS  = amt.toString().padStart(amtW);

    if (fullName.length > nameW) {
      // Name is too long for one line — print name first, numbers on next line
      bytes.push(...textLine(fullName.substring(0, W)));  // truncate only at paper width
      bytes.push(...textLine(' '.repeat(nameW) + qtyS + rateS + amtS));
    } else {
      // Name fits on same line as numbers
      bytes.push(...textLine(fullName.padEnd(nameW) + qtyS + rateS + amtS));
    }
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
