'use strict';
/**
 * WaitNot ESC/POS Byte Builder — Desktop (Electron)
 * Exact layout partner to buildKOTBytes / buildBillBytes in qzPrint.js.
 * Change both files together; they must stay in sync.
 *
 * Currency: "Rs." — ₹ is outside standard ESC/POS codepages.
 */

// ─── ESC/POS command bytes ────────────────────────────────────────────────────
const B = {
  INIT:       [0x1B, 0x40],
  BOLD_ON:    [0x1B, 0x45, 0x01],
  BOLD_OFF:   [0x1B, 0x45, 0x00],
  CENTER:     [0x1B, 0x61, 0x01],
  LEFT:       [0x1B, 0x61, 0x00],
  DOUBLE_ON:  [0x1B, 0x21, 0x30],
  DOUBLE_OFF: [0x1B, 0x21, 0x00],
  CUT:        [0x1D, 0x56, 0x42, 0x03],
  LF:         [0x0A],
};

// ─── Byte helpers ─────────────────────────────────────────────────────────────
function bytes(...parts) {
  const out = [];
  for (const p of parts) {
    if (Array.isArray(p))           out.push(...p);
    else if (typeof p === 'string') { for (let i = 0; i < p.length; i++) out.push(p.charCodeAt(i) & 0xFF); }
    else if (typeof p === 'number') out.push(p & 0xFF);
  }
  return out;
}
function toHex(arr) { return arr.map(b => b.toString(16).padStart(2, '0')).join(''); }
function lf(n = 1) { const o = []; for (let i = 0; i < n; i++) o.push(...B.LF); return o; }
function line(t) { return bytes(t, B.LF); }
/** Centre-pad text to W chars; truncate silently if over. */
function cLine(t, W) {
  const s = String(t).substring(0, W);
  return line(' '.repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s);
}
/**
 * Left label + right value exactly W chars wide.
 * Left label is truncated only as a safety net — callers must pre-size.
 * Gap is at least 1 space.
 */
function lrLine(l, r, W) {
  const rv = String(r);
  const lv = String(l).substring(0, W - rv.length - 1);
  return line(lv + ' '.repeat(Math.max(1, W - lv.length - rv.length)) + rv);
}
function sep(W, c) { return line(c.repeat(W)); }

// ─── Width ────────────────────────────────────────────────────────────────────
/**
 * Resolve chars-per-line.
 * @param {string} paperWidth  "80mm" | "58mm" | anything-else
 * @param {number} [override]  explicit CPL from printer settings (42 or 48)
 */
function charsPerLine(paperWidth, override) {
  if (paperWidth === '80mm') return override || 48;
  return 32; // 58mm
}

// ─── Name-wrap helper ─────────────────────────────────────────────────────────
/**
 * Wrap a long name across multiple lines, each at most maxW chars.
 * Returns an array of lines (strings, no LF yet).
 */
function wrapName(name, maxW) {
  const words = String(name).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? cur + ' ' + w : w;
    if (candidate.length <= maxW) { cur = candidate; }
    else {
      if (cur) lines.push(cur);
      // If single word is still too long, hard-break it
      let remaining = w;
      while (remaining.length > maxW) {
        lines.push(remaining.substring(0, maxW));
        remaining = remaining.substring(maxW);
      }
      cur = remaining;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// ─── Item rows ────────────────────────────────────────────────────────────────
/**
 * Build item rows for a bill.
 *
 * 58mm (W=32): single lrLine  "name xN       Rs.amt"
 * 80mm (W=42 or 48): 4-column table
 *   W=42 → item 20 | qty 4 | rate 8  | amt 10
 *   W=48 → item 22 | qty 4 | rate 10 | amt 12
 *
 * Long names wrap; continuation lines are indented with spaces and no numbers.
 */
function buildItemRows(bi, W) {
  const result = [];

  if (W <= 32) {
    // 58mm layout: "name xN   Rs.amt"
    result.push(bytes(B.BOLD_ON, lrLine('ITEM', 'AMT', W), B.BOLD_OFF));
    result.push(sep(W, '-'));
    for (const i of bi) {
      const qty    = ' x' + i.quantity;
      const amt    = i.complimentary ? 'COMP' : 'Rs.' + (i.price * i.quantity).toFixed(0);
      const maxN   = W - amt.length - qty.length - 1;
      const nameChunk = i.name.substring(0, Math.max(1, maxN));
      result.push(lrLine(nameChunk + qty, amt, W));
      // If name was longer than maxN, continue on next line(s)
      if (i.name.length > maxN) {
        const rest = i.name.substring(maxN);
        const chunks = wrapName(rest, W - 2);
        for (const ch of chunks) result.push(line('  ' + ch));
      }
    }
    return result;
  }

  // 80mm layout — 4 columns
  const cols = W >= 46
    ? { item: 22, qty: 4, rate: 10, amt: 12 }  // W=48
    : { item: 20, qty: 4, rate: 8,  amt: 10 }; // W=42

  // Column header
  const hdr =
    'ITEM'.padEnd(cols.item) +
    'QTY'.padStart(cols.qty) +
    'RATE'.padStart(cols.rate) +
    'AMT'.padStart(cols.amt);
  result.push(bytes(B.BOLD_ON, line(hdr), B.BOLD_OFF));
  result.push(sep(W, '-'));

  for (const i of bi) {
    const qtyStr  = String(i.quantity).padStart(cols.qty);
    const rateStr = i.complimentary ? 'COMP'.padStart(cols.rate) : ('Rs.' + i.price.toFixed(0)).padStart(cols.rate);
    const amtStr  = i.complimentary ? 'COMP'.padStart(cols.amt)  : ('Rs.' + (i.price * i.quantity).toFixed(0)).padStart(cols.amt);

    const nameLines = wrapName(i.name, cols.item);
    // First line: name + all columns
    const firstLine =
      nameLines[0].padEnd(cols.item) + qtyStr + rateStr + amtStr;
    result.push(line(firstLine));
    // Continuation lines: indented name only
    for (let n = 1; n < nameLines.length; n++) {
      result.push(line('  ' + nameLines[n]));
    }
  }

  return result;
}

// ─── KOT builder ─────────────────────────────────────────────────────────────
function buildKOTBytes({
  restaurantName, slotLabel, orderId, orderType,
  customerName, deliveryAddress, specialInstructions,
  items, paperWidth, charsPerLineOverride,
}) {
  const W = charsPerLine(paperWidth, charsPerLineOverride);
  console.log(`ESC/POS KOT paperWidth=${paperWidth} W=${W}`);
  const now = new Date();

  // KOT item rows: name wrapped, qty right-aligned, no prices
  const itemRows = (items || []).map(i => {
    const qty     = 'x' + (i.quantity || i.qty || 1);
    const maxName = W - qty.length - 1;
    const nameLines = wrapName(String(i.name), maxName);
    const out = [bytes(B.BOLD_ON, lrLine(nameLines[0], qty, W), B.BOLD_OFF)];
    for (let n = 1; n < nameLines.length; n++) {
      out.push(bytes(B.BOLD_ON, line('  ' + nameLines[n]), B.BOLD_OFF));
    }
    return out;
  }).flat();

  return bytes(
    B.INIT,
    B.CENTER, B.DOUBLE_ON, B.BOLD_ON,
    line((restaurantName || 'RESTAURANT').toUpperCase().substring(0, Math.floor(W / 2))),
    B.DOUBLE_OFF,
    line('KITCHEN ORDER TICKET'),
    orderType ? line(orderType.toUpperCase()) : [],
    B.BOLD_OFF,
    sep(W, '='),
    B.LEFT,
    slotLabel ? bytes(B.BOLD_ON, lrLine('SLOT:', slotLabel, W), B.BOLD_OFF) : [],
    lrLine('DATE:', now.toLocaleDateString('en-IN'), W),
    bytes(B.BOLD_ON, lrLine('TIME:', now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), W), B.BOLD_OFF),
    orderId ? lrLine('REF:', String(orderId).slice(-8).toUpperCase(), W) : [],
    customerName ? lrLine('NAME:', customerName, W) : [],
    deliveryAddress ? line('ADDR: ' + deliveryAddress) : [],
    sep(W, '='),
    B.CENTER, B.BOLD_ON, line('-- ITEMS TO PREPARE --'), B.BOLD_OFF,
    sep(W, '='),
    B.LEFT,
    ...itemRows,
    sep(W, '='),
    specialInstructions ? bytes(B.BOLD_ON, line('NOTE: ' + specialInstructions), B.BOLD_OFF, sep(W, '-')) : [],
    B.CENTER, B.BOLD_ON, line('PREPARE WITH CARE'), B.BOLD_OFF,
    lf(1), B.CUT,
  );
}

// ─── Bill builder ─────────────────────────────────────────────────────────────
function buildBillBytes({
  restaurantName, slotLabel, orderType,
  customerName, customerPhone, deliveryAddress, paymentMethod,
  packagingCharge, deliveryCharge, extraCharge = 0, extraChargeLabel = '',
  items, paperWidth, charsPerLineOverride,
}) {
  const W = charsPerLine(paperWidth, charsPerLineOverride);
  console.log(`ESC/POS Bill paperWidth=${paperWidth} W=${W}`);
  const now = new Date();

  const bi = (items || []).map(i => ({
    name:          String(i.name || ''),
    price:         parseFloat(i.price) || 0,
    quantity:      parseInt(i.quantity || i.qty) || 1,
    complimentary: !!i.complimentary,
  }));

  const subtotal = bi.filter(i => !i.complimentary).reduce((s, i) => s + i.price * i.quantity, 0);
  const pkg      = parseFloat(packagingCharge) || 0;
  const dlv      = parseFloat(deliveryCharge)  || 0;
  const exAmt    = parseFloat(extraCharge)     || 0;
  const extra    = pkg + dlv + exAmt;
  const total    = subtotal + extra;
  const showSub  = extra > 0;

  const receiptType =
    orderType === 'delivery' ? 'DELIVERY RECEIPT'  :
    orderType === 'takeaway' ? 'TAKEAWAY RECEIPT'  :
    orderType === 'room'     ? 'ROOM RECEIPT'       :
                               'DINE-IN RECEIPT';

  // TOTAL line: double-width halves available columns → use W/2
  // lrLine works in logical chars; printer doubles each char's width.
  // So we pass W/2 as the effective width for the TOTAL lrLine.
  const totalW = Math.floor(W / 2);
  const totalLine = lrLine('TOTAL:', 'Rs.' + total.toFixed(0), totalW);

  // Charges with label truncation
  const chargeLabel = (label, maxLen) =>
    label.length > maxLen ? label.substring(0, maxLen - 1) + ':' : label + ':';

  return bytes(
    B.INIT,
    B.CENTER, B.DOUBLE_ON, B.BOLD_ON,
    line((restaurantName || 'RESTAURANT').toUpperCase().substring(0, Math.floor(W / 2))),
    B.DOUBLE_OFF,
    line(receiptType),
    B.BOLD_OFF,
    sep(W, '='),
    B.LEFT,
    slotLabel    ? bytes(B.BOLD_ON, lrLine('SLOT:', slotLabel, W), B.BOLD_OFF) : [],
    lrLine('DATE:', now.toLocaleDateString('en-IN'), W),
    lrLine('TIME:', now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), W),
    customerName  ? lrLine('NAME:', customerName, W)   : [],
    customerPhone ? lrLine('PHONE:', customerPhone, W)  : [],
    paymentMethod ? bytes(B.BOLD_ON, lrLine('PAYMENT:', paymentMethod.toUpperCase(), W), B.BOLD_OFF) : [],
    deliveryAddress ? line('ADDR: ' + deliveryAddress) : [],
    sep(W, '='),

    ...buildItemRows(bi, W),

    sep(W, '='),
    showSub ? lrLine('SUBTOTAL:', 'Rs.' + subtotal.toFixed(0), W) : [],
    pkg   > 0 ? lrLine('PACKAGING:', 'Rs.' + pkg.toFixed(0), W) : [],
    dlv   > 0 ? lrLine('DELIVERY:',  'Rs.' + dlv.toFixed(0), W) : [],
    exAmt > 0 ? lrLine(chargeLabel((extraChargeLabel || 'EXTRA').toUpperCase(), W - 10), 'Rs.' + exAmt.toFixed(0), W) : [],

    // TOTAL in double width — reset immediately after
    B.BOLD_ON, B.DOUBLE_ON,
    totalLine,
    B.DOUBLE_OFF, B.BOLD_OFF,
    B.LEFT,

    sep(W, '='),
    B.CENTER,
    line('THANK YOU! VISIT AGAIN'),
    line('* * * * * * * *'),
    lf(1), B.CUT,
  );
}

// ─── Test strip ───────────────────────────────────────────────────────────────
/**
 * Print a width-test strip.
 * Prints a 48-char ruler, then a sep(W,'=') line.
 * If the 48-char line wraps at 42, set charsPerLineOverride to 42.
 */
function buildTestStrip(paperWidth, charsPerLineOverride) {
  const W = charsPerLine(paperWidth, charsPerLineOverride);
  const ruler48 = '123456789012345678901234567890123456789012345678';
  return bytes(
    B.INIT,
    B.LEFT,
    line('WIDTH TEST: paperWidth=' + (paperWidth || '?') + ' W=' + W),
    line(ruler48),
    sep(W, '='),
    line('If ruler wrapped: set override=42'),
    lf(2), B.CUT,
  );
}

module.exports = { buildKOTBytes, buildBillBytes, buildTestStrip, charsPerLine, toHex, B };
