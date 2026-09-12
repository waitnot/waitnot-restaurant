/**
 * Desktop print handler — registers all IPC print channels.
 * Called from main.js after app is ready.
 *
 * Three printing paths:
 *  1. silentPrint   — renders HTML in a hidden BrowserWindow, prints silently
 *  2. printKOT      — generates ESC/POS bytes for kitchen ticket
 *  3. printBill     — generates ESC/POS bytes for customer bill
 */

const { BrowserWindow, app } = require('electron');
const path = require('path');
const { buildKOTEscPos, buildBillEscPos } = require('./escpos-builder');

// ── 1. Silent HTML print ─────────────────────────────────────────────────────

async function silentPrintHTML(html, printerName) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    win.loadURL(dataUrl);

    win.webContents.on('did-finish-load', () => {
      const options = {
        silent: true,
        printBackground: true,
        deviceName: printerName || '',  // '' = default printer
        margins: { marginType: 'none' },
        pageSize: printerName?.toLowerCase().includes('58') ? { width: 58000, height: 297000 }
                : printerName?.toLowerCase().includes('80') ? { width: 80000, height: 297000 }
                : 'A4',
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

    win.webContents.on('did-fail-load', () => {
      win.destroy();
      resolve({ success: false, error: 'Failed to load HTML content' });
    });
  });
}

// ── 2. ESC/POS raw print ──────────────────────────────────────────────────────

async function rawEscPosPrint(escposBytes, printerName) {
  // Try pdf-to-printer for Windows; fall back to silentPrint HTML
  try {
    // Use a hidden BrowserWindow with a data: URL for cross-platform raw send
    // For true ESC/POS raw on Windows, electron supports raw printing via
    // webContents.print with a custom renderer. Here we use the HTML path
    // which works on both Windows and macOS thermal drivers.
    const htmlContent = buildReceiptHTML(escposBytes);
    return await silentPrintHTML(htmlContent, printerName);
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function buildReceiptHTML(lines) {
  const escaped = lines.map(l =>
    `<div style="white-space:pre;font-family:'Courier New',monospace;font-size:11px;line-height:1.3;">${
      l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    }</div>`
  ).join('');
  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <style>@page{margin:0;size:auto;}body{margin:4mm;padding:0;}</style>
  </head><body>${escaped}</body></html>`;
}

// ── 3. Printer list ───────────────────────────────────────────────────────────

function getPrinters() {
  // Get from any existing BrowserWindow — it has access to OS printer list
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) {
    return wins[0].webContents.getPrintersAsync();
  }
  // Create a hidden window just to query printers
  return new Promise((resolve) => {
    const w = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
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
      const list = await getPrinters();
      return list;
    } catch (e) {
      console.error('[print] getPrinters error:', e);
      return [];
    }
  });

  ipcMain.handle('print:silent-html', async (_event, { html, printerName }) => {
    try {
      if (!html) return { success: false, error: 'No HTML content provided' };
      return await silentPrintHTML(html, printerName || '');
    } catch (e) {
      console.error('[print] silentPrint error:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('print:kot', async (_event, { data, printerName }) => {
    try {
      if (!data) return { success: false, error: 'No KOT data provided' };
      const html = buildKOTEscPos(data);
      return await silentPrintHTML(html, printerName || '');
    } catch (e) {
      console.error('[print] KOT print error:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('print:bill', async (_event, { data, printerName }) => {
    try {
      if (!data) return { success: false, error: 'No bill data provided' };
      const html = buildBillEscPos(data);
      return await silentPrintHTML(html, printerName || '');
    } catch (e) {
      console.error('[print] Bill print error:', e);
      return { success: false, error: e.message };
    }
  });
}

module.exports = { setupPrintHandlers };
