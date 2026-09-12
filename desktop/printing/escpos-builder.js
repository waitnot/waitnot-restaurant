/**
 * Builds thermal-printer-optimised HTML receipts.
 * These are rendered by a hidden Chromium window and printed silently.
 * Works with 58mm, 80mm thermal printers and standard A4 printers.
 */

const THERMAL_STYLE = `
  @page { size: auto; margin: 2mm 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .center { text-align: center; }
  .bold   { font-weight: 900; }
  .big    { font-size: 16px; font-weight: 900; letter-spacing: 1px; }
  .sep    { border-top: 2px solid #000; margin: 5px 0; }
  .dsep   { border-top: 1px dashed #000; margin: 5px 0; }
  .row    { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .row .name { flex: 1; }
  .row .qty  { width: 30px; text-align: center; font-weight: 900; }
  .row .amt  { width: 55px; text-align: right; }
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
    specialInstructions = '',
  } = data;

  const slot = roomNumber ? `ROOM ${roomNumber}`
             : tableNumber ? `TABLE ${tableNumber}`
             : orderType.toUpperCase();

  const itemRows = items.map(i =>
    `<div class="row"><span class="name">${esc(i.name)}</span><span class="qty">x${i.quantity}</span></div>`
  ).join('');

  const html = `
    <div class="center big">${esc(restaurantName.toUpperCase())}</div>
    <div class="center bold">*** KITCHEN ORDER TICKET ***</div>
    <div class="center">Staff Order</div>
    <div class="sep"></div>
    <div class="row"><span>Order</span><span>${orderId.slice(-8).toUpperCase()}</span></div>
    <div class="row"><span>Slot</span><span class="bold">${slot}</span></div>
    <div class="row"><span>Type</span><span>${orderType.toUpperCase()}</span></div>
    <div class="row"><span>Time</span><span>${time}</span></div>
    ${customerName ? `<div class="row"><span>Customer</span><span>${esc(customerName)}</span></div>` : ''}
    <div class="sep"></div>
    <div class="center bold">ITEMS TO PREPARE</div>
    <div class="dsep"></div>
    ${itemRows}
    <div class="sep"></div>
    ${specialInstructions ? `<div class="bold">NOTE: ${esc(specialInstructions)}</div><div class="sep"></div>` : ''}
    <div class="center bold">-- PREPARE WITH CARE --</div>
  `;

  return wrap(html);
}

// ── Bill ─────────────────────────────────────────────────────────────────────

function buildBillEscPos(data) {
  const {
    restaurantName = '',
    tableLabel = '',
    items = [],
    total = 0,
    paymentMethod = 'cash',
    time = '',
    date = '',
    footerText = 'Thank you! Visit Again',
    extraChargeLabel = '',
    extraChargeAmount = 0,
    packagingCharge = 0,
    deliveryCharge = 0,
  } = data;

  const itemRows = items.map(i => {
    const lineTotal = i.price * i.qty;
    return `<div class="row">
      <span class="name">${esc(i.name)} x${i.qty}</span>
      <span class="amt">₹${lineTotal}</span>
    </div>`;
  }).join('');

  const extras = [];
  if (packagingCharge > 0) extras.push({ label: 'Packaging', amt: packagingCharge });
  if (deliveryCharge > 0)  extras.push({ label: 'Delivery',  amt: deliveryCharge });
  if (extraChargeAmount > 0) extras.push({ label: extraChargeLabel || 'Extra', amt: extraChargeAmount });

  const extraRows = extras.map(e =>
    `<div class="row"><span>${esc(e.label)}</span><span>₹${e.amt}</span></div>`
  ).join('');

  const html = `
    <div class="center big">${esc(restaurantName.toUpperCase())}</div>
    <div class="center">BILL / RECEIPT</div>
    <div class="sep"></div>
    ${tableLabel ? `<div class="row"><span>Table / Slot</span><span class="bold">${esc(tableLabel)}</span></div>` : ''}
    <div class="row"><span>Date</span><span>${date}</span></div>
    <div class="row"><span>Time</span><span>${time}</span></div>
    <div class="sep"></div>
    ${itemRows}
    ${extraRows ? `<div class="dsep"></div>${extraRows}` : ''}
    <div class="sep"></div>
    <div class="row bold"><span>TOTAL</span><span>₹${total}</span></div>
    <div class="row"><span>Payment</span><span>${paymentMethod.toUpperCase()}</span></div>
    <div class="sep"></div>
    <div class="center">${esc(footerText)}</div>
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
