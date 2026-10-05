/**
 * escpos-bytes.js
 * ===============
 * Pure-JS ESC/POS byte builder — extracted verbatim from
 * client/src/utils/qzPrint.js (the mobile phone builder).
 *
 * NO imports. NO Capacitor. NO React. NO browser APIs.
 * Runs identically in Node.js (Electron main process).
 *
 * Usage (Electron / Node):
 *   const { buildKOTBytes, buildBillBytes, toHex } = require('./escpos-bytes');
 *   const bytes = buildBillBytes({ restaurantName, slotLabel, ... });
 *   const hex   = toHex(bytes);   // "1b402100..."
 *   // → send hex bytes to printer over USB / TCP / serial port
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PAPER WIDTH
 *   W = 32  →  58 mm roll  (default, most common desktop thermal printer)
 *   W = 48  →  80 mm roll  (change the W constant in each function if needed)
 *
 * CURRENCY
 *   Uses "Rs." — NOT "₹".
 *   The ₹ Unicode character is outside the standard ESC/POS code page and
 *   prints as garbage on most printers.
 *
 * ITEM NAME RULE
 *   Names are TRUNCATED, never wrapped.
 *   KOT  : name max 24 chars  →  "Butter Chicken          x2"
 *   Bill : name max 20 chars  →  "Butter Chicken    x2   Rs.560"
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ── ESC/POS command bytes ────────────────────────────────────────────────────

const B = {
  INIT:       [0x1B, 0x40],          // Reset printer to defaults
  BOLD_ON:    [0x1B, 0x45, 0x01],    // Bold text on
  BOLD_OFF:   [0x1B, 0x45, 0x00],    // Bold text off
  CENTER:     [0x1B, 0x61, 0x01],    // Align centre
  LEFT:       [0x1B, 0x61, 0x00],    // Align left
  DOUBLE_ON:  [0x1B, 0x21, 0x30],    // Double height + double width
  DOUBLE_OFF: [0x1B, 0x21, 0x00],    // Normal size
  CUT:        [0x1D, 0x56, 0x42, 0x03], // Full cut (feed + cut)
  LF:         [0x0A],                // Line feed
};

// ── Byte-array helpers ───────────────────────────────────────────────────────

/**
 * Merge arrays, strings (ASCII), and individual numbers into one byte array.
 * Strings are encoded char-by-char with (charCode & 0xFF) — safe for ASCII.
 */
function bytes(...parts) {
  const out = [];
  for (const p of parts) {
    if (Array.isArray(p))        { out.push(...p); }
    else if (typeof p === 'string') {
      for (let i = 0; i < p.length; i++) out.push(p.charCodeAt(i) & 0xFF);
    }
    else if (typeof p === 'number') { out.push(p & 0xFF); }
    // nested arrays from lrLine / cLine / sep return plain arrays — handled above
  }
  return out;
}

/**
 * Convert a byte array to a lowercase hex string.
 * [0x1B, 0x40, 0x41] → "1b4041"
 * This is what you send to the printer over TCP / USB / serial.
 */
function toHex(arr) {
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** n line-feed bytes */
function lf(n = 1) {
  const o = [];
  for (let i = 0; i < n; i++) o.push(...B.LF);
  return o;
}

/** One line of ASCII text followed by LF */
function line(t) {
  return bytes(t, B.LF);
}

/**
 * Centre-aligned text padded to W characters, then LF.
 * Text is truncated to W if longer.
 */
function cLine(t, W) {
  const s = String(t).substring(0, W);
  const pad = Math.max(0, Math.floor((W - s.length) / 2));
  return line(' '.repeat(pad) + s);
}

/**
 * Two-column line: left label + right value, total width W, then LF.
 * Left side is truncated so that label + gap + value fits in W chars.
 *
 * Example (W=32):
 *   lrLine('SLOT:', 'TABLE 3', 32)
 *   → "SLOT:                 TABLE 3\n"
 */
function lrLine(l, r, W) {
  const rv = String(r);
  const lv = String(l).substring(0, W - rv.length - 1);
  const gap = Math.max(1, W - lv.length - rv.length);
  return line(lv + ' '.repeat(gap) + rv);
}

/**
 * Full-width separator line of repeated character c, then LF.
 * sep(32, '=')  →  "================================\n"
 * sep(32, '-')  →  "--------------------------------\n"
 */
function sep(W, c) {
  return line(c.repeat(W));
}

// ── KOT builder ──────────────────────────────────────────────────────────────

/**
 * Build a Kitchen Order Ticket byte array.
 *
 * @param {object} params
 * @param {string}  params.restaurantName      "Hotel King"
 * @param {string}  params.slotLabel           "TABLE 3" | "ROOM 2" | "TAKEAWAY" | "DELIVERY"
 * @param {string}  params.orderId             order._id  (last 8 chars printed as REF)
 * @param {string}  params.orderType           "dine-in" | "room" | "takeaway" | "delivery"
 * @param {string}  [params.customerName]      optional  → NAME line
 * @param {string}  [params.deliveryAddress]   optional  → ADDR line
 * @param {string}  [params.specialInstructions] optional → NOTE line
 * @param {Array}   params.items               [{ name: string, quantity: number }]
 *
 * @returns {number[]}  raw byte array
 *
 * Sample call:
 *   buildKOTBytes({
 *     restaurantName:       "Hotel King",
 *     slotLabel:            "TABLE 3",
 *     orderId:              "64f3a2b1c9e41234",
 *     orderType:            "dine-in",
 *     customerName:         "Waiter W01",
 *     deliveryAddress:      null,
 *     specialInstructions:  null,
 *     items: [
 *       { name: "Butter Chicken", quantity: 2 },
 *       { name: "Garlic Naan",    quantity: 4 },
 *       { name: "Mango Lassi",    quantity: 1 },
 *     ]
 *   });
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
}) {
  const now = new Date();
  const W = 32; // characters per line for 58mm paper

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
    slotLabel ? bytes(B.BOLD_ON, lrLine('SLOT:', slotLabel, W), B.BOLD_OFF) : [],
    lrLine('DATE:', now.toLocaleDateString('en-IN'), W),
    bytes(B.BOLD_ON, lrLine('TIME:', now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), W), B.BOLD_OFF),
    orderId     ? lrLine('REF:',   String(orderId).slice(-8).toUpperCase(), W) : [],
    customerName? lrLine('NAME:',  customerName,    W) : [],
    deliveryAddress ? line('ADDR: ' + deliveryAddress) : [],
    sep(W, '='),

    // ── Items header ──
    B.CENTER, B.BOLD_ON,
    line('-- ITEMS TO PREPARE --'),
    B.BOLD_OFF,
    sep(W, '='),

    // ── Items list ──
    // Name truncated to 24 chars, quantity right-aligned: "Butter Chicken       x2"
    B.LEFT,
    ...(items || []).map(i =>
      bytes(
        B.BOLD_ON,
        lrLine(String(i.name).substring(0, 24), 'x' + i.quantity, W),
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

// ── Bill builder ─────────────────────────────────────────────────────────────

/**
 * Build a customer Bill / Receipt byte array.
 * Total is computed internally from items + charges (not passed in).
 *
 * @param {object}  params
 * @param {string}  params.restaurantName      "Hotel King"
 * @param {string}  params.slotLabel           "TABLE 3" | "ROOM 2" | "TAKEAWAY"
 * @param {string}  params.orderType           "dine-in" | "room" | "takeaway" | "delivery"
 * @param {string}  [params.customerName]      optional
 * @param {string}  [params.customerPhone]     optional
 * @param {string}  [params.deliveryAddress]   optional
 * @param {string}  [params.paymentMethod]     "cash" | "upi" | "card" | "online"
 * @param {number}  [params.packagingCharge]   default 0
 * @param {number}  [params.deliveryCharge]    default 0
 * @param {Array}   params.items
 *   [{ name, quantity, price, complimentary? }]
 *   complimentary=true  → printed as "COMP", excluded from total
 *
 * @returns {number[]}  raw byte array
 *
 * Sample call:
 *   buildBillBytes({
 *     restaurantName:  "Hotel King",
 *     slotLabel:       "TABLE 3",
 *     orderType:       "dine-in",
 *     customerName:    "Rahul",
 *     customerPhone:   "9876543210",
 *     deliveryAddress: null,
 *     paymentMethod:   "cash",
 *     packagingCharge: 0,
 *     deliveryCharge:  0,
 *     items: [
 *       { name: "Butter Chicken", quantity: 2, price: 280,  complimentary: false },
 *       { name: "Garlic Naan",    quantity: 4, price: 40,   complimentary: false },
 *       { name: "Mango Lassi",    quantity: 1, price: 80,   complimentary: false },
 *       { name: "Papad",          quantity: 2, price: 20,   complimentary: true  },
 *     ]
 *   });
 */
function buildBillBytes({
  restaurantName,
  slotLabel,
  orderType,
  customerName,
  customerPhone,
  deliveryAddress,
  items,
  packagingCharge,
  deliveryCharge,
  paymentMethod,
}) {
  const now = new Date();
  const W = 32; // characters per line for 58mm paper

  // Normalise items
  const bi = (items || []).map(i => ({
    ...i,
    price:    parseFloat(i.price)    || 0,
    quantity: parseInt(i.quantity)   || 1,
  }));

  // Totals — Rs. not ₹
  const sub   = bi.filter(i => !i.complimentary).reduce((s, i) => s + i.price * i.quantity, 0);
  const ext   = (parseFloat(packagingCharge) || 0) + (parseFloat(deliveryCharge) || 0);
  const total = sub + ext;

  // Receipt title
  const rt =
    orderType === 'delivery' ? 'DELIVERY RECEIPT' :
    orderType === 'takeaway' ? 'TAKEAWAY RECEIPT' :
    orderType === 'room'     ? 'ROOM RECEIPT'     :
                               'DINE-IN RECEIPT';

  return bytes(
    // ── Header ──
    B.INIT,
    B.CENTER,
    B.DOUBLE_ON, B.BOLD_ON,
    line((restaurantName || 'RESTAURANT').toUpperCase().substring(0, 16)),
    B.DOUBLE_OFF,
    line(rt),
    B.BOLD_OFF,
    sep(W, '='),

    // ── Order details ──
    B.LEFT,
    slotLabel   ? bytes(B.BOLD_ON, lrLine('SLOT:',    slotLabel,                 W), B.BOLD_OFF) : [],
    lrLine('DATE:', now.toLocaleDateString('en-IN'), W),
    lrLine('TIME:', now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), W),
    customerName  ? lrLine('NAME:',    customerName,  W) : [],
    customerPhone ? lrLine('PHONE:',   customerPhone, W) : [],
    paymentMethod ? bytes(B.BOLD_ON, lrLine('PAYMENT:', paymentMethod.toUpperCase(), W), B.BOLD_OFF) : [],
    deliveryAddress ? line('ADDR: ' + deliveryAddress) : [],
    sep(W, '='),

    // ── Items header ──
    bytes(B.BOLD_ON, lrLine('ITEM', 'AMT', W), B.BOLD_OFF),
    sep(W, '-'),

    // ── Items list ──
    // Name truncated to 20 chars + " x<qty>", amount right-aligned as "Rs.NNN"
    // complimentary items show "COMP" instead of amount
    ...bi.map(i =>
      lrLine(
        i.name.substring(0, 20) + ' x' + i.quantity,
        i.complimentary ? 'COMP' : 'Rs.' + (i.price * i.quantity).toFixed(0),
        W,
      )
    ),
    sep(W, '='),

    // ── Extra charges ──
    packagingCharge > 0
      ? lrLine('PACKAGING:', 'Rs.' + Number(packagingCharge).toFixed(0), W)
      : [],
    deliveryCharge > 0
      ? lrLine('DELIVERY:', 'Rs.' + Number(deliveryCharge).toFixed(0), W)
      : [],

    // ── Total (double size) ──
    bytes(B.BOLD_ON, B.DOUBLE_ON,
      lrLine('TOTAL:', 'Rs.' + total.toFixed(0), W),
    B.DOUBLE_OFF, B.BOLD_OFF),
    sep(W, '='),

    // ── Footer ──
    B.CENTER,
    line('THANK YOU! VISIT AGAIN'),
    line('* * * * * * * *'),
    lf(1),
    B.CUT,
  );
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  buildKOTBytes,
  buildBillBytes,
  toHex,
  // also export helpers in case the caller wants to build custom tickets
  bytes,
  lf,
  line,
  cLine,
  lrLine,
  sep,
  B,
};

// ── Quick self-test (run with: node escpos-bytes.js) ─────────────────────────

if (require.main === module) {
  const kotBytes = buildKOTBytes({
    restaurantName:       'Hotel King',
    slotLabel:            'TABLE 3',
    orderId:              '64f3a2b1c9e41234',
    orderType:            'dine-in',
    customerName:         'Waiter W01',
    deliveryAddress:      null,
    specialInstructions:  null,
    items: [
      { name: 'Butter Chicken', quantity: 2 },
      { name: 'Garlic Naan',    quantity: 4 },
      { name: 'Mango Lassi',    quantity: 1 },
    ],
  });
  console.log('KOT bytes:', kotBytes.length, 'bytes');
  console.log('KOT hex (first 40):', toHex(kotBytes).substring(0, 80), '...');

  const billBytes = buildBillBytes({
    restaurantName:  'Hotel King',
    slotLabel:       'TABLE 3',
    orderType:       'dine-in',
    customerName:    'Rahul',
    customerPhone:   '9876543210',
    deliveryAddress: null,
    paymentMethod:   'cash',
    packagingCharge: 0,
    deliveryCharge:  0,
    items: [
      { name: 'Butter Chicken', quantity: 2, price: 280, complimentary: false },
      { name: 'Garlic Naan',    quantity: 4, price: 40,  complimentary: false },
      { name: 'Mango Lassi',    quantity: 1, price: 80,  complimentary: false },
      { name: 'Papad',          quantity: 2, price: 20,  complimentary: true  },
    ],
  });
  console.log('Bill bytes:', billBytes.length, 'bytes');
  console.log('Bill hex (first 40):', toHex(billBytes).substring(0, 80), '...');

  // Print what the bill looks like as text
  console.log('\n── Bill ASCII preview ──');
  const text = billBytes
    .filter(b => b >= 0x20 || b === 0x0A)  // keep printable + newlines
    .map(b => b === 0x0A ? '\n' : String.fromCharCode(b))
    .join('');
  console.log(text);
}
