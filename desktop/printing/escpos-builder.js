/**
 * Builds thermal-printer-optimised HTML receipts.
 * Rendered by a hidden Chromium BrowserWindow, printed silently.
 *
 * Layout rules:
 *  - All two-column rows use <table> with fixed column widths so amounts
 *    never wrap or overflow off the right edge.
 *  - Body is constrained to 72mm (printable area of 80mm roll).
 *  - For 58mm printers pass width='58mm' — body shrinks to 52mm.
 */

function THERMAL_STYLE(width) {
  const bodyW  = width === '58mm' ? '52mm' : '72mm';
  const pageW  = width === '58mm' ? '58mm' : '80mm';
  return `
  @page {
    size: ${pageW} auto;
    margin: 1mm 2mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.4;
    color: #000;
    background: #fff;
    width: ${bodyW};
    max-width: ${bodyW};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .c   { text-align: center; }
  .b   { font-weight: 900; }
  .big { font-size: 15px; font-weight: 900; letter-spacing: 1px; }
  .sep  { border: none; border-top: 2px solid #000; margin: 5px 0; }
  .dsep { border: none; border-top: 1px dashed #000; margin: 4px 0; }

  /* ── Two-column rows ─────────────────────────────────────────────────────
     Use real <table> so widths are strictly enforced and content cannot
     overflow the right column. The name cell wraps; the amount never does. */
  .tbl { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .tbl td { vertical-align: top; padding: 1px 0; }
  .tbl .td-name {
    width: 72%;
    word-break: break-word;
    overflow-wrap: break-word;
    padding-right: 3px;
  }
  .tbl .td-amt {
    width: 28%;
    text-align: right;
    white-space: nowrap;
    font-weight: 900;
  }
  .tbl .td-qty {
    width: 28%;
    text-align: right;
    white-space: nowrap;
    font-weight: 900;
  }
  /* header row */
  .tbl-hdr td {
    font-weight: 900;
    font-size: 11px;
    border-bottom: 1px solid #000;
    padding-bottom: 3px;
  }
  `;
}

function wrap(content, width) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${THERMAL_STYLE(width)}</style>
</head>
<body>${content}</body>
</html>`;
}

// ── KOT ──────────────────────────────────────────────────────────────────────

function buildKOTEscPos(data, width = '80mm') {
  const {
    restaurantName     = '',
    orderId            = '',
    tableNumber        = null,
    roomNumber         = null,
    orderType          = 'dine-in',
    items              = [],
    time               = '',
    customerName       = '',
    deliveryAddress    = '',
    specialInstructions= '',
  } = data;

  const slot = roomNumber  ? `ROOM ${roomNumber}`
             : tableNumber ? `TABLE ${tableNumber}`
             : orderType.toUpperCase();

  const itemRows = (items || []).map(i => `
    <tr>
      <td class="td-name b" style="font-size:13px;">${esc(i.name || '')}</td>
      <td class="td-qty"    style="font-size:13px;">× ${+(i.quantity || i.qty || 1)}</td>
    </tr>`).join('');

  const html = `
    <div class="c big">${esc(restaurantName.toUpperCase())}</div>
    <div class="c b" style="margin:4px 0;font-size:13px;">*** KITCHEN ORDER TICKET ***</div>
    <div class="c">${esc(orderType.toUpperCase())}</div>
    <div class="sep"></div>
    <table class="tbl">
      <tr><td class="td-name b">Slot</td> <td class="td-qty b">${esc(slot)}</td></tr>
      <tr><td class="td-name">Order</td>  <td class="td-qty">${esc(String(orderId).slice(-8).toUpperCase())}</td></tr>
      <tr><td class="td-name">Time</td>   <td class="td-qty">${esc(time)}</td></tr>
      ${customerName    ? `<tr><td class="td-name">Customer</td><td class="td-qty">${esc(customerName)}</td></tr>` : ''}
      ${deliveryAddress ? `<tr><td class="td-name">Address</td> <td class="td-qty" style="white-space:normal;word-break:break-word;">${esc(deliveryAddress)}</td></tr>` : ''}
    </table>
    <div class="sep"></div>
    <div class="c b" style="margin:4px 0;">── ITEMS TO PREPARE ──</div>
    <div class="dsep"></div>
    <table class="tbl">${itemRows}</table>
    <div class="sep"></div>
    ${specialInstructions
      ? `<div class="b" style="margin:4px 0;">⚠ NOTE: ${esc(specialInstructions)}</div><div class="sep"></div>`
      : ''}
    <div class="c b">-- PREPARE WITH CARE --</div>
    <br>
  `;

  return wrap(html, width);
}

// ── Bill ──────────────────────────────────────────────────────────────────────

function buildBillEscPos(data, width = '80mm') {
  const {
    restaurantName    = '',
    tableLabel        = '',
    items             = [],
    total             = 0,
    paymentMethod     = 'cash',
    time              = '',
    date              = '',
    footerText        = 'Thank you! Visit Again',
    extraChargeLabel  = '',
    extraChargeAmount = 0,
    packagingCharge   = 0,
    deliveryCharge    = 0,
    customerName      = '',
    customerPhone     = '',
  } = data;

  // Normalise items — handle both {qty} and {quantity}
  const normItems = (items || []).map(i => ({
    name:  String(i.name  || ''),
    qty:   Math.max(1, parseInt(i.qty || i.quantity) || 1),
    price: parseFloat(i.price) || 0,
  }));

  // Totals
  const itemsSubtotal = normItems.reduce((s, i) => s + i.price * i.qty, 0);
  const packAmt  = parseFloat(packagingCharge)   || 0;
  const delivAmt = parseFloat(deliveryCharge)    || 0;
  const extraAmt = parseFloat(extraChargeAmount) || 0;
  const computedTotal = itemsSubtotal + packAmt + delivAmt + extraAmt;
  // Trust passed total if sane, otherwise use computed
  const finalTotal = (typeof total === 'number' && total > 0 && Math.abs(total - computedTotal) < 2)
    ? total : computedTotal;

  // Item rows
  const itemRows = normItems.map(i => {
    const amt = (i.price * i.qty).toFixed(2);
    return `<tr>
      <td class="td-name">${esc(i.name)} × ${i.qty}</td>
      <td class="td-amt">₹${amt}</td>
    </tr>`;
  }).join('');

  // Extra charge rows
  const chargeRows = [
    packAmt  > 0 ? { label: 'Packaging',               amt: packAmt  } : null,
    delivAmt > 0 ? { label: 'Delivery',                 amt: delivAmt } : null,
    extraAmt > 0 ? { label: extraChargeLabel || 'Extra',amt: extraAmt } : null,
  ].filter(Boolean).map(e =>
    `<tr><td class="td-name">${esc(e.label)}</td><td class="td-amt">₹${e.amt.toFixed(2)}</td></tr>`
  ).join('');

  const html = `
    <div class="c big">${esc(restaurantName.toUpperCase())}</div>
    <div class="c" style="margin:4px 0;font-size:12px;">BILL / RECEIPT</div>
    <div class="sep"></div>
    <table class="tbl">
      ${tableLabel    ? `<tr><td class="td-name b">Table/Slot</td><td class="td-amt b">${esc(tableLabel)}</td></tr>` : ''}
      ${customerName  ? `<tr><td class="td-name">Customer</td>  <td class="td-amt">${esc(customerName)}</td></tr>`  : ''}
      ${customerPhone ? `<tr><td class="td-name">Phone</td>     <td class="td-amt">${esc(customerPhone)}</td></tr>` : ''}
      <tr><td class="td-name">Date</td><td class="td-amt">${esc(date)}</td></tr>
      <tr><td class="td-name">Time</td><td class="td-amt">${esc(time)}</td></tr>
    </table>
    <div class="sep"></div>
    <table class="tbl">
      <tr class="tbl-hdr">
        <td class="td-name">ITEM</td>
        <td class="td-amt">AMT</td>
      </tr>
      ${itemRows}
    </table>
    ${chargeRows ? `<div class="dsep"></div><table class="tbl">${chargeRows}</table>` : ''}
    <div class="sep"></div>
    <table class="tbl">
      <tr>
        <td class="td-name b" style="font-size:14px;">TOTAL</td>
        <td class="td-amt"    style="font-size:14px;">₹${finalTotal.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="td-name">Payment</td>
        <td class="td-amt">${esc(String(paymentMethod || 'cash').toUpperCase())}</td>
      </tr>
    </table>
    <div class="sep"></div>
    <div class="c" style="margin-top:6px;">${esc(footerText)}</div>
    <div class="c" style="font-size:16px;margin:4px 0;">★ ★ ★</div>
    <br>
  `;

  return wrap(html, width);
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { buildKOTEscPos, buildBillEscPos };
