import { BluetoothSerial } from '@ascentio-it/capacitor-bluetooth-serial';

/**
 * Enhanced Printing Utility for WaitNot
 * Supports:
 * 1. Native Android Bluetooth Thermal Printing (Direct, no dialogs)
 * 2. Electron Silent Printing (Desktop)
 * 3. QZ Tray (Web direct)
 * 4. Browser Print (Fallback)
 */

let qz = null;
let connected = false;

// ... (QZ Tray functions kept for web compatibility)
function loadQZScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || window.Capacitor?.isNativePlatform?.()) {
      reject(new Error('QZ Tray not available in native app'));
      return;
    }
    if (window.qz) { resolve(window.qz); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
    s.onload = () => resolve(window.qz);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function connectQZ() {
  try {
    qz = await loadQZScript();
    if (!qz.websocket.isActive()) await qz.websocket.connect();
    connected = true;
    return true;
  } catch (e) {
    connected = false;
    return false;
  }
}

export async function getPrinters() {
  if (!connected) await connectQZ();
  if (!connected) return [];
  return await qz.printers.find();
}

export function isQZAvailable() {
  return connected;
}

/**
 * Native Android Bluetooth Printing logic
 * Uses ESC/POS standard for thermal printers
 */
async function nativeCapacitorPrint(html, type) {
  try {
    const restaurantId = localStorage.getItem('restaurantId') || JSON.parse(localStorage.getItem('staffData') || '{}').restaurant_id;
    const saved = JSON.parse(localStorage.getItem(`printer_settings_${restaurantId}`) || '{}');
    const address = type === 'kitchen' ? saved.btKitchenPrinter : saved.btBillPrinter;

    if (!address) return { success: false, error: 'No printer configured' };

    // 1. Ensure Bluetooth is ready
    const state = await BluetoothSerial.isEnabled();
    if (!state.enabled) await BluetoothSerial.enable();

    // 2. Connect
    await BluetoothSerial.connect({ address });

    // 3. Process HTML to Text + ESC/POS Basic Formatting
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Simple text extraction with spacing
    let text = tempDiv.innerText.split('\n').filter(line => line.trim() !== '').join('\n');

    // Add extra paper feed at the end
    const feedLines = '\n\n\n\n\n';

    // 4. Send raw data
    await BluetoothSerial.write({ address, value: text + feedLines });

    // 5. Short delay to ensure buffer clears before disconnect
    await new Promise(r => setTimeout(r, 500));
    await BluetoothSerial.disconnect({ address });

    return { success: true };
  } catch (e) {
    console.error('BT Print Error:', e);
    return { success: false, error: e.message };
  }
}

export async function smartPrint(html, type = 'bill') {
  console.log(`🖨️ Printing ${type}...`);

  // 1. Priority: Native Android Bluetooth (Hassle-free, no dialogs)
  if (window.Capacitor?.isNativePlatform?.()) {
    const res = await nativeCapacitorPrint(html, type);
    if (res.success) return { method: 'bluetooth' };

    // CUSTOM MOBILE FALLBACK: Show alert instead of redirecting to Chrome
    alert('⚠️ Bluetooth printer not configured. Please go to "Settings" tab in this app to pair and select your printer.');
    return { method: 'none', error: 'No printer' };
  }

  // 2. Desktop App Silent Print
  if (window.electronAPI?.silentPrint) {
    const restaurantId = localStorage.getItem('restaurantId');
    const saved = JSON.parse(localStorage.getItem(`printer_settings_${restaurantId}`) || '{}');
    const printerName = type === 'kitchen' ? saved.qzKitchenPrinter : saved.qzBillPrinter;
    const result = await window.electronAPI.silentPrint(html, printerName || '');
    if (result.success) return { method: 'electron' };
  }

  // 3. Fallback: Browser Print Dialog
  const w = window.open('', '_blank', 'width=400,height=600');
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      w.print();
      setTimeout(() => w.close(), 300);
    }, 400);
  }
  return { method: 'browser' };
}
