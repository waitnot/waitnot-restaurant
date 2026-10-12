
const PAGE_CSS = (width = '80mm') => `
  @page { size: ${width} auto; margin: 3mm; }
  * { box-sizing: border-box; font-weight: 900; }
  body { margin:0; padding:0; background:#fff; font-family:'Courier New',Courier,monospace; color:#000; font-weight:900; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .w { width:100%; max-width:${width === '58mm' ? '218px' : '302px'}; margin:0 auto; }
  .c { text-align:center; }
  .b { font-weight:900; }
  .sep { border:none; border-top:2px solid #000; margin:5px 0; }
  .dash { border:none; border-top:1px dashed #000; margin:5px 0; }
  table { width:100%; border-collapse:collapse; }
  td, th { font-weight:900; }
`;

export function buildKOTHTML({ restaurantName, slotLabel, orderId, orderType, customerName, deliveryAddress, specialInstructions, items, width = '80mm' }) {
  const now = new Date();
  const d = now.toLocaleDateString('en-IN');
  const t = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const rows = (items || []).map(i => `
    <tr>
      <td style="padding:5px 2px;font-size:15px;font-weight:900;border-bottom:1px dashed #000;word-break:break-word;">${i.name}</td>
      <td style="padding:5px 2px;font-size:20px;font-weight:900;text-align:right;border-bottom:1px dashed #000;white-space:nowrap;">x ${i.quantity}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>KOT</title>
<style>${PAGE_CSS(width)}</style></head><body>
<div class="w">
  <div class="c" style="margin-bottom:8px;">
    <div style="font-size:20px;font-weight:900;letter-spacing:2px;">${(restaurantName || '').toUpperCase()}</div>
    <div style="font-size:13px;font-weight:900;margin-top:4px;">KITCHEN ORDER TICKET</div>
    <div style="font-size:12px;margin-top:2px;font-weight:900;">${(orderType || 'ORDER').toUpperCase()}</div>
  </div>
  <hr class="sep">
  <table style="font-size:13px;margin-bottom:5px;">
    <tr><td style="font-weight:900;">SLOT:</td><td style="text-align:right;font-size:16px;font-weight:900;">${slotLabel || ''}</td></tr>
    <tr><td style="font-weight:900;">DATE:</td><td style="text-align:right;font-weight:900;">${d}</td></tr>
    <tr><td style="font-weight:900;">TIME:</td><td style="text-align:right;font-weight:900;">${t}</td></tr>
    ${orderId ? `<tr><td style="font-weight:900;">REF:</td><td style="text-align:right;font-weight:900;">${orderId}</td></tr>` : ''}
    ${customerName ? `<tr><td style="font-weight:900;">NAME:</td><td style="text-align:right;font-weight:900;">${customerName}</td></tr>` : ''}
    ${deliveryAddress ? `<tr><td style="font-weight:900;" colspan="2">ADDR: ${deliveryAddress}</td></tr>` : ''}
  </table>
  <hr class="sep">
  <div class="c" style="font-size:13px;font-weight:900;padding:4px 0;">-- ITEMS TO PREPARE --</div>
  <hr class="sep">
  <table style="margin-bottom:5px;">${rows}</table>
  <hr class="sep">
  ${specialInstructions ? `<div style="font-size:13px;font-weight:900;padding:4px 0;border-bottom:2px solid #000;margin-bottom:5px;">NOTE: ${specialInstructions}</div>` : ''}
  <div class="c" style="font-size:13px;font-weight:900;padding:6px 0;">PREPARE WITH CARE</div>
  <div class="c" style="font-size:11px;font-weight:900;margin-top:4px;">${d} ${t}</div>
</div>
</body></html>`;
}

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

  const rows = billItems.map(i => {
    const amt = i.complimentary ? 'COMP' : `Rs.${(i.price * i.quantity).toFixed(0)}`;
    const label = `${i.name}${i.complimentary ? ' COMP' : ''} x${i.quantity}`;
    return `<tr>
      <td style="padding:4px 0;font-size:13px;font-weight:900;word-break:break-word;">${label}</td>
      <td style="padding:4px 0;font-size:13px;font-weight:900;text-align:right;white-space:nowrap;">${amt}</td>
    </tr>`;
  }).join('');

  const W = width === '58mm' ? '218px' : '302px';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bill</title>
<style>
  @page { size: ${width} auto; margin: 2mm; }
  * { box-sizing: border-box; font-weight: 900; }
  body { margin:0; padding:0; background:#fff; font-family:'Courier New',Courier,monospace; color:#000; font-weight:900; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .wrap { width:100%; max-width:${W}; margin:0 auto; padding:4px; }
  .c { text-align:center; }
  .b { font-weight:900; }
  .dash { border:none; border-top:1px dashed #000; margin:5px 0; }
  table { width:100%; border-collapse:collapse; }
  td, th { vertical-align:top; font-weight:900; }
</style>
</head><body>
<div class="wrap">

  <div class="c" style="margin-bottom:6px;">
    <div style="font-size:20px;font-weight:900;letter-spacing:2px;">${(restaurantName || '').toUpperCase()}</div>
    <div style="font-size:13px;font-weight:900;margin-top:3px;letter-spacing:1px;">${receiptTitle}</div>
  </div>
  <hr class="dash">

  <table style="font-size:13px;margin-bottom:4px;">
    ${slotLabel       ? `<tr><td style="width:45%;font-weight:900;">SLOT:</td><td style="text-align:right;font-weight:900;">${slotLabel}</td></tr>` : ''}
    <tr><td style="font-weight:900;">DATE:</td><td style="text-align:right;font-weight:900;">${d}</td></tr>
    <tr><td style="font-weight:900;">TIME:</td><td style="text-align:right;font-weight:900;">${t}</td></tr>
    ${customerName    ? `<tr><td style="font-weight:900;">NAME:</td><td style="text-align:right;font-weight:900;">${customerName}</td></tr>` : ''}
    ${customerPhone   ? `<tr><td style="font-weight:900;">PHONE:</td><td style="text-align:right;font-weight:900;">${customerPhone}</td></tr>` : ''}
    ${paymentMethod   ? `<tr><td style="font-weight:900;">PAYMENT:</td><td style="text-align:right;font-weight:900;">${paymentMethod.toUpperCase()}</td></tr>` : ''}
    ${deliveryAddress ? `<tr><td style="font-weight:900;" colspan="2">ADDR: ${deliveryAddress}</td></tr>` : ''}
  </table>
  <hr class="dash">

  <table style="font-size:13px;font-weight:900;margin-bottom:2px;">
    <tr>
      <td style="font-weight:900;">ITEM</td>
      <td style="text-align:right;font-weight:900;">AMT</td>
    </tr>
  </table>
  <hr class="dash">

  <table style="margin-bottom:4px;">${rows}</table>
  <hr class="dash">

  ${showSubtotal ? `
  <table style="font-size:13px;margin-bottom:4px;">
    <tr><td style="font-weight:900;">SUBTOTAL:</td><td style="text-align:right;font-weight:900;">Rs.${subtotal.toFixed(0)}</td></tr>
    ${pkg   > 0 ? `<tr><td style="font-weight:900;">PACKAGING:</td><td style="text-align:right;font-weight:900;">Rs.${pkg.toFixed(0)}</td></tr>` : ''}
    ${dlv   > 0 ? `<tr><td style="font-weight:900;">DELIVERY:</td><td style="text-align:right;font-weight:900;">Rs.${dlv.toFixed(0)}</td></tr>` : ''}
    ${exAmt > 0 ? `<tr><td style="font-weight:900;">${(extraChargeLabel || 'EXTRA').toUpperCase()}:</td><td style="text-align:right;font-weight:900;">Rs.${exAmt.toFixed(0)}</td></tr>` : ''}
  </table>
  <hr class="dash">` : ''}

  <table style="margin-bottom:6px;">
    <tr>
      <td style="font-size:18px;font-weight:900;">TOTAL:</td>
      <td style="text-align:right;font-size:22px;font-weight:900;">Rs.${grandTotal.toFixed(0)}</td>
    </tr>
  </table>
  <hr class="dash">

  <div class="c" style="font-size:13px;font-weight:900;padding:4px 0;letter-spacing:1px;">THANK YOU! VISIT AGAIN</div>
  <div class="c" style="font-size:13px;font-weight:900;padding:2px 0;letter-spacing:4px;">* * * * * * * *</div>
  <div class="c" style="font-size:11px;font-weight:900;margin-top:6px;">${d} ${t}</div>

</div>
</body></html>`;
}
