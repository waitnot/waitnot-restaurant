const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app-version'),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  isElectron: true,

  // ── ESC/POS direct thermal printing (no dialog) ──────────────────────────
  // Sends raw ESC/POS bytes straight to the printer driver — like Petpooja
  printKOT:  (data, printerName) => ipcRenderer.invoke('print-kot',  { data, printerName }),
  printBill: (data, printerName) => ipcRenderer.invoke('print-bill', { data, printerName }),

  // ── HTML fallback silent print (non-thermal / PDF printers) ──────────────
  silentPrint: (html, printerName) => ipcRenderer.invoke('silent-print', { html, printerName }),

  // ── Printer list ─────────────────────────────────────────────────────────
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  showNotification: (title, body) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') new Notification(title, { body });
      });
    }
  }
});

// Desktop styles
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    body { user-select: none; -webkit-user-select: none; }
    input, textarea, [contenteditable] { user-select: text !important; -webkit-user-select: text !important; }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
    ::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
  `;
  document.head.appendChild(style);
});

window.addEventListener('error', e => console.error('Desktop Error:', e.error));
window.addEventListener('unhandledrejection', e => console.error('Desktop Rejection:', e.reason));