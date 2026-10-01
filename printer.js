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

// â”€â”€â”€ Printer discovery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ ESC/POS raw printing (Windows: net use / direct port write) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * On Windows, write raw ESC/POS bytes to a printer by name using a temp file
 * and the `COPY /B` command â€” this bypasses Windows GDI entirely.
 */
async function rawPrintWindows(printerName, buffer) {
  // Use Windows WritePrinter RAW API — bypasses the GDI driver entirely.
  // COPY /B sends data THROUGH the driver (POS58ENG) which converts ESC/POS
  // bytes to raster — nothing prints. WritePrinter with datatype="RAW"
  // sends bytes directly to the printer port, bypassing all GDI processing.
  return new Promise((resolve) => {
    const base64 = buffer.toString('base64');
    const safeName = printerName.replace(/'/g, "''").replace(/"/g, '`"');
    const ps = [
      'Add-Type -TypeDefinition @"',
      'using System; using System.Runtime.InteropServices;',
      'public class RawPrinter {',
      '  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]',
      '  public struct DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }',
      '  [DllImport("winspool.drv",CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);',
      '  [DllImport("winspool.drv")] public static extern bool ClosePrinter(IntPtr h);',
      '  [DllImport("winspool.drv",CharSet=CharSet.Unicode)] public static extern Int32 StartDocPrinter(IntPtr h, Int32 l, ref DOCINFO d);',
      '  [DllImport("winspool.drv")] public static extern bool EndDocPrinter(IntPtr h);',
      '  [DllImport("winspool.drv")] public static extern bool StartPagePrinter(IntPtr h);',
      '  [DllImport("winspool.drv")] public static extern bool EndPagePrinter(IntPtr h);',
      '  [DllImport("winspool.drv")] public static extern bool WritePrinter(IntPtr h, IntPtr b, Int32 c, out Int32 w);',
      '  public static int SendRaw(string name, byte[] data) {',
      '    IntPtr hP; if (!OpenPrinter(name, out hP, IntPtr.Zero)) return -1;',
      '    var di = new DOCINFO { pDocName="ESCPOS", pOutputFile=null, pDataType="RAW" };',
      '    StartDocPrinter(hP,1,ref di); StartPagePrinter(hP);',
      '    var ptr = System.Runtime.InteropServices.Marshal.AllocHGlobal(data.Length);',
      '    System.Runtime.InteropServices.Marshal.Copy(data,0,ptr,data.Length);',
      '    int w=0; WritePrinter(hP,ptr,data.Length,out w);',
      '    System.Runtime.InteropServices.Marshal.FreeHGlobal(ptr);',
      '    EndPagePrinter(hP); EndDocPrinter(hP); ClosePrinter(hP); return w;',
      '  }',
      '}',
      '"@ -Language CSharp',
      `$b = [Convert]::FromBase64String('${base64}')`,
      `$w = [RawPrinter]::SendRaw('${safeName}', $b)`,
      'Write-Host "written=$w"',
    ].join('\n');

    const { exec: _exec } = require('child_process');
    // Write PS1 to a temp file — powershell -Command - (stdin) doesn't work in all environments
    const ps1File = path.join(os.tmpdir(), `wn-raw-${Date.now()}.ps1`);
    try { fs.writeFileSync(ps1File, ps, 'utf8'); } catch (e) { return _copyBFallback(printerName, buffer, resolve); }
    _exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1File}"`, { timeout: 15000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(ps1File); } catch {}
      const out = (stdout || '').trim();
      console.log(`[printer] WritePrinter: "${out}" err=${err ? err.message.substring(0,50) : 'none'}`);
      const written = parseInt((out.match(/written=(\d+)/) || [])[1] || '-1');
      if (!err && written > 0) {
        console.log(`[printer] ✅ RAW WritePrinter: ${written} bytes → "${printerName}"`);
        resolve({ success: true });
      } else {
        console.warn(`[printer] WritePrinter failed (written=${written}) — trying COPY /B fallback`);
        _copyBFallback(printerName, buffer, resolve);
      }
    });
  });
}

function _copyBFallback(printerName, buffer, resolve) {
  const tmpFile = path.join(os.tmpdir(), `wn-escpos-${Date.now()}.bin`);
  try { fs.writeFileSync(tmpFile, buffer); } catch (e) { return resolve({ success: false, error: e.message }); }
  const { exec: _exec } = require('child_process');
  _exec(
    `powershell -NoProfile -Command "(Get-WmiObject Win32_Printer | Where-Object { $_.Name -eq '${printerName.replace(/'/g,"''")}' } | Select-Object -First 1).PortName"`,
    { timeout: 4000 },
    (wmiErr, wmiOut) => {
      const port   = (!wmiErr && wmiOut && wmiOut.trim()) ? wmiOut.trim() : null;
      const target = port || printerName;
      _exec(`COPY /B "${tmpFile}" "${target}"`, (copyErr) => {
        try { fs.unlinkSync(tmpFile); } catch {}
        if (copyErr) { console.warn(`[printer] COPY /B fallback failed: ${copyErr.message}`); resolve({ success: false, error: copyErr.message }); }
        else { console.log(`[printer] ✅ COPY /B sent to "${target}"`); resolve({ success: true }); }
      });
    }
  );
}

/**
 * On Linux/Mac, use lp command
 */async function rawPrintUnix(printerName, buffer) {
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

// â”€â”€â”€ ESC/POS command builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Width helpers (58mm=32chars, 80mm=48chars) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ KOT builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildKOTBuffer(data) {
  const { restaurantName, orderId, tableNumber, roomNumber, orderType, items, time, paperWidth } = data;
  const W = getWidth(paperWidth);
  const DASHES = dashedLine(paperWidth);
  const bytes = [];

  // Init
  bytes.push(...INIT);
  // Use hardware ALIGN_CENTER only — centeredLine() adds manual spaces which
  // double-centers text and shifts double-width headers to the right.
  bytes.push(...ALIGN_CENTER);
  bytes.push(...DOUBLE_HEIGHT_ON);
  bytes.push(...BOLD_ON);
  bytes.push(...textLine(restaurantName.toUpperCase()));
  bytes.push(...DOUBLE_HEIGHT_OFF);
  bytes.push(...textLine('** KOT **'));
  bytes.push(...BOLD_OFF);
  bytes.push(...ALIGN_LEFT);
  bytes.push(...textLine(DASHES));

  bytes.push(...ALIGN_LEFT);
  if (tableNumber) bytes.push(...twoColumnLine('Table:', tableNumber.toString(), W));
  if (roomNumber)  bytes.push(...twoColumnLine('Room:', roomNumber.toString(), W));
  if (orderType === 'takeaway') bytes.push(...textLine('Type: TAKEAWAY'));
  if (orderType === 'delivery') bytes.push(...textLine('Type: DELIVERY'));
  bytes.push(...twoColumnLine('Order:', orderId.slice(-6).toUpperCase(), W));
  bytes.push(...twoColumnLine('Time:', time, W));
  bytes.push(...textLine(DASHES));

  // Items â€” name truncated to leave room for qty on right
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
  bytes.push(...textLine('-- PREPARE WITH CARE --'));
  bytes.push(...feed(3));
  bytes.push(...CUT_PARTIAL);

  return Buffer.from(bytes);
}

// â”€â”€â”€ Bill builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildBillBuffer(data) {
  const { restaurantName, tableLabel, items, total, paymentMethod, time, date, footerText, paperWidth } = data;
  const W = getWidth(paperWidth);
  // dashedLine already has \n via textLine â€” strip the extra \n from dashedLine()
  const DASHES = '-'.repeat(W);
  const bytes = [];

  // Init
  bytes.push(...INIT);
  // Use hardware ALIGN_CENTER only — centeredLine() adds manual spaces which
  // double-centers text and shifts double-width headers to the right.
  bytes.push(...ALIGN_CENTER);
  bytes.push(...DOUBLE_HEIGHT_ON);
  bytes.push(...BOLD_ON);
  bytes.push(...textLine(restaurantName.toUpperCase()));
  bytes.push(...DOUBLE_HEIGHT_OFF);
  bytes.push(...textLine('BILL'));
  bytes.push(...BOLD_OFF);
  bytes.push(...ALIGN_LEFT);
  bytes.push(...textLine(DASHES));

  // Skip Ref when blank — don't print "Ref:    " with empty value
  if (tableLabel && tableLabel.trim()) bytes.push(...twoColumnLine('Ref:', tableLabel, W));
  bytes.push(...twoColumnLine('Date:', date, W));
  bytes.push(...twoColumnLine('Time:', time, W));
  bytes.push(...textLine(DASHES));

  // Column layout for bill items â€” must sum exactly to W:
  //   58mm W=32:  name=16 | qty=3 | rate=7 | amt=6  â†’ 16+3+7+6=32
  //   80mm W=48:  name=24 | qty=3 | rate=10 | amt=11 â†’ 24+3+10+11=48
  const amtW  = W >= 48 ? 11 : 6;
  const rateW = W >= 48 ? 10 : 7;
  const qtyW  = 3;
  const nameW = W - qtyW - rateW - amtW;
  const header = 'ITEM'.padEnd(nameW) + 'QTY'.padStart(qtyW) + 'RATE'.padStart(rateW) + 'AMT'.padStart(amtW);
  bytes.push(...BOLD_ON);
  bytes.push(...textLine(header));
  bytes.push(...BOLD_OFF);
  bytes.push(...textLine(DASHES));

  // Items â€” if name is longer than nameW, print it on its own line first,
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
      // Name is too long for one line â€” print name first, numbers on next line
      bytes.push(...textLine(fullName.substring(0, W)));  // truncate only at paper width
      bytes.push(...textLine(' '.repeat(nameW) + qtyS + rateS + amtS));
    } else {
      // Name fits on same line as numbers
      bytes.push(...textLine(fullName.padEnd(nameW) + qtyS + rateS + amtS));
    }
  });

  bytes.push(...textLine(DASHES));

  // Total — no double-height (double-height + twoColumnLine causes right-shift)
  bytes.push(...BOLD_ON);
  bytes.push(...twoColumnLine('TOTAL:', `Rs.${total}`, W));
  bytes.push(...BOLD_OFF);

  if (paymentMethod) {
    bytes.push(...textLine(''));  // blank line between TOTAL and Payment
    bytes.push(...twoColumnLine('Payment:', paymentMethod.toUpperCase(), W));
  }
  bytes.push(...textLine(DASHES));

  bytes.push(...ALIGN_CENTER);
  bytes.push(...textLine(footerText || 'Thank you! Visit Again'));
  bytes.push(...feed(3));
  bytes.push(...CUT_PARTIAL);

  return Buffer.from(bytes);
}

// â”€â”€â”€ Main print function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
