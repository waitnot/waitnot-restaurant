/**
 * Desktop print handler — registers all IPC print channels.
 * Called from main.js after app is ready.
 */

const { BrowserWindow } = require('electron');
const { buildKOTEscPos, buildBillEscPos } = require('./escpos-builder');

// ── Detect paper width from printer name ─────────────────────────────────────
// Most thermal printers are named "POS-80", "RP80", "TM-T82", "80mm" etc.
// Default to 80mm; only drop to 58mm if name explicitly contains "58".
function detectWidth(printerName) {
  if (!printerName) return '80mm';
  const n = printerName.toLowerCase();
  if (n.includes('58')) return '58mm';
  return '80mm';
}

// Build the Electron page size object for the thermal roll
function thermalPageSize(width) {
  // Electron pageSize accepts microns: { width: Nμm, height: Nμm }
  // Use a tall height so the entire receipt fits on one "page"
  return width === '58mm'
    ? { width: 58000, height: 2000000 }   // 58mm × 2m roll
    : { width: 80000, height: 2000000 };  // 80mm × 2m roll
}

// ── Silent HTML print ─────────────────────────────────────────────────────────
async function silentPrintHTML(html, printerName) {
  const width = detectWidth(printerName);
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        javascript: true,
      },
    });

    // Use loadURL with data: URI — avoids file:// security restrictions
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    win.loadURL(dataUrl);

    win.webContents.on('did-finish-load', () => {
      const options = {
        silent: true,
        printBackground: true,
        deviceName: printerName || '',
        margins: { marginType: 'none' },
        pageSize: thermalPageSize(width),
        scaleFactor: 100,
        landscape: false,
      };

      win.webContents.print(options, (success, failureReason) => {
        win.destroy();
        if (success) {
          resolve({ success: true });
        } else {
          console.error('[print] silentPrint failed:', failureReason);
          resolve({ success: false, error: failureReason });
        }
      });
    });

    win.webContents.on('did-fail-load', (_e, code, desc) => {
      win.destroy();
      console.error('[print] page load failed:', code, desc);
      resolve({ success: false, error: `Load failed: ${desc}` });
    });

    // Safety timeout — destroy window after 15s no matter what
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.destroy();
        resolve({ success: false, error: 'Print timeout' });
      }
    }, 15000);
  });
}

// ── Printer list ──────────────────────────────────────────────────────────────
function getPrinters() {
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) {
    return wins[0].webContents.getPrintersAsync();
  }
  return new Promise((resolve) => {
    const w = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    w.loadURL('about:blank');
    w.webContents.once('did-finish-load', async () => {
      const printers = await w.webContents.getPrintersAsync();
      w.destroy();
      resolve(printers);
    });
  });
}

// ── IPC handler registration ──────────────────────────────────────────────────
function setupPrintHandlers(ipcMain) {

  ipcMain.handle('print:get-printers', async () => {
    try {
      return await getPrinters();
    } catch (e) {
      console.error('[print] getPrinters error:', e);
      return [];
    }
  });

  // Generic HTML print (used by qzPrint.js silentPrint path)
  ipcMain.handle('print:silent-html', async (_event, { html, printerName }) => {
    try {
      if (!html) return { success: false, error: 'No HTML provided' };
      return await silentPrintHTML(html, printerName || '');
    } catch (e) {
      console.error('[print] silentPrint error:', e);
      return { success: false, error: e.message };
    }
  });

  // KOT — generate from structured data
  ipcMain.handle('print:kot', async (_event, { data, printerName }) => {
    try {
      if (!data) return { success: false, error: 'No KOT data' };
      const width = detectWidth(printerName);
      const html  = buildKOTEscPos(data, width);
      return await silentPrintHTML(html, printerName || '');
    } catch (e) {
      console.error('[print] KOT error:', e);
      return { success: false, error: e.message };
    }
  });

  // Bill — generate from structured data
  ipcMain.handle('print:bill', async (_event, { data, printerName }) => {
    try {
      if (!data) return { success: false, error: 'No bill data' };
      const width = detectWidth(printerName);
      const html  = buildBillEscPos(data, width);
      return await silentPrintHTML(html, printerName || '');
    } catch (e) {
      console.error('[print] Bill error:', e);
      return { success: false, error: e.message };
    }
  });
}

module.exports = { setupPrintHandlers };
