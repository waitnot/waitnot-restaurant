/**
 * Builds thermal-printer-optimised HTML receipts.
 * These are rendered by a hidden Chromium window and printed silently.
 * Works with 58mm, 80mm thermal printers and standard A4 printers.
 */

const THERMAL_STYLE = `
  @page { size: 80mm auto; margin: 2mm 3mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    color: #000;
    background: #fff;
    width: 72mm;
    max-width: 72mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .center { text-align: center; }
  .bold   { font-weight: 900; }
  .big    { font-size: 15px; font-weight: 900; letter-spacing: 1px; }
  .sep    { border-top: 2px solid #000; margin: 5px 0; }
  .dsep   { border-top: 1px dashed #000; margin: 5px 0; }

  /* Two-column row: name takes remaining space, amount is fixed width right-aligned */
  .row {
    display: table;
    width: 100%;
    margin-bottom: 3px;
    table-layout: fixed;
  }
  .row .name {
    display: table-cell;
    width: 75%;
    word-wrap: break-word;
    overflow-wrap: break-word;
    padding-right: 4px;
    vertical-align: top;
  }
  .row .amt {
    display: table-cell;
    width: 25%;
    text-align: right;
    white-space: nowrap;
    vertical-align: top;
    font-weight: 900;
  }
  .hdr-row {
    display: table;
    width: 100%;
    table-layout: fixed;
    border-bottom: 1px solid #000;
    padding-bottom: 3px;
    margin-bottom: 4px;
    font-weight: 900;
    font-size: 11px;
  }
  .hdr-row .name { display: table-cell; width: 75%; }
  .hdr-row .amt  { display: table-cell; width: 25%; text-align: right; }
`;

function wrap(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>${THERMAL_STYLE}</style>
  </head><body>${content}</body></html>`;
}

// ── KOT ─────────────────────────────────────────────────────────────────────

function buildKOTEscPos(data) {
  const {
    restaurantName = '',
    orderId = '',
    tableNumber = null,
    roomNumber = null,
    orderType = 'dine-in',
    items = [],
    time = '',
    customerName = '',
    deliveryAddress = '',
    specialInstructions = '',
  } = data;

  const slot = roomNumber   ? `ROOM ${roomNumber}`
             : tableNumber  ? `TABLE ${tableNumber}`
             : orderType.toUpperCase();

  const itemRows = items.map(i =>
    `<div class="row">
      <span class="name bold">${esc(i.name)}</span>
      <span class="amt bold">× ${i.quantity || i.qty || 1}</span>
    </div>`
  ).join('');

  const html = `
    <div class="center big">${esc(restaurantName.toUpperCase())}</div>
    <div class="center bold" style="margin:4px 0;">*** KITCHEN ORDER TICKET ***</div>
    <div class="center">${esc(orderType.toUpperCase())}</div>
    <div class="sep"></div>
    <div class="row"><span class="bold">Slot</span><span class="bold">${esc(slot)}</span></div>
    <div class="row"><span>Order</span><span>${esc(String(orderId).slice(-8).toUpperCase())}</span></div>
    <div class="row"><span>Time</span><span>${esc(time)}</span></div>
    ${customerName   ? `<div class="row"><span>Customer</span><span>${esc(customerName)}</span></div>` : ''}
    ${deliveryAddress? `<div class="row"><span>Addr</span><span style="text-align:right;max-width:55%;">${esc(deliveryAddress)}</span></div>` : ''}
    <div class="sep"></div>
    <div class="center bold" style="margin:4px 0;">── ITEMS TO PREPARE ──</div>
    <div class="dsep"></div>
    ${itemRows}
    <div class="sep"></div>
    ${specialInstructions ? `<div class="bold" style="margin:4px 0;">NOTE: ${esc(specialInstructions)}</div><div class="sep"></div>` : ''}
    <div class="center bold">-- PREPARE WITH CARE --</div>
    <br>
  `;

  return wrap(html);
}

// ── Bill ─────────────────────────────────────────────────────────────────────

function buildBillEscPos(data) {
  const {
    restaurantName   = '',
    tableLabel       = '',
    items            = [],
    total            = 0,
    paymentMethod    = 'cash',
    time             = '',
    date             = '',
    footerText       = 'Thank you! Visit Again',
    extraChargeLabel = '',
    extraChargeAmount= 0,
    packagingCharge  = 0,
    deliveryCharge   = 0,
    customerName     = '',
    customerPhone    = '',
  } = data;

  // Normalise each item — handle both {qty} and {quantity} field names
  const normItems = items.map(i => ({
    name:     i.name || '',
    qty:      parseInt(i.qty || i.quantity) || 1,
    price:    parseFloat(i.price) || 0,
  }));

  // Calculate subtotal from normalised items
  const itemsSubtotal = normItems.reduce((s, i) => s + i.price * i.qty, 0);
  const packAmt   = parseFloat(packagingCharge)   || 0;
  const delivAmt  = parseFloat(deliveryCharge)    || 0;
  const extraAmt  = parseFloat(extraChargeAmount) || 0;
  const computedTotal = itemsSubtotal + packAmt + delivAmt + extraAmt;

  // Use passed total if within ₹1 of computed (floating point), else use computed
  const finalTotal = Math.abs(parseFloat(total) - computedTotal) <= 1
    ? parseFloat(total)
    : computedTotal;

  const itemRows = normItems.map(i => {
    const lineTotal = (i.price * i.qty).toFixed(2);
    return `<div class="row">
      <span class="name">${esc(i.name)} × ${i.qty}</span>
      <span class="amt">₹${lineTotal}</span>
    </div>`;
  }).join('');

  const extras = [];
  if (packAmt  > 0) extras.push({ label: 'Packaging', amt: packAmt.toFixed(2) });
  if (delivAmt > 0) extras.push({ label: 'Delivery',  amt: delivAmt.toFixed(2) });
  if (extraAmt > 0) extras.push({ label: extraChargeLabel || 'Extra', amt: extraAmt.toFixed(2) });

  const extraRows = extras.map(e =>
    `<div class="row"><span>${esc(e.label)}</span><span class="amt">₹${e.amt}</span></div>`
  ).join('');

  const html = `
    <div class="center big">${esc(restaurantName.toUpperCase())}</div>
    <div class="center" style="margin:4px 0;">BILL / RECEIPT</div>
    <div class="sep"></div>
    ${tableLabel    ? `<div class="row"><span class="bold">Table/Slot</span><span class="bold">${esc(tableLabel)}</span></div>` : ''}
    ${customerName  ? `<div class="row"><span>Customer</span><span>${esc(customerName)}</span></div>` : ''}
    ${customerPhone ? `<div class="row"><span>Phone</span><span>${esc(customerPhone)}</span></div>` : ''}
    <div class="row"><span>Date</span><span>${esc(date)}</span></div>
    <div class="row"><span>Time</span><span>${esc(time)}</span></div>
    <div class="sep"></div>
    <div class="hdr-row"><span class="name">ITEM</span><span class="amt">AMT</span></div>
    ${itemRows}
    ${extras.length ? `<div class="dsep"></div>${extraRows}` : ''}
    <div class="sep"></div>
    <div class="row bold" style="font-size:14px;margin-top:2px;">
      <span>TOTAL</span><span class="amt">₹${finalTotal.toFixed(2)}</span>
    </div>
    <div class="row"><span>Payment</span><span>${esc(paymentMethod.toUpperCase())}</span></div>
    <div class="sep"></div>
    <div class="center" style="margin-top:6px;">${esc(footerText)}</div>
    <br>
  `;

  return wrap(html);
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { buildKOTEscPos, buildBillEscPos };
