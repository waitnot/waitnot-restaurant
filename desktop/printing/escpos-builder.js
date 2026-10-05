/**
 * WaitNot ESC/POS Byte Builder — Desktop (Electron)
 *
 * EXACT PORT of the mobile byte builders from:
 *   client/src/utils/qzPrint.js  →  buildKOTBytes / buildBillBytes
 *
 * Pure CommonJS. Zero imports. No Capacitor. No React. No Android APIs.
 * Drop this file into the Electron main process and require() it.
 *
 * ─── Paper width ──────────────────────────────────────────────────────────────
 * W = 32  →  58 mm roll  (default, most common desktop thermal printer)
 * W = 48  →  80 mm roll  (pass { paperWidth: '80mm' } to override)
 *
 * ─── Currency ─────────────────────────────────────────────────────────────────
 * Uses "Rs." NOT "₹".  The ₹ Unicode character is outside the standard
 * ESC/POS codepage and prints as garbage on most thermal printers.
 *
 * ─── Item name rule ───────────────────────────────────────────────────────────
 * Names are TRUNCATED, not wrapped.
 *   KOT  : name cut at 24 chars,  quantity right-aligned  → total 32 chars
 *   Bill : name+qty cut at 20 chars, amount right-aligned  → total 32 chars
 *
 * ─── How to send bytes to the printer on PC ───────────────────────────────────
 * Option A — Network (WiFi) printer on port 9100:
 *   const net = require('net');
 *   const sock = net.createConnection(9100, '192.168.1.100');
 *   sock.on('connect', () => { sock.write(Buffer.from(byteArr)); sock.end(); });
 *
 * Option B — USB / serial printer via node-escpos or node-serialport:
 *   const { Printer, USB } = require('escpos');
 *   const device = new USB(); const printer = new Printer(device);
 *   device.open(() => { printer.raw(Buffer.from(byteArr)).close(); });
 *
 * Option C — Electron silent HTML print (current desktop fallback):
 *   See print-handler.js → silentPrintHTML()
 *
 * ─── Sample KOT input ─────────────────────────────────────────────────────────
 * buildKOTBytes({
 *   restaurantName:      "Hotel King",
 *   slotLabel:           "TABLE 3",           // "ROOM 2" | "TAKEAWAY" | "DELIVERY"
 *   orderId:             "64f3a2b1c9e4",       // last 8 chars printed
 *   orderType:           "dine-in",            // "room" | "takeaway" | "delivery"
 *   customerName:        "Waiter W01",         // optional — omit → no NAME line
 *   deliveryAddress:     null,                 // optional
 *   specialInstructions: null,                 // optional
 *   items: [
 *     { name: "Butter Chicken", quantity: 2 },
 *     { name: "Garlic Naan",    quantity: 4 },
 *   ]
 * })
 *
 * ─── Sample Bill input ────────────────────────────────────────────────────────
 * buildBillBytes({
 *   restaurantName:  "Hotel King",
 *   slotLabel:       "TABLE 3",
 *   orderType:       "dine-in",              // "room" | "takeaway" | "delivery"
 *   customerName:    "Rahul",                // optional
 *   customerPhone:   "9876543210",           // optional
 *   deliveryAddress: null,                   // optional
 *   paymentMethod:   "cash",                 // "upi" | "card" | "online"
 *   packagingCharge: 0,                      // 0 = line omitted
 *   deliveryCharge:  0,                      // 0 = line omitted
 *   items: [
 *     { name: "Butter Chicken", quantity: 2, price: 280, complimentary: false },
 *     { name: "Garlic Naan",    quantity: 4, price:  40, complimentary: false },
 *     { name: "Papad",          quantity: 2, price:  20, complimentary: true  },
 *   ]
 *   // NOTE: total is computed inside the function from items. Do NOT pass it.
 * })
 */

'use strict';

// ─── ESC/POS command bytes ────────────────────────────────────────────────────

const B = {
  INIT:       [0x1B, 0x40],           // Reset printer to defaults (Font A, left align)
  BOLD_ON:    [0x1B, 0x45, 0x01],
  BOLD_OFF:   [0x1B, 0x45, 0x00],
  CENTER:     [0x1B, 0x61, 0x01],
  LEFT:       [0x1B, 0x61, 0x00],
  DOUBLE_ON:  [0x1B, 0x21, 0x30],    // Double height + double width
  DOUBLE_OFF: [0x1B, 0x21, 0x00],
  CUT:        [0x1D, 0x56, 0x42, 0x03], // Full cut with feed
  LF:         [0x0A],                  // Line feed
};

// ─── Byte-array helpers ───────────────────────────────────────────────────────

/** Flatten arrays, strings, and numbers into a single byte array */
function bytes(...parts) {
  const out = [];
  for (const p of parts) {
    if (Array.isArray(p))        out.push(...p);
    else if (typeof p === 'string')  { for (let i = 0; i < p.length; i++) out.push(p.charCodeAt(i) & 0xFF); }
    else if (typeof p === 'number')  out.push(p & 0xFF);
  }
  return out;
}

/** Convert byte array to lowercase hex string: [0x1B,0x40] → "1b40" */
function toHex(arr) {
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** n × LF bytes */
function lf(n = 1) {
  const o = [];
  for (let i = 0; i < n; i++) o.push(...B.LF);
  return o;
}

/** Text string + LF as byte array */
function line(t) {
  return bytes(t, B.LF);
}

/**
 * Centre-aligned text padded to width W, + LF
 * Text is silently truncated if longer than W.
 */
function cLine(t, W) {
  const s = String(t).substring(0, W);
  return line(' '.repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s);
}

/**
 * Left label + right value padded to exactly W characters, + LF
 * Left label is truncated so left+gap+right == W.
 * The gap is at least 1 space.
 */
function lrLine(l, r, W) {
  const rv = String(r);
  const lv = String(l).substring(0, W - rv.length - 1);
  return line(lv + ' '.repeat(Math.max(1, W - lv.length - rv.length)) + rv);
}

/** Separator: character c repeated W times, + LF */
function sep(W, c) {
  return line(c.repeat(W));
}

// ─── Paper width helper ───────────────────────────────────────────────────────

/** Return chars-per-line for the given paper width string */
function charsPerLine(paperWidth) {
  return paperWidth === '80mm' ? 48 : 32;   // 58mm default = 32
}

// ─── KOT builder ─────────────────────────────────────────────────────────────

/**
 * Build a Kitchen Order Ticket byte array.
 *
 * @param {object} p
 * @param {string}   p.restaurantName
 * @param {string}   p.slotLabel           e.g. "TABLE 3", "ROOM 2", "TAKEAWAY"
 * @param {string}   [p.orderId]           full or partial order ID
 * @param {string}   [p.orderType]         "dine-in"|"room"|"takeaway"|"delivery"
 * @param {string}   [p.customerName]
 * @param {string}   [p.deliveryAddress]
 * @param {string}   [p.specialInstructions]
 * @param {Array}    p.items               [{name, quantity}]
 * @param {string}   [p.paperWidth]        "58mm" (default) | "80mm"
 * @returns {number[]} byte array ready to send to printer
 */
function buildKOTBytes({
  restaurantName,
  slotLabel,
  orderId,
  orderType,
  customerName,
  deliveryAddress,
  specialInstructions,
  items,
  paperWidth,
}) {
  const now = new Date();
  const W = charsPerLine(paperWidth);

  return bytes(
    // ── Header ──
    B.INIT,
    B.CENTER,
    B.DOUBLE_ON, B.BOLD_ON,
    line((restaurantName || 'RESTAURANT').toUpperCase().substring(0, 16)),
    B.DOUBLE_OFF,
    line('KITCHEN ORDER TICKET'),
    orderType ? line(orderType.toUpperCase()) : [],
    B.BOLD_OFF,
    sep(W, '='),

    // ── Order details ──
    B.LEFT,
    slotLabel
      ? bytes(B.BOLD_ON, lrLine('SLOT:', slotLabel, W), B.BOLD_OFF)
      : [],
    lrLine('DATE:', now.toLocaleDateString('en-IN'), W),
    bytes(B.BOLD_ON, lrLine('TIME:', now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), W), B.BOLD_OFF),
    orderId
      ? lrLine('REF:', String(orderId).slice(-8).toUpperCase(), W)
      : [],
    customerName
      ? lrLine('NAME:', customerName, W)
      : [],
    deliveryAddress
      ? line('ADDR: ' + deliveryAddress)
      : [],
    sep(W, '='),

    // ── Items ──
    B.CENTER, B.BOLD_ON,
    line('-- ITEMS TO PREPARE --'),
    B.BOLD_OFF,
    sep(W, '='),
    B.LEFT,
    ...(items || []).map(i =>
      // Name truncated to (W-6) chars, quantity right-aligned as "xN"
      bytes(
        B.BOLD_ON,
        lrLine(String(i.name).substring(0, W - 6), 'x' + (i.quantity || i.qty || 1), W),
        B.BOLD_OFF,
      )
    ),
    sep(W, '='),

    // ── Special instructions ──
    specialInstructions
      ? bytes(B.BOLD_ON, line('NOTE: ' + specialInstructions), B.BOLD_OFF, sep(W, '-'))
      : [],

    // ── Footer ──
    B.CENTER, B.BOLD_ON,
    line('PREPARE WITH CARE'),
    B.BOLD_OFF,
    lf(1),
    B.CUT,
  );
}

// ─── Bill builder ─────────────────────────────────────────────────────────────

/**
 * Build a Bill / Receipt byte array.
 *
 * @param {object} p
 * @param {string}   p.restaurantName
 * @param {string}   [p.slotLabel]         e.g. "TABLE 3"
 * @param {string}   [p.orderType]         "dine-in"|"room"|"takeaway"|"delivery"
 * @param {string}   [p.customerName]
 * @param {string}   [p.customerPhone]
 * @param {string}   [p.deliveryAddress]
 * @param {string}   [p.paymentMethod]     "cash"|"upi"|"card"|"online"
 * @param {number}   [p.packagingCharge]   0 = line omitted
 * @param {number}   [p.deliveryCharge]    0 = line omitted
 * @param {Array}    p.items               [{name, quantity, price, complimentary?}]
 * @param {string}   [p.paperWidth]        "58mm" (default) | "80mm"
 *
 * NOTE: total is computed from items inside this function. Do NOT pass a total.
 *
 * @returns {number[]} byte array ready to send to printer
 */
function buildBillBytes({
  restaurantName,
  slotLabel,
  orderType,
  customerName,
  customerPhone,
  deliveryAddress,
  paymentMethod,
  packagingCharge,
  deliveryCharge,
  items,
  paperWidth,
}) {
  const now = new Date();
  const W = charsPerLine(paperWidth);

  // Normalise items
  const bi = (items || []).map(i => ({
    name:         String(i.name || ''),
    price:        parseFloat(i.price)    || 0,
    quantity:     parseInt(i.quantity || i.qty) || 1,
    complimentary: !!i.complimentary,
  }));

  // Compute totals
  const subtotal  = bi.filter(i => !i.complimentary).reduce((s, i) => s + i.price * i.quantity, 0);
  const packAmt   = parseFloat(packagingCharge) || 0;
  const delivAmt  = parseFloat(deliveryCharge)  || 0;
  const total     = subtotal + packAmt + delivAmt;

  // Receipt type header
  const receiptType =
    orderType === 'delivery'  ? 'DELIVERY RECEIPT'  :
    orderType === 'takeaway'  ? 'TAKEAWAY RECEIPT'  :
    orderType === 'room'      ? 'ROOM RECEIPT'       :
                                'DINE-IN RECEIPT';

  // Column widths for item rows  (name+qty | amount)
  // Bill item format:  "Butter Chicken x2          Rs.560"
  //                     ^--- nameQtyCols ---^  ^amtCols^
  const amtCols     = 8;                         // "Rs.9999" = 7 chars + 1 space
  const nameQtyCols = W - amtCols;

  return bytes(
    // ── Header ──
    B.INIT,
    B.CENTER,
    B.DOUBLE_ON, B.BOLD_ON,
    line((restaurantName || 'RESTAURANT').toUpperCase().substring(0, 16)),
    B.DOUBLE_OFF,
    line(receiptType),
    B.BOLD_OFF,
    sep(W, '='),

    // ── Order details ──
    B.LEFT,
    slotLabel
      ? bytes(B.BOLD_ON, lrLine('SLOT:', slotLabel, W), B.BOLD_OFF)
      : [],
    lrLine('DATE:', now.toLocaleDateString('en-IN'), W),
    lrLine('TIME:', now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), W),
    customerName
      ? lrLine('NAME:', customerName, W)
      : [],
    customerPhone
      ? lrLine('PHONE:', customerPhone, W)
      : [],
    paymentMethod
      ? bytes(B.BOLD_ON, lrLine('PAYMENT:', paymentMethod.toUpperCase(), W), B.BOLD_OFF)
      : [],
    deliveryAddress
      ? line('ADDR: ' + deliveryAddress)
      : [],
    sep(W, '='),

    // ── Column header ──
    bytes(B.BOLD_ON, lrLine('ITEM', 'AMT', W), B.BOLD_OFF),
    sep(W, '-'),

    // ── Item rows ──
    // Name truncated to (nameQtyCols - " xN".length) so "name xN" fits left col
    ...bi.map(i => {
      const qtyStr  = ' x' + i.quantity;
      const maxName = nameQtyCols - qtyStr.length;
      const leftStr = i.name.substring(0, maxName) + qtyStr;
      const rightStr = i.complimentary
        ? 'COMP'
        : 'Rs.' + (i.price * i.quantity).toFixed(0);
      return lrLine(leftStr, rightStr, W);
    }),

    sep(W, '='),

    // ── Charges ──
    packAmt > 0
      ? lrLine('PACKAGING:', 'Rs.' + packAmt.toFixed(0), W)
      : [],
    delivAmt > 0
      ? lrLine('DELIVERY:', 'Rs.' + delivAmt.toFixed(0), W)
      : [],

    // ── Total (double size) ──
    bytes(
      B.BOLD_ON, B.DOUBLE_ON,
      lrLine('TOTAL:', 'Rs.' + total.toFixed(0), W),
      B.DOUBLE_OFF, B.BOLD_OFF,
    ),

    sep(W, '='),

    // ── Footer ──
    B.CENTER,
    line('THANK YOU! VISIT AGAIN'),
    line('* * * * * * * *'),
    lf(1),
    B.CUT,
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  buildKOTBytes,
  buildBillBytes,
  toHex,        // use toHex(byteArr) to get a hex string for debugging / TCP send
  B,            // ESC/POS command constants, in case you need custom sequences
};
