/**
 * escpos-builder.js ΓÇö WaitNot Desktop ESC/POS Byte Builder
 *
 * Exact port of the phone's buildKOTBytes / buildBillBytes from
 * client/src/utils/qzPrint.js ΓÇö pure Node.js, zero Capacitor/mobile imports.
 *
 * Paper width : W = 32 chars (58 mm roll, Font A default)
 * Currency    : Rs. (not Γé╣ ΓÇö outside standard ESC/POS codepage)
 * Item names  : TRUNCATED (not wrapped) ΓÇö KOT: 24 chars, Bill: 20 chars
 * Encoding    : ASCII / Latin-1 ΓÇö charCodeAt() & 0xFF per character
 */

'use strict';

// ΓöÇΓöÇ ESC/POS command bytes ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const B = {
  INIT:       [0x1B, 0x40],           // Reset printer to defaults
  BOLD_ON:    [0x1B, 0x45, 0x01],
  BOLD_OFF:   [0x1B, 0x45, 0x00],
  CENTER:     [0x1B, 0x61, 0x01],
  LEFT:       [0x1B, 0x61, 0x00],
  DOUBLE_ON:  [0x1B, 0x21, 0x30],    // Double height + width
  DOUBLE_OFF: [0x1B, 0x21, 0x00],
  CUT:        [0x1D, 0x56, 0x42, 0x03], // Full cut
  LF:         [0x0A],                 // Line feed
};

// ΓöÇΓöÇ Primitive helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

/** Merge arrays / strings / numbers into one flat byte array */
function bytes(...parts) {
  const out = [];
  for (const p of parts) {
    if (Array.isArray(p)) {
      out.push(...p);
    } else if (typeof p === 'string') {
      for (let i = 0; i < p.length; i++) out.push(p.charCodeAt(i) & 0xFF);
    } else if (typeof p === 'number') {
      out.push(p & 0xFF);
    }
    // ignore null / undefined / empty array silently
  }
  return out;
}

/** Convert byte array to lowercase hex string: [0x1B,0x40] ΓåÆ "1b40" */
function toHex(arr) {
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** n ├ù line-feed bytes */
function lf(n = 1) {
  const o = [];
  for (let i = 0; i < n; i++) o.push(...B.LF);
  return o;
}

/** One line of text + LF */
function line(t) {
  return bytes(t, B.LF);
}

/**
 * Centre-aligned text, padded to width W, + LF.
 * Text is truncated to W if longer.
 */
function cLine(t, W) {
  const s = String(t).substring(0, W);
  return line(' '.repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s);
}

/**
 * Left label + right value on the same line, total width W, + LF.
 * Left side is truncated to fit; at least 1 space separates left and right.
 *
 * Example (W=32):  lrLine('SLOT:', 'TABLE 3', 32)
 *   ΓåÆ "SLOT:                  TABLE 3\n"
 */
function lrLine(l, r, W) {
  const rv  = String(r);
  const lv  = String(l).substring(0, W - rv.length - 1);
  const pad = Math.max(1, W - lv.length - rv.length);
  return line(lv + ' '.repeat(pad) + rv);
}

/** Full separator line, character c repeated W times, + LF */
function sep(W, c) {
  return line(c.repeat(W));
}

// ΓöÇΓöÇ KOT builder ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

/**
 * Build raw ESC/POS bytes for a Kitchen Order Ticket.
 *
 * @param {object} p
 * @param {string}   p.restaurantName
 * @param {string}   p.slotLabel          e.g. "TABLE 3" | "ROOM 2" | "TAKEAWAY"
 * @param {string}   [p.orderId]          last 8 chars printed as REF
 * @param {string}   [p.orderType]        "dine-in" | "room" | "takeaway" | "delivery"
 * @param {string}   [p.customerName]
 * @param {string}   [p.deliveryAddress]
 * @param {string}   [p.specialInstructions]
 * @param {Array}    p.items              [{name: string, quantity: number}]
 * @returns {number[]} byte array
 *
 * Sample input:
 * {
 *   restaurantName:      "Hotel King",
 *   slotLabel:           "TABLE 3",
 *   orderId:             "64f3a2b1c9e4",
 *   orderType:           "dine-in",
 *   customerName:        "Waiter W01",
 *   deliveryAddress:     null,
 *   specialInstructions: null,
 *   items: [
 *     { name: "Butter Chicken", quantity: 2 },
 *     { name: "Garlic Naan",    quantity: 4 },
 *   ]
 * }
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
  const W   = 32;   // characters per line for 58 mm paper

  return bytes(
    // ΓöÇΓöÇ Header ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    B.INIT,
    B.CENTER,
    B.DOUBLE_ON, B.BOLD_ON,
    line((restaurantName || 'RESTAURANT').toUpperCase().substring(0, 16)),
    B.DOUBLE_OFF,
    line('KITCHEN ORDER TICKET'),
    orderType ? line(orderType.toUpperCase()) : [],
    B.BOLD_OFF,

    // ΓöÇΓöÇ Meta ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    sep(W, '='),
    B.LEFT,
    slotLabel ? bytes(B.BOLD_ON, lrLine('SLOT:', slotLabel, W), B.BOLD_OFF) : [],
    lrLine('DATE:', now.toLocaleDateString('en-IN'), W),
    bytes(B.BOLD_ON, lrLine('TIME:', now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), W), B.BOLD_OFF),
    orderId       ? lrLine('REF:',   String(orderId).slice(-8).toUpperCase(), W) : [],
    customerName  ? lrLine('NAME:',  customerName,    W) : [],
    deliveryAddress ? line('ADDR: ' + deliveryAddress) : [],

    // ΓöÇΓöÇ Items ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    sep(W, '='),
    B.CENTER, B.BOLD_ON, line('-- ITEMS TO PREPARE --'), B.BOLD_OFF,
    sep(W, '='),
    B.LEFT,
    ...(items || []).map(i =>
      bytes(
        B.BOLD_ON,
        // Name truncated to 24 chars; quantity right-aligned e.g. "x2"
        lrLine(String(i.name).substring(0, 24), 'x' + (i.quantity || 1), W),
        B.BOLD_OFF,
      )
    ),

    // ΓöÇΓöÇ Footer ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    sep(W, '='),
    specialInstructions
      ? bytes(B.BOLD_ON, line('NOTE: ' + specialInstructions), B.BOLD_OFF, sep(W, '-'))
      : [],
    B.CENTER, B.BOLD_ON,
    line('PREPARE WITH CARE'),
    B.BOLD_OFF,
    lf(1),
    B.CUT,
  );
}

// ΓöÇΓöÇ Bill builder ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

/**
 * Build raw ESC/POS bytes for a Customer Bill / Receipt.
 *
 * Total is computed from items + charges ΓÇö do NOT pass a pre-computed total.
 *
 * @param {object} p
 * @param {string}   p.restaurantName
 * @param {string}   [p.slotLabel]         e.g. "TABLE 3"
 * @param {string}   [p.orderType]         "dine-in" | "room" | "takeaway" | "delivery"
 * @param {string}   [p.customerName]
 * @param {string}   [p.customerPhone]
 * @param {string}   [p.deliveryAddress]
 * @param {string}   [p.paymentMethod]     "cash" | "upi" | "card" | "online"
 * @param {number}   [p.packagingCharge]   default 0
 * @param {number}   [p.deliveryCharge]    default 0
 * @param {Array}    p.items               [{name, quantity, price, complimentary?}]
 * @returns {number[]} byte array
 *
 * Sample input:
 * {
 *   restaurantName:  "Hotel King",
 *   slotLabel:       "TABLE 3",
 *   orderType:       "dine-in",
 *   customerName:    "Rahul",
 *   customerPhone:   "9876543210",
 *   deliveryAddress: null,
 *   paymentMethod:   "cash",
 *   packagingCharge: 0,
 *   deliveryCharge:  0,
 *   items: [
 *     { name: "Butter Chicken", quantity: 2, price: 280, complimentary: false },
 *     { name: "Garlic Naan",    quantity: 4, price: 40,  complimentary: false },
 *     { name: "Papad",          quantity: 2, price: 20,  complimentary: true  },
 *   ]
 * }
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
  const W   = 32;

  // Normalise items
  const bi = (items || []).map(i => ({
    name:         String(i.name || ''),
    price:        parseFloat(i.price)    || 0,
    quantity:     parseInt(i.quantity)   || 1,
    complimentary: !!i.complimentary,
  }));

  // Totals ΓÇö computed here, NOT taken from a passed-in total field
  const sub  = bi.filter(i => !i.complimentary).reduce((s, i) => s + i.price * i.quantity, 0);
  const ext  = (parseFloat(packagingCharge) || 0) + (parseFloat(deliveryCharge) || 0);
  const total = sub + ext;

  // Receipt title
  const rt = orderType === 'delivery' ? 'DELIVERY RECEIPT'
           : orderType === 'takeaway' ? 'TAKEAWAY RECEIPT'
           : orderType === 'room'     ? 'ROOM RECEIPT'
           :                            'DINE-IN RECEIPT';

  return bytes(
    // ΓöÇΓöÇ Header ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    B.INIT,
    B.CENTER,
    B.DOUBLE_ON, B.BOLD_ON,
    line((restaurantName || 'RESTAURANT').toUpperCase().substring(0, 16)),
    B.DOUBLE_OFF,
    line(rt),
    B.BOLD_OFF,

    // ΓöÇΓöÇ Meta ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    sep(W, '='),
    B.LEFT,
    slotLabel     ? bytes(B.BOLD_ON, lrLine('SLOT:',    slotLabel,                  W), B.BOLD_OFF) : [],
    lrLine('DATE:',    now.toLocaleDateString('en-IN'), W),
    lrLine('TIME:',    now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), W),
    customerName  ? lrLine('NAME:',    customerName,   W) : [],
    customerPhone ? lrLine('PHONE:',   customerPhone,  W) : [],
    paymentMethod ? bytes(B.BOLD_ON, lrLine('PAYMENT:', paymentMethod.toUpperCase(), W), B.BOLD_OFF) : [],
    deliveryAddress ? line('ADDR: ' + deliveryAddress) : [],

    // ΓöÇΓöÇ Items ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    sep(W, '='),
    bytes(B.BOLD_ON, lrLine('ITEM', 'AMT', W), B.BOLD_OFF),
    sep(W, '-'),
    ...bi.map(i => {
        // Wrap long names: if name + qty fits on one line with the amount, keep it together.
        // Otherwise print name on its own line then qty + amount on the next.
        const nameStr = i.name.substring(0, W - 4);
        const amtStr  = i.complimentary ? 'COMP' : 'Rs.' + (i.price * i.quantity).toFixed(0);
        const qtyStr  = ' x' + i.quantity;
        const oneLine = nameStr + qtyStr;
        if (oneLine.length + 1 + amtStr.length <= W) {
          return lrLine(oneLine, amtStr, W);
        }
        // Name too long — first line: name (max 20 chars), second line: qty + amount
        return bytes(line(i.name.substring(0, 20)), lrLine(qtyStr.trim(), amtStr, W));
      }),

    // ΓöÇΓöÇ Charges ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    sep(W, '='),
    packagingCharge > 0 ? lrLine('PACKAGING:', 'Rs.' + Number(packagingCharge).toFixed(0), W) : [],
    deliveryCharge  > 0 ? lrLine('DELIVERY:',  'Rs.' + Number(deliveryCharge).toFixed(0),  W) : [],

    // ΓöÇΓöÇ Total (double size) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    // TOTAL in double-width: effective width = W/2 = 16 chars
    bytes(B.BOLD_ON, B.DOUBLE_ON, lrLine('TOTAL:', 'Rs.' + total.toFixed(0), Math.floor(W / 2)), B.DOUBLE_OFF, B.BOLD_OFF),
    sep(W, '='),

    // ΓöÇΓöÇ Footer ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    B.CENTER,
    line('THANK YOU! VISIT AGAIN'),
    line('* * * * * * * *'),
    lf(1),
    B.CUT,
  );
}

// ΓöÇΓöÇ Exports ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

module.exports = {
  buildKOTBytes,
  buildBillBytes,
  toHex,
  B,          // export commands in case caller needs them
};