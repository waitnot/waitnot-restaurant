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

  const billItems = (items || []);
  const subtotal = billItems.filter(i => !i.complimentary).reduce((s, i) => s + (i.price * i.quantity), 0);
  const compTotal = billItems.filter(i => i.complimentary).reduce((s, i) => s + (i.price * i.quantity), 0);
  const extra = (packagingCharge || 0) + (deliveryCharge || 0) + (extraCharge || 0);
  const grandTotal = subtotal + extra;

  const rows = billItems.map(i => `
    <tr>
      <td style="padding:5px 2px;font-size:12px;font-weight:900;border-bottom:1px dashed #000;word-break:break-word;width:50%;">${i.name}${i.complimentary ? ' ★COMP' : ''}</td>
      <td style="padding:5px 2px;font-size:12px;font-weight:900;text-align:center;border-bottom:1px dashed #000;width:12%;">${i.quantity}</td>
      <td style="padding:5px 2px;font-size:11px;text-align:right;border-bottom:1px dashed #000;width:18%;">${i.complimentary ? 'COMP' : '₹' + i.price}</td>
      <td style="padding:5px 2px;font-size:12px;font-weight:900;text-align:right;border-bottom:1px dashed #000;width:20%;">${i.complimentary ? '₹0' : '₹' + (i.price * i.quantity)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bill</title>
<style>${PAGE_CSS(width)}</style></head><body>
<div class="w">
  <div class="c" style="margin-bottom:8px;">
    <div style="font-size:22px;font-weight:900;letter-spacing:2px;">${(restaurantName || '').toUpperCase()}</div>
    <div style="font-size:12px;font-weight:900;margin-top:4px;">
      ${orderType === 'delivery' ? 'DELIVERY RECEIPT' : orderType === 'takeaway' ? 'TAKEAWAY RECEIPT' : orderType === 'room' ? 'ROOM RECEIPT' : 'DINE-IN RECEIPT'}
    </div>
  </div>
  <hr class="sep">
  <table style="font-size:12px;margin-bottom:5px;">
    ${slotLabel ? `<tr><td class="b">SLOT</td><td style="text-align:right;font-size:14px;font-weight:900;">${slotLabel}</td></tr>` : ''}
    <tr><td class="b">DATE</td><td style="text-align:right;">${d}</td></tr>
    <tr><td class="b">TIME</td><td style="text-align:right;">${t}</td></tr>
    ${customerName ? `<tr><td class="b">NAME</td><td style="text-align:right;">${customerName}</td></tr>` : ''}
    ${customerPhone ? `<tr><td class="b">PHONE</td><td style="text-align:right;">${customerPhone}</td></tr>` : ''}
    ${paymentMethod ? `<tr><td class="b">PAYMENT</td><td style="text-align:right;font-weight:900;">${paymentMethod.toUpperCase()}</td></tr>` : ''}
    ${deliveryAddress ? `<tr><td class="b" colspan="2" style="padding-top:4px;">ADDR: ${deliveryAddress}</td></tr>` : ''}
  </table>
  <hr class="sep">
  <table style="margin-bottom:4px;">
    <tr>
      <th style="text-align:left;font-size:11px;font-weight:900;padding:3px 2px;border-bottom:2px solid #000;width:50%;">ITEM</th>
      <th style="text-align:center;font-size:11px;font-weight:900;padding:3px 2px;border-bottom:2px solid #000;width:12%;">QTY</th>
      <th style="text-align:right;font-size:11px;font-weight:900;padding:3px 2px;border-bottom:2px solid #000;width:18%;">RATE</th>
      <th style="text-align:right;font-size:11px;font-weight:900;padding:3px 2px;border-bottom:2px solid #000;width:20%;">AMT</th>
    </tr>
    ${rows}
  </table>
  <hr class="sep">
  <table style="font-size:12px;margin-bottom:5px;">
    ${compTotal > 0 ? `<tr><td class="b">COMPLIMENTARY</td><td style="text-align:right;">−₹${compTotal}</td></tr>` : ''}
    ${packagingCharge > 0 ? `<tr><td class="b">PACKAGING</td><td style="text-align:right;">₹${packagingCharge}</td></tr>` : ''}
    ${deliveryCharge > 0 ? `<tr><td class="b">DELIVERY</td><td style="text-align:right;">₹${deliveryCharge}</td></tr>` : ''}
    ${extraCharge > 0 ? `<tr><td class="b">${(extraChargeLabel || 'EXTRA').toUpperCase()}</td><td style="text-align:right;">₹${extraCharge}</td></tr>` : ''}
  </table>
  <hr class="sep">
  <table style="margin-bottom:6px;">
    <tr>
      <td style="font-size:18px;font-weight:900;padding:4px 2px;">TOTAL</td>
      <td style="text-align:right;font-size:22px;font-weight:900;padding:4px 2px;">₹${grandTotal}</td>
    </tr>
  </table>
  <hr class="sep">
  <div class="c" style="font-size:13px;font-weight:900;padding:6px 0;">THANK YOU! PLEASE VISIT AGAIN</div>
  <div class="c" style="font-size:18px;padding:3px 0;">★ ★ ★ ★ ★</div>
  <div class="c" style="font-size:10px;margin-top:6px;color:#555;">Printed: ${d} ${t}</div>
</div>
</body></html>`;
}
