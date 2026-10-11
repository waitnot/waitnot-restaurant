// Shared print templates for KOT and Bill — bold, clear thermal receipt format

const PAGE_CSS = (width = '80mm') => `
  @page { size: ${width} auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { margin:0; padding:0; background:#fff; font-family:'Courier New',Courier,monospace; color:#000; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .w { width:100%; max-width:${width === '58mm' ? '218px' : '302px'}; margin:0 auto; }
  .c { text-align:center; }
  .b { font-weight:900; }
  .sep { border:none; border-top:2px solid #000; margin:5px 0; }
  .dash { border:none; border-top:1px dashed #000; margin:5px 0; }
  table { width:100%; border-collapse:collapse; }
`;

/**
 * Build a KOT (Kitchen Order Ticket) HTML string.
 * @param {object} params
 * @param {string} params.restaurantName
 * @param {string} params.slotLabel  e.g. "TABLE 3" | "ROOM 2" | "TAKEAWAY"
 * @param {string} params.orderId
 * @param {string} params.orderType
 * @param {string} [params.customerName]
 * @param {string} [params.deliveryAddress]
 * @param {string} [params.specialInstructions]
 * @param {Array}  params.items  [{name, quantity}]
 * @param {string} [params.width]  '80mm' | '58mm'
 */
export function buildKOTHTML({ restaurantName, slotLabel, orderId, orderType, customerName, deliveryAddress, specialInstructions, items, width = '80mm' }) {
  const now = new Date();
  const d = now.toLocaleDateString('en-IN');
  const t = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const rows = (items || []).map(i => `
    <tr>
      <td style="padding:5px 2px;font-size:14px;font-weight:900;border-bottom:1px dashed #000;word-break:break-word;">${i.name}</td>
      <td style="padding:5px 2px;font-size:18px;font-weight:900;text-align:right;border-bottom:1px dashed #000;white-space:nowrap;">× ${i.quantity}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>KOT</title>
<style>${PAGE_CSS(width)}</style></head><body>
<div class="w">
  <div class="c" style="margin-bottom:8px;">
    <div style="font-size:20px;font-weight:900;letter-spacing:2px;">${(restaurantName || '').toUpperCase()}</div>
    <div style="font-size:13px;font-weight:900;margin-top:4px;">★ KITCHEN ORDER TICKET ★</div>
    <div style="font-size:11px;margin-top:2px;font-weight:700;">${(orderType || 'ORDER').toUpperCase()}</div>
  </div>
  <hr class="sep">
  <table style="font-size:12px;margin-bottom:5px;">
    <tr><td class="b">SLOT</td><td style="text-align:right;font-size:16px;font-weight:900;">${slotLabel || ''}</td></tr>
    <tr><td class="b">DATE</td><td style="text-align:right;">${d}</td></tr>
    <tr><td class="b">TIME</td><td style="text-align:right;font-weight:900;">${t}</td></tr>
    ${orderId ? `<tr><td class="b">REF</td><td style="text-align:right;font-weight:900;">${orderId}</td></tr>` : ''}
    ${customerName ? `<tr><td class="b">NAME</td><td style="text-align:right;">${customerName}</td></tr>` : ''}
    ${deliveryAddress ? `<tr><td class="b" colspan="2" style="padding-top:4px;">ADDR: ${deliveryAddress}</td></tr>` : ''}
  </table>
  <hr class="sep">
  <div class="c b" style="font-size:13px;padding:4px 0;letter-spacing:1px;">── ITEMS TO PREPARE ──</div>
  <hr class="sep">
  <table style="margin-bottom:5px;">${rows}</table>
  <hr class="sep">
  ${specialInstructions ? `<div style="font-size:12px;font-weight:900;padding:4px 0;border-bottom:2px solid #000;margin-bottom:5px;">⚠ NOTE: ${specialInstructions}</div>` : ''}
  <div class="c" style="font-size:13px;font-weight:900;padding:6px 0;">─── PREPARE WITH CARE ───</div>
  <div class="c" style="font-size:10px;margin-top:4px;color:#555;">Printed: ${d} ${t}</div>
</div>
</body></html>`;
}

/**
 * Build a Bill/Receipt HTML string.
 * @param {object} params
 * @param {string} params.restaurantName
 * @param {string} params.slotLabel
 * @param {string} params.orderType
 * @param {string} [params.customerName]
 * @param {string} [params.customerPhone]
 * @param {string} [params.deliveryAddress]
 * @param {Array}  params.items  [{name, quantity, price, complimentary?}]
 * @param {number} [params.packagingCharge]
 * @param {number} [params.deliveryCharge]
 * @param {number} [params.extraCharge]
 * @param {string} [params.extraChargeLabel]
 * @param {string} [params.paymentMethod]
 * @param {string} [params.width]
 */
export function buildBillHTML({ restaurantName, slotLabel, orderType, customerName, customerPhone, deliveryAddress, items, packagingCharge = 0, deliveryCharge = 0, extraCharge = 0, extraChargeLabel = '', paymentMethod, width = '80mm' }) {
  const now = new Date();
  const d = now.toLocaleDateString('en-IN');
  const t = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const billItems = (items || []).map(i => ({
    ...i,
    price: parseFloat(i.price) || 0,
    quantity: parseInt(i.quantity) || 1,
  }));

  const subtotal = billItems.filter(i => !i.complimentary).reduce((s, i) => s + i.price * i.quantity, 0);
  const pkg   = parseFloat(packagingCharge) || 0;
  const dlv   = parseFloat(deliveryCharge)  || 0;
  const exAmt = parseFloat(extraCharge)     || 0;
  const extra = pkg + dlv + exAmt;
  const grandTotal = subtotal + extra;
  const showSubtotal = extra > 0;

  const receiptTitle =
    orderType === 'delivery' ? 'DELIVERY RECEIPT' :
    orderType === 'takeaway' ? 'TAKEAWAY RECEIPT' :
    orderType === 'room'     ? 'ROOM RECEIPT'     :
                               'DINE-IN RECEIPT';

  // Item rows — "item name x qty" left, "Rs.amt" right
  const rows = billItems.map(i => {
    const amt = i.complimentary ? 'COMP' : `Rs.${(i.price * i.quantity).toFixed(0)}`;
    const label = `${i.name}${i.complimentary ? ' ★' : ''} x${i.quantity}`;
    return `<tr>
      <td style="padding:4px 0;font-size:13px;word-break:break-word;">${label}</td>
      <td style="padding:4px 0;font-size:13px;font-weight:900;text-align:right;white-space:nowrap;">${amt}</td>
    </tr>`;
  }).join('');

  const W = width === '58mm' ? '218px' : '302px';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bill</title>
<style>
  @page { size: ${width} auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body { margin:0; padding:0; background:#fff; font-family:'Courier New',Courier,monospace; color:#000; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .wrap { width:100%; max-width:${W}; margin:0 auto; padding:4px; }
  .c { text-align:center; }
  .b { font-weight:900; }
  .dash { border:none; border-top:1px dashed #000; margin:5px 0; }
  table { width:100%; border-collapse:collapse; }
  td { vertical-align:top; }
</style>
</head><body>
<div class="wrap">

  <!-- Header -->
  <div class="c" style="margin-bottom:6px;">
    <div style="font-size:20px;font-weight:900;letter-spacing:2px;">${(restaurantName || '').toUpperCase()}</div>
    <div style="font-size:12px;font-weight:700;margin-top:3px;letter-spacing:1px;">${receiptTitle}</div>
  </div>
  <hr class="dash">

  <!-- Info block -->
  <table style="font-size:13px;margin-bottom:4px;">
    ${slotLabel       ? `<tr><td class="b" style="width:55%;">SLOT:</td><td style="text-align:right;">${slotLabel}</td></tr>` : ''}
    <tr><td class="b">DATE:</td><td style="text-align:right;">${d}</td></tr>
    <tr><td class="b">TIME:</td><td style="text-align:right;">${t}</td></tr>
    ${customerName    ? `<tr><td class="b">NAME:</td><td style="text-align:right;">${customerName}</td></tr>` : ''}
    ${customerPhone   ? `<tr><td class="b">PHONE:</td><td style="text-align:right;">${customerPhone}</td></tr>` : ''}
    ${paymentMethod   ? `<tr><td class="b">PAYMENT:</td><td style="text-align:right;font-weight:900;">${paymentMethod.toUpperCase()}</td></tr>` : ''}
    ${deliveryAddress ? `<tr><td class="b" colspan="2" style="padding-top:3px;">ADDR: ${deliveryAddress}</td></tr>` : ''}
  </table>
  <hr class="dash">

  <!-- Items header -->
  <table style="font-size:13px;font-weight:900;margin-bottom:2px;">
    <tr>
      <td>ITEM</td>
      <td style="text-align:right;">AMT</td>
    </tr>
  </table>
  <hr class="dash">

  <!-- Items -->
  <table style="margin-bottom:4px;">${rows}</table>
  <hr class="dash">

  <!-- Extra charges -->
  ${showSubtotal ? `
  <table style="font-size:12px;margin-bottom:4px;">
    <tr><td>Subtotal</td><td style="text-align:right;">Rs.${subtotal.toFixed(0)}</td></tr>
    ${pkg   > 0 ? `<tr><td class="b">PACKAGING</td><td style="text-align:right;">Rs.${pkg.toFixed(0)}</td></tr>` : ''}
    ${dlv   > 0 ? `<tr><td class="b">DELIVERY</td><td style="text-align:right;">Rs.${dlv.toFixed(0)}</td></tr>` : ''}
    ${exAmt > 0 ? `<tr><td class="b">${(extraChargeLabel || 'EXTRA').toUpperCase()}</td><td style="text-align:right;">Rs.${exAmt.toFixed(0)}</td></tr>` : ''}
  </table>
  <hr class="dash">` : ''}

  <!-- Total -->
  <table style="margin-bottom:6px;">
    <tr>
      <td style="font-size:18px;font-weight:900;">TOTAL:</td>
      <td style="text-align:right;font-size:22px;font-weight:900;">Rs.${grandTotal.toFixed(0)}</td>
    </tr>
  </table>
  <hr class="dash">

  <!-- Footer -->
  <div class="c" style="font-size:12px;font-weight:700;padding:4px 0;letter-spacing:1px;">THANK YOU! VISIT AGAIN</div>
  <div class="c" style="font-size:14px;padding:2px 0;letter-spacing:4px;">* * * * * * * *</div>
  <div class="c" style="font-size:10px;margin-top:6px;color:#555;">${d} ${t}</div>

</div>
</body></html>`;
}
