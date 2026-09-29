/**
 * WaitNot ESC/POS Thermal Printer Module
 *
 * Sends raw ESC/POS bytes directly to thermal printers via COPY /B on Windows.
 * No Windows GDI, no print dialog, no scaling ΓÇö raw ESC/POS only.
 *
 * Paper widths:
 *   58mm ΓåÆ 32 characters per line
 *   80mm ΓåÆ 48 characters per line
 */

'use strict';

const { exec } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ΓöÇΓöÇΓöÇ Printer discovery ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
async function listPrinters(webContents) {
  try {
    const printers = await webContents.getPrintersAsync();
    return printers.map(p => ({
      name: p.name,
      isDefault: p.isDefault,
      status: p.status === 0 ? 'ready' : 'unavailable',
      description: p.description || '',
    }));
  } catch (e) {
    console.error('listPrinters error:', e);
    return [];
  }
}

// ΓöÇΓöÇΓöÇ Windows raw print via COPY /B ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
async function rawPrintWindows(printerName, buffer) {
  return new Promise((resolve) => {
    const tmpFile = path.join(os.tmpdir(), `wn-escpos-${Date.now()}.bin`);
    try { fs.writeFileSync(tmpFile, buffer); }
    catch (e) { return resolve({ success: false, error: `write tmp: ${e.message}` }); }

    // COPY /B bypasses Windows GDI ΓÇö raw bytes go directly to printer queue
    const cmd = `COPY /B "${tmpFile}" "${printerName}"`;
    exec(cmd, (err) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      if (err) {
        console.warn(`[printer] COPY /B failed: ${err.message}`);
        resolve({ success: false, error: err.message });
      } else {
        console.log(`[printer] Γ£à ESC/POS sent to "${printerName}"`);
        resolve({ success: true });
      }
    });
  });
}

async function rawPrintUnix(printerName, buffer) {
  return new Promise((resolve) => {
    const tmpFile = path.join(os.tmpdir(), `wn-escpos-${Date.now()}.bin`);
    try { fs.writeFileSync(tmpFile, buffer); }
    catch (e) { return resolve({ success: false, error: e.message }); }
    exec(`lp -d "${printerName}" "${tmpFile}"`, (err) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      resolve(err ? { success: false, error: err.message } : { success: true });
    });
  });
}

// ΓöÇΓöÇΓöÇ ESC/POS byte constants ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

const INIT             = [ESC, 0x40];
const ALIGN_LEFT       = [ESC, 0x61, 0x00];
const ALIGN_CENTER     = [ESC, 0x61, 0x01];
const BOLD_ON          = [ESC, 0x45, 0x01];
const BOLD_OFF         = [ESC, 0x45, 0x00];
const DOUBLE_WIDTH_ON  = [ESC, 0x21, 0x20];   // double-width only
const DOUBLE_WIDTH_OFF = [ESC, 0x21, 0x00];
const CUT_PARTIAL      = [GS,  0x56, 0x01];
function feed(n = 1)   { return Array(n).fill(LF); }

// ΓöÇΓöÇΓöÇ Layout helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function getWidth(paperWidth) {
  return paperWidth === '80mm' ? 48 : 32;  // characters per line
}

function textLine(text) {
  return [...Buffer.from(text + '\n', 'utf8')];
}

function separatorLine(char, width) {
  return textLine(char.repeat(width));
}

/** Left-pad text to fill the line width */
function rightAlign(text, width) {
  return text.padStart(width);
}

/** Two-column line: left text + right text with spaces filling the gap */
function twoCol(left, right, width) {
  const gap = Math.max(1, width - left.length - right.length);
  return textLine(left + ' '.repeat(gap) + right);
}

/** Centre a string within `width` characters */
function centre(text, width) {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return textLine(' '.repeat(pad) + text);
}

// ΓöÇΓöÇΓöÇ KOT builder ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function buildKOTBuffer(data) {
  const {
    restaurantName = 'RESTAURANT',
    orderId = '',
    tableNumber,
    roomNumber,
    orderType = 'dine-in',
    customerName,
    deliveryAddress,
    items = [],
    time = '',
    paperWidth = '80mm',
  } = data;

  const W   = getWidth(paperWidth);
  const SEP = separatorLine('-', W);
  const b   = [];

  // ΓöÇΓöÇ Header ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  b.push(...INIT);
  b.push(...ALIGN_CENTER);
  b.push(...BOLD_ON);
  b.push(...textLine(restaurantName.substring(0, W).toUpperCase()));
  b.push(...BOLD_OFF);
  b.push(...textLine('KITCHEN ORDER TICKET'));
  b.push(...SEP);

  // ΓöÇΓöÇ Order info ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  b.push(...ALIGN_LEFT);
  if (tableNumber)                b.push(...twoCol('TABLE :', String(tableNumber), W));
  if (roomNumber)                 b.push(...twoCol('ROOM  :', String(roomNumber),  W));
  if (orderType === 'takeaway')   b.push(...textLine('TYPE  : TAKEAWAY'));
  if (orderType === 'delivery')   b.push(...textLine('TYPE  : DELIVERY'));
  if (customerName)               b.push(...textLine(('NAME  : ' + customerName).substring(0, W)));
  if (deliveryAddress)            b.push(...textLine(('ADDR  : ' + deliveryAddress).substring(0, W)));
  b.push(...twoCol('REF   :', (orderId || '').slice(-8).toUpperCase(), W));
  b.push(...twoCol('TIME  :', time, W));
  b.push(...SEP);

  // ΓöÇΓöÇ Items ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  b.push(...ALIGN_CENTER);
  b.push(...textLine('-- ITEMS TO PREPARE --'));
  b.push(...ALIGN_LEFT);
  b.push(...SEP);

  b.push(...BOLD_ON);
  const nameW = W - 6;  // leave 6 chars for " x999"
  items.forEach(item => {
    const qty   = `x${item.quantity || 1}`;
    const name  = String(item.name || '').substring(0, nameW);
    b.push(...twoCol(name, qty, W));
  });
  b.push(...BOLD_OFF);

  // ΓöÇΓöÇ Footer ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  b.push(...SEP);
  b.push(...ALIGN_CENTER);
  b.push(...textLine('PREPARE WITH CARE'));
  b.push(...feed(4));
  b.push(...CUT_PARTIAL);

  return Buffer.from(b);
}

// ΓöÇΓöÇΓöÇ Bill builder ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function buildBillBuffer(data) {
  const {
    restaurantName = 'RESTAURANT',
    tableLabel = '',
    items = [],
    total = 0,
    paymentMethod = 'CASH',
    time = '',
    date = '',
    footerText = 'Thank you! Visit Again',
    paperWidth = '80mm',
    packagingCharge = 0,
    deliveryCharge  = 0,
    discount        = 0,
  } = data;

  const W   = getWidth(paperWidth);
  const SEP = separatorLine('-', W);
  const b   = [];

  // ΓöÇΓöÇ Header ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  b.push(...INIT);
  b.push(...ALIGN_CENTER);
  b.push(...BOLD_ON);
  b.push(...textLine(restaurantName.substring(0, W).toUpperCase()));
  b.push(...BOLD_OFF);
  b.push(...textLine('BILL / RECEIPT'));
  b.push(...SEP);

  // ΓöÇΓöÇ Meta ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  b.push(...ALIGN_LEFT);
  if (tableLabel) b.push(...twoCol('REF     :', tableLabel, W));
  if (date)       b.push(...twoCol('DATE    :', date,       W));
  if (time)       b.push(...twoCol('TIME    :', time,       W));
  b.push(...SEP);

  // ΓöÇΓöÇ Column header ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  // Layout: ITEM NAME (left) | QTY (right-3) | AMT (right-6)
  // 58mm (W=32): name=20, qty=3, gap=1, amt=8
  // 80mm (W=48): name=32, qty=4, gap=1, amt=11
  const amtW  = W === 32 ? 8  : 11;
  const qtyW  = W === 32 ? 3  : 4;
  const nameW = W - amtW - qtyW - 2; // 2 spaces between cols

  b.push(...BOLD_ON);
  const hdr = 'ITEM'.padEnd(nameW)
            + ' ' + 'QTY'.padStart(qtyW)
            + ' ' + 'AMT'.padStart(amtW);
  b.push(...textLine(hdr.substring(0, W)));
  b.push(...BOLD_OFF);
  b.push(...SEP);

  // ΓöÇΓöÇ Items ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  let subtotal = 0;
  items.forEach(item => {
    const price  = parseFloat(item.price) || 0;
    const qty    = parseInt(item.qty || item.quantity) || 1;
    const lineAmt = price * qty;
    subtotal += lineAmt;

    const nameStr = String(item.name || '').substring(0, nameW).padEnd(nameW);
    const qtyStr  = String(qty).padStart(qtyW);
    const amtStr  = String(Math.round(lineAmt)).padStart(amtW);
    b.push(...textLine(`${nameStr} ${qtyStr} ${amtStr}`.substring(0, W)));
  });

  b.push(...SEP);

  // ΓöÇΓöÇ Charges & discounts ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const hasCharges = parseFloat(packagingCharge) > 0 || parseFloat(deliveryCharge) > 0 || parseFloat(discount) > 0;
  if (hasCharges) {
    if (parseFloat(packagingCharge) > 0) {
      b.push(...twoCol('Packaging:', `Rs.${parseFloat(packagingCharge).toFixed(2)}`, W));
    }
    if (parseFloat(deliveryCharge) > 0) {
      b.push(...twoCol('Delivery:', `Rs.${parseFloat(deliveryCharge).toFixed(2)}`, W));
    }
    if (parseFloat(discount) > 0) {
      b.push(...twoCol('Discount:', `-Rs.${parseFloat(discount).toFixed(2)}`, W));
    }
    b.push(...SEP);
  }

  // ΓöÇΓöÇ Total ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  b.push(...BOLD_ON);
  const grandTotal = parseFloat(total) || (subtotal + parseFloat(packagingCharge||0) + parseFloat(deliveryCharge||0) - parseFloat(discount||0));
  b.push(...twoCol('TOTAL:', `Rs.${grandTotal.toFixed(2)}`, W));
  b.push(...BOLD_OFF);

  if (paymentMethod) {
    b.push(...twoCol('PAYMENT:', paymentMethod.toUpperCase(), W));
  }
  b.push(...SEP);

  // ΓöÇΓöÇ Footer ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  b.push(...ALIGN_CENTER);
  b.push(...textLine(footerText.substring(0, W)));
  b.push(...feed(4));
  b.push(...CUT_PARTIAL);

  return Buffer.from(b);
}

// ΓöÇΓöÇΓöÇ Public print functions ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
async function printKOT(data, printerName) {
  try {
    if (!printerName || !printerName.trim()) {
      return { success: false, error: 'No printer name provided' };
    }
    const buf = buildKOTBuffer(data);
    return process.platform === 'win32'
      ? rawPrintWindows(printerName.trim(), buf)
      : rawPrintUnix(printerName.trim(), buf);
  } catch (e) {
    console.error('[printer] printKOT error:', e.message);
    return { success: false, error: e.message };
  }
}

async function printBill(data, printerName) {
  try {
    if (!printerName || !printerName.trim()) {
      return { success: false, error: 'No printer name provided' };
    }
    const buf = buildBillBuffer(data);
    return process.platform === 'win32'
      ? rawPrintWindows(printerName.trim(), buf)
      : rawPrintUnix(printerName.trim(), buf);
  } catch (e) {
    console.error('[printer] printBill error:', e.message);
    return { success: false, error: e.message };
  }
}

module.exports = { listPrinters, printKOT, printBill, buildKOTBuffer, buildBillBuffer };
