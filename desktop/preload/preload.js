/**
 * Secure preload script — exposes ONLY whitelisted APIs to the renderer.
 * contextIsolation: true  →  Node is NOT available in renderer.
 * Only these explicit channels are bridged.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // ── Printing ──────────────────────────────────────────────────────────────

  /** List available system printers */
  getPrinters: () => ipcRenderer.invoke('print:get-printers'),

  /** Silent HTML print to named printer (or default if empty) */
  silentPrint: (html, printerName) =>
    ipcRenderer.invoke('print:silent-html', { html, printerName }),

  /** ESC/POS KOT print */
  printKOT: (data, printerName) =>
    ipcRenderer.invoke('print:kot', { data, printerName }),

  /** ESC/POS Bill print */
  printBill: (data, printerName) =>
    ipcRenderer.invoke('print:bill', { data, printerName }),

  // ── App info ──────────────────────────────────────────────────────────────

  getVersion: () => ipcRenderer.invoke('get-app-version'),
  getServerPort: () => ipcRenderer.invoke('get-server-port'),

  // ── Persistent settings (desktop-only) ────────────────────────────────────

  settingsGet: (key) => ipcRenderer.invoke('store-get', key),
  settingsSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  settingsDelete: (key) => ipcRenderer.invoke('store-delete', key),

  // ── Shell / dialogs ───────────────────────────────────────────────────────

  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showMessage: (opts) => ipcRenderer.invoke('show-message', opts),

  // ── Environment flag (checked by qzPrint.js / web app) ───────────────────
  isDesktop: true,
});
