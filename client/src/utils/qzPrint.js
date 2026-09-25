/**
 * WaitNot Bluetooth Printing Utility
 * Priority: 1. Electron  2. Android EscPos plugin (hex ESC/POS)  3. QZ Tray  4. Browser
 */

// ─── QZ Tray ──────────────────────────────────────────────────────────────────
let qz = null, qzConnected = false;
function loadQZScript() {
  return new Promise((resolve, reject) => {
    if (window.Capacitor?.isNativePlatform?.()) { reject(new Error('mobile')); return; }
    if (window.qz) { resolve(window.qz); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
    s.onload = () => resolve(window.qz); s.onerror = reject;
    document.head.appendChild(s);
  });
}
export async function connectQZ() {
  try { qz = await loadQZScript(); if (!qz.websocket.isActive()) await qz.websocket.connect(); qzConnected = true; return true; }
  catch { qzConnected = false; return false; }
}
export async function getPrinters() {
  if (window.electronAPI?.getPrinters) return (await window.electronAPI.getPrinters()).map(p => p.name);
  if (!qzConnected) await connectQZ();
  if (!qzConnected) return [];
  try { return await qz.printers.find(); } catch { return []; }
}
export function isQZAvailable() { return qzConnected; }

// ─── Settings ────────────────────────────────────────────────────────────────
function getSavedSettings() {
  const id = localStorage.getItem('restaurantId') || JSON.parse(localStorage.getItem('staffData')||'{}').restaurant_id;
  return JSON.parse(localStorage.getItem('printer_settings_' + id) || '{}');
}

// ─── Electron ────────────────────────────────────────────────────────────────
async function electronPrintKOT(order, restaurantName) {
  const s = getSavedSettings();
  const p = s.qzKitchenPrinter || s.kitchenPrinterName || '';
  if (!p) return { success: false, error: 'No kitchen printer' };
  const now = new Date();
  return window.electronAPI.printKOT({ restaurantName, orderId: order._id||'N/A', tableNumber: order.tableNumber||null, roomNumber: order.roomNumber||null, orderType: order.orderType||'dine-in', items: order.items.map(i=>({name:i.name,quantity:i.quantity})), time: now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) }, p);
}
async function electronPrintBill(orders, tableLabel, total, restaurantName) {
  const s = getSavedSettings();
  const p = s.qzBillPrinter || s.cashCounterPrinterName || '';
  if (!p) return { success: false, error: 'No bill printer' };
  const itemMap = {};
  orders.forEach(o => o.items?.forEach(i => { if (itemMap[i.name]) itemMap[i.name].qty+=i.quantity; else itemMap[i.name]={name:i.name,qty:i.quantity,price:i.price}; }));
  const now = new Date();
  return window.electronAPI.printBill({ restaurantName, tableLabel, items: Object.values(itemMap), total, paymentMethod: orders[0]?.paymentMethod||'cash', time: now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}), date: now.toLocaleDateString('en-IN'), footerText: 'Thank you! Visit Again' }, p);
}

// ─── ESC/POS byte builder ────────────────────────────────────────────────────
const B = {
  INIT:[0x1B,0x40], BOLD_ON:[0x1B,0x45,0x01], BOLD_OFF:[0x1B,0x45,0x00],
  CENTER:[0x1B,0x61,0x01], LEFT:[0x1B,0x61,0x00],
  DOUBLE_ON:[0x1B,0x21,0x30], DOUBLE_OFF:[0x1B,0x21,0x00],
  CUT:[0x1D,0x56,0x42,0x03], LF:[0x0A],
};
function bytes(...parts) {
  const out=[];
  for(const p of parts){
    if(Array.isArray(p)) out.push(...p);
    else if(typeof p==='string'){for(let i=0;i<p.length;i++) out.push(p.charCodeAt(i)&0xFF);}
    else if(typeof p==='number') out.push(p&0xFF);
  }
  return out;
}
function toHex(arr) { return arr.map(b=>b.toString(16).padStart(2,'0')).join(''); }
function lf(n=1) { const o=[]; for(let i=0;i<n;i++) o.push(...B.LF); return o; }
function line(t) { return bytes(t,B.LF); }
function cLine(t,W) { const s=String(t).substring(0,W); return line(' '.repeat(Math.max(0,Math.floor((W-s.length)/2)))+s); }
function lrLine(l,r,W) { const rv=String(r); const lv=String(l).substring(0,W-rv.length-1); return line(lv+' '.repeat(Math.max(1,W-lv.length-rv.length))+rv); }
function sep(W,c) { return line(c.repeat(W)); }

function buildKOTBytes({restaurantName,slotLabel,orderId,orderType,customerName,deliveryAddress,specialInstructions,items}) {
  const now=new Date(); const W=32;
  return bytes(B.INIT,B.CENTER,B.DOUBLE_ON,B.BOLD_ON,line((restaurantName||'RESTAURANT').toUpperCase().substring(0,16)),B.DOUBLE_OFF,line('KITCHEN ORDER TICKET'),orderType?line(orderType.toUpperCase()):[],B.BOLD_OFF,sep(W,'='),B.LEFT,slotLabel?bytes(B.BOLD_ON,lrLine('SLOT:',slotLabel,W),B.BOLD_OFF):[],lrLine('DATE:',now.toLocaleDateString('en-IN'),W),bytes(B.BOLD_ON,lrLine('TIME:',now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),W),B.BOLD_OFF),orderId?lrLine('REF:',String(orderId).slice(-8).toUpperCase(),W):[],customerName?lrLine('NAME:',customerName,W):[],deliveryAddress?line('ADDR: '+deliveryAddress):[],sep(W,'='),B.CENTER,B.BOLD_ON,line('-- ITEMS TO PREPARE --'),B.BOLD_OFF,sep(W,'='),B.LEFT,...(items||[]).map(i=>bytes(B.BOLD_ON,lrLine(String(i.name).substring(0,24),'x'+i.quantity,W),B.BOLD_OFF)),sep(W,'='),specialInstructions?bytes(B.BOLD_ON,line('NOTE: '+specialInstructions),B.BOLD_OFF,sep(W,'-')):[],B.CENTER,B.BOLD_ON,line('PREPARE WITH CARE'),B.BOLD_OFF,lf(1),B.CUT);
}

function buildBillBytes({restaurantName,slotLabel,orderType,customerName,customerPhone,deliveryAddress,items,packagingCharge,deliveryCharge,paymentMethod}) {
  const now=new Date(); const W=32;
  const bi=(items||[]).map(i=>({...i,price:parseFloat(i.price)||0,quantity:parseInt(i.quantity)||1}));
  const sub=bi.filter(i=>!i.complimentary).reduce((s,i)=>s+i.price*i.quantity,0);
  const ext=(parseFloat(packagingCharge)||0)+(parseFloat(deliveryCharge)||0);
  const total=sub+ext;
  const rt=orderType==='delivery'?'DELIVERY RECEIPT':orderType==='takeaway'?'TAKEAWAY RECEIPT':orderType==='room'?'ROOM RECEIPT':'DINE-IN RECEIPT';
  return bytes(B.INIT,B.CENTER,B.DOUBLE_ON,B.BOLD_ON,line((restaurantName||'RESTAURANT').toUpperCase().substring(0,16)),B.DOUBLE_OFF,line(rt),B.BOLD_OFF,sep(W,'='),B.LEFT,slotLabel?bytes(B.BOLD_ON,lrLine('SLOT:',slotLabel,W),B.BOLD_OFF):[],lrLine('DATE:',now.toLocaleDateString('en-IN'),W),lrLine('TIME:',now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),W),customerName?lrLine('NAME:',customerName,W):[],customerPhone?lrLine('PHONE:',customerPhone,W):[],paymentMethod?bytes(B.BOLD_ON,lrLine('PAYMENT:',paymentMethod.toUpperCase(),W),B.BOLD_OFF):[],deliveryAddress?line('ADDR: '+deliveryAddress):[],sep(W,'='),bytes(B.BOLD_ON,lrLine('ITEM','AMT',W),B.BOLD_OFF),sep(W,'-'),...bi.map(i=>lrLine(i.name.substring(0,20)+' x'+i.quantity,(i.complimentary?'COMP':'Rs.'+(i.price*i.quantity).toFixed(0)),W)),sep(W,'='),packagingCharge>0?lrLine('PACKAGING:','Rs.'+Number(packagingCharge).toFixed(0),W):[],deliveryCharge>0?lrLine('DELIVERY:','Rs.'+Number(deliveryCharge).toFixed(0),W):[],bytes(B.BOLD_ON,B.DOUBLE_ON,lrLine('TOTAL:','Rs.'+total.toFixed(0),W),B.DOUBLE_OFF,B.BOLD_OFF),sep(W,'='),B.CENTER,line('THANK YOU! VISIT AGAIN'),line('* * * * * * * *'),lf(1),B.CUT);
}

// ─── EscPos plugin (Android) ──────────────────────────────────────────────────
let _plugin = null;
async function getPlugin() {
  if (_plugin) return _plugin;
  if (window.Capacitor?.Plugins?.EscPos) { _plugin = window.Capacitor.Plugins.EscPos; return _plugin; }
  const { registerPlugin } = await import('@capacitor/core');
  _plugin = registerPlugin('EscPos');
  return _plugin;
}

// ── Scan for BT devices (in-app discovery) ───────────────────────────────────
export async function scanBluetoothDevices() {
  if (!window.Capacitor?.isNativePlatform?.()) return { devices: [] };
  try {
    const p = await getPlugin();
    return await Promise.race([
      p.scanDevices(),
      new Promise((_,r) => setTimeout(()=>r(new Error('Scan timeout')), 15000))
    ]);
  } catch(e) { return { devices: [], error: e.message }; }
}

export async function stopBluetoothScan() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try { (await getPlugin()).stopScan(); } catch(_) {}
}

export async function getPairedBluetoothDevices() {
  if (!window.Capacitor?.isNativePlatform?.()) return { devices: [] };
  try { return await (await getPlugin()).getPairedDevices(); }
  catch(e) { return { devices: [], error: e.message }; }
}

export async function requestBluetoothPairing(address) {
  if (!window.Capacitor?.isNativePlatform?.()) return { success: false };
  try { return await (await getPlugin()).requestPairing({ address }); }
  catch(e) { return { success: false, error: e.message }; }
}

export async function connectBluetoothPrinter(address) {
  if (!window.Capacitor?.isNativePlatform?.()) return { connected: false };
  try {
    return await Promise.race([
      (await getPlugin()).connect({ address }),
      new Promise((_,r) => setTimeout(()=>r(new Error('Connection timeout')), 12000))
    ]);
  } catch(e) { return { connected: false, error: e.message }; }
}

export async function disconnectBluetoothPrinter(address) {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try { await (await getPlugin()).disconnect({ address }); } catch(_) {}
}

export async function getBluetoothConnectionState(address) {
  if (!window.Capacitor?.isNativePlatform?.()) return { state: 'disconnected' };
  try { return await (await getPlugin()).getConnectionState({ address }); }
  catch(_) { return { state: 'disconnected' }; }
}

export function addBluetoothConnectionListener(callback) {
  if (!window.Capacitor?.isNativePlatform?.()) return () => {};
  try {
    const p = window.Capacitor.Plugins.EscPos || _plugin;
    if (!p) return () => {};
    p.addListener('connectionState', callback);
    return () => { try { p.removeAllListeners(); } catch(_) {} };
  } catch(_) { return () => {}; }
}

export function addBluetoothScanListener(callback) {
  if (!window.Capacitor?.isNativePlatform?.()) return () => {};
  try {
    const p = window.Capacitor.Plugins.EscPos || _plugin;
    if (!p) return () => {};
    p.addListener('scanResult', callback);
    return () => { try { p.removeAllListeners(); } catch(_) {} };
  } catch(_) { return () => {}; }
}

// ─── escPosPrint ─────────────────────────────────────────────────────────────
async function escPosPrint(address, byteArr) {
  try {
    const p = await getPlugin();
    const hex = toHex(byteArr);
    await Promise.race([
      p.printHex({ address, hex }),
      new Promise((_,r) => setTimeout(()=>r(new Error('No response after 15s')), 15000))
    ]);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message || String(e) };
  }
}

// ─── testBluetoothPrinter ────────────────────────────────────────────────────
export async function testBluetoothPrinter(address) {
  const now = new Date(); const W = 32;
  const testBytes = bytes(
    B.INIT, B.CENTER, B.BOLD_ON,
    sep(W,'='), line('PRINTER TEST'), sep(W,'='), B.BOLD_OFF,
    cLine(now.toLocaleDateString('en-IN')+' '+now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}), W),
    sep(W,'-'), bytes(B.BOLD_ON, line('CONNECTION OK'), B.BOLD_OFF),
    line('WaitNot POS'), sep(W,'='), lf(1), B.CUT,
  );
  return escPosPrint(address, testBytes);
}

// ─── QZ Tray ─────────────────────────────────────────────────────────────────
async function qzPrintHTML(html, printerName) {
  if (!qzConnected) { const ok = await connectQZ(); if (!ok) return false; }
  try {
    const config = qz.configs.create(printerName, { margins:{top:0,right:0,bottom:0,left:0}, size:{width:80,height:null}, units:'mm', copies:1, colorType:'blackwhite' });
    await qz.print(config, [{ type:'pixel', format:'html', flavor:'plain', data:html }]);
    return true;
  } catch(e) { return false; }
}

// ─── Browser fallback ─────────────────────────────────────────────────────────
function browserPrint(html) {
  const w = window.open('','_blank','width=420,height=700');
  if (!w) {
    const iframe = document.createElement('iframe');
    iframe.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:none;visibility:hidden';
    document.body.appendChild(iframe);
    iframe.contentDocument.write(html); iframe.contentDocument.close();
    setTimeout(()=>{ iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(()=>document.body.removeChild(iframe),1000); },300);
    return;
  }
  w.document.write(html); w.document.close();
  setTimeout(()=>{ w.focus(); w.print(); w.onafterprint=()=>w.close(); setTimeout(()=>{ try{w.close();}catch{} },5000); },350);
}

// ─── smartPrint ───────────────────────────────────────────────────────────────
export async function smartPrint(html, type='bill', orderData=null) {
  // 1. Electron
  if (window.electronAPI?.printKOT && orderData) {
    let r;
    if (type==='kitchen'&&orderData.order) r=await electronPrintKOT(orderData.order,orderData.restaurantName);
    else if (type==='bill'&&orderData.orders) r=await electronPrintBill(orderData.orders,orderData.tableLabel,orderData.total,orderData.restaurantName);
    if (r?.success) return { method:'electron-escpos' };
  }
  if (window.electronAPI?.silentPrint) {
    const s=getSavedSettings();
    const pn=type==='kitchen'?(s.qzKitchenPrinter||s.kitchenPrinterName||''):(s.qzBillPrinter||s.cashCounterPrinterName||'');
    const r=await window.electronAPI.silentPrint(html,pn);
    if (r?.success) return { method:'electron-html' };
  }

  // 2. Android BT
  if (window.Capacitor?.isNativePlatform?.()) {
    const s=getSavedSettings();
    const address=type==='kitchen'?s.btKitchenPrinter:s.btBillPrinter;
    if (!address) { console.warn('No printer address for type:', type, 'settings:', s); return { method:'none', error:'No printer configured' }; }

    let byteArr=null;
    try {
      if (type==='kitchen'&&orderData?.order) {
        const o=orderData.order;
        byteArr=buildKOTBytes({ restaurantName:orderData.restaurantName, slotLabel:o.tableNumber?'TABLE '+o.tableNumber:o.roomNumber?'ROOM '+o.roomNumber:(o.orderType||'').toUpperCase(), orderId:o._id, orderType:o.orderType, customerName:o.customerName, deliveryAddress:o.deliveryAddress, specialInstructions:o.specialInstructions, items:o.items });
      } else if (type==='bill'&&orderData?.orders) {
        const im={};
        orderData.orders.forEach(o=>o.items?.forEach(i=>{ if(im[i.name]) im[i.name].quantity+=i.quantity; else im[i.name]={name:i.name,quantity:i.quantity,price:i.price}; }));
        const o0=orderData.orders[0]||{};
        byteArr=buildBillBytes({ restaurantName:orderData.restaurantName, slotLabel:orderData.tableLabel, orderType:o0.orderType, customerName:o0.customerName, customerPhone:o0.customerPhone, deliveryAddress:o0.deliveryAddress, items:Object.values(im), packagingCharge:o0.packagingCharge, deliveryCharge:o0.deliveryCharge, paymentMethod:o0.paymentMethod });
      }
    } catch(e) { console.warn('byte build error:',e); }

    if (!byteArr) {
      const div=document.createElement('div'); div.innerHTML=html;
      const t=(div.innerText||div.textContent||'').trim()+'\n\n';
      byteArr=[]; for(let i=0;i<t.length;i++) byteArr.push(t.charCodeAt(i)&0xFF);
    }

    const res=await escPosPrint(address,byteArr);
    if (res.success) return { method:'escpos-bt' };
    console.error('BT print failed:', res.error);
    return { method:'none', error:res.error };
  }

  // 3. QZ Tray
  const s=getSavedSettings();
  if (s.useQZTray) {
    const pn=type==='kitchen'?s.qzKitchenPrinter:s.qzBillPrinter;
    if (pn) { const ok=await qzPrintHTML(html,pn); if(ok) return { method:'qz' }; }
  }

  // 4. Browser
  browserPrint(html);
  return { method:'browser' };
}
