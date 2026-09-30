/**
 * Desktop print handler — registers all IPC print channels.
 *
 * KEY FIX: The hidden BrowserWindow must be created with the EXACT thermal
 * paper width in pixels so Chromium lays out the HTML at that width before
 * printing. Without this, Chromium uses its default ~800px viewport, the
 * content overflows the right edge, and the printed output is clipped.
 *
 * 80mm thermal paper at 96 DPI = ~302px usable width
 * 58mm thermal paper at 96 DPI = ~218px usable width
 */

const { BrowserWindow } = require('electron');
const { buildKOTEscPos, buildBillEscPos } = require('./escpos-builder');

// ── Paper width helpers ───────────────────────────────────────────────────────

function detectWidth(printerName) {
  if (!printerName) return '80mm';
  return printerName.toLowerCase().includes('58') ? '58mm' : '80mm';
}

// Viewport width in CSS pixels that matches the thermal paper
// 80mm @ 96dpi = 302px  |  58mm @ 96dpi = 218px
function viewportPx(width) {
  return width === '58mm' ? 220 : 304;
}

// Electron pageSize in microns (1mm = 1000μm)
function thermalPageSize(width) {
  return width === '58mm'
    ? { width: 58000,  height: 2970000 }   // 58mm × 297cm roll
    : { width: 80000,  height: 2970000 };  // 80mm × 297cm roll
}

// ── Core: render HTML in a narrow BrowserWindow then print silently ───────────

async function silentPrintHTML(html, printerName) {
  const width   = detectWidth(printerName);
  const vpWidth = viewportPx(width);

  return new Promise((resolve) => {
    // Create window exactly as wide as the thermal paper.
    // This forces Chromium to lay out the page at the correct width BEFORE
    // printing — which is the only reliable way to avoid right-overflow.
    const win = new BrowserWindow({
      show:   false,
      width:  vpWidth,
      height: 1200,          // tall enough for a long receipt
      webPreferences: {
        nodeIntegration:  false,
        contextIsolation: true,
        javascript:       true,
      },
    });

    // Inject a meta viewport that locks the layout width to match the window
    const metaViewport = `<meta name="viewport" content="width=${vpWidth}, initial-scale=1.0">`;
    const fixedHtml = html.includes('<meta name="viewport"')
      ? html
      : html.replace('<head>', `<head>${metaViewport}`);

    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(fixedHtml);
    win.loadURL(dataUrl);

    win.webContents.on('did-finish-load', () => {
      // Small delay so any web fonts / layout reflows settle
      setTimeout(() => {
        const printOptions = {
          silent:          true,
          printBackground: true,
          deviceName:      printerName || '',
          margins:         { marginType: 'none' },
          pageSize:        thermalPageSize(width),
          scaleFactor:     100,
          landscape:       false,
        };

        win.webContents.print(printOptions, (success, failureReason) => {
          win.destroy();
          if (success) {
            resolve({ success: true });
          } else {
            console.error('[print] failed:', failureReason);
            resolve({ success: false, error: failureReason });
          }
        });
      }, 200); // 200ms settle time
    });

    win.webContents.on('did-fail-load', (_e, code, desc) => {
      win.destroy();
      resolve({ success: false, error: `Load failed: ${desc}` });
    });

    // Hard timeout
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.destroy();
        resolve({ success: false, error: 'Print timeout after 15s' });
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

// ── IPC registration ──────────────────────────────────────────────────────────

function setupPrintHandlers(ipcMain) {

  ipcMain.handle('print:get-printers', async () => {
    try { return await getPrinters(); }
    catch (e) { console.error('[print] getPrinters:', e); return []; }
  });

  // Raw HTML path — used by qzPrint.js silentPrint fallback
  ipcMain.handle('print:silent-html', async (_e, { html, printerName }) => {
    try {
      if (!html) return { success: false, error: 'No HTML' };
      return await silentPrintHTML(html, printerName || '');
    } catch (e) {
      console.error('[print] silentPrint:', e);
      return { success: false, error: e.message };
    }
  });

  // KOT — structured data path
  ipcMain.handle('print:kot', async (_e, { data, printerName }) => {
    try {
      if (!data) return { success: false, error: 'No KOT data' };
      const width = detectWidth(printerName);
      const html  = buildKOTEscPos(data, width);
      return await silentPrintHTML(html, printerName || '');
    } catch (e) {
      console.error('[print] KOT:', e);
      return { success: false, error: e.message };
    }
  });

  // Bill — structured data path
  ipcMain.handle('print:bill', async (_e, { data, printerName }) => {
    try {
      if (!data) return { success: false, error: 'No bill data' };
      const width = detectWidth(printerName);
      const html  = buildBillEscPos(data, width);
      return await silentPrintHTML(html, printerName || '');
    } catch (e) {
      console.error('[print] Bill:', e);
      return { success: false, error: e.message };
    }
  });
}

module.exports = { setupPrintHandlers };
