// Custom Bill Generator Utility
// Generates customized bills based on printer settings

// Generate UPI payment QR code URL using your specific format
const generateUpiQrCode = (baseUpiUrl, amount, orderId) => {
  if (!baseUpiUrl || !amount) return null;
  
  // Add amount and transaction note to your UPI URL
  const upiUrl = `${baseUpiUrl}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Bill Payment - ${orderId}`)}`;
  
  // Generate QR code using QR Server API
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}&margin=10`;
};

export const generateCustomBill = (order, restaurant, customization) => {
  if (!customization.enableCustomBill) {
    return null; // Use default bill format
  }

  const logoSize = customization.logoSize === 'small' ? '40px' : 
                   customization.logoSize === 'medium' ? '60px' : '80px';

  const receiptWidth = '80mm';
  const maxWidth = '302px';
  
  const dateStr = new Date().toLocaleDateString('en-IN');
  const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const orderId = `ORD-${order._id?.slice(-6).toUpperCase() || Date.now().toString().slice(-6)}`;

  // Get printer settings for UPI details
  const printerSettings = getPrinterSettings();
  
  // Generate payment QR code if UPI is enabled and configured
  let paymentQrUrl = null;
  if (customization.enableUpiPayment && printerSettings.upiBaseUrl && order.totalAmount) {
    paymentQrUrl = generateUpiQrCode(
      printerSettings.upiBaseUrl,
      order.totalAmount,
      orderId
    );
  }

  return `
    <div id="custom-bill-content" style="
      width: ${receiptWidth};
      max-width: ${maxWidth};
      margin: 0 auto;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
      color: #000;
      background: white;
      padding: 10px;
    ">
      <!-- Custom Header -->
      <div style="text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px;">
        ${customization.logoDataUrl ? `
          <div style="margin-bottom: 10px;">
            <img src="${customization.logoDataUrl}" alt="Logo" style="height: ${logoSize}; max-width: 100%; object-fit: contain;">
          </div>
        ` : ''}
        
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
          ${restaurant?.name?.toUpperCase() || 'RESTAURANT'}
        </div>
        
        ${customization.headerText ? `
          <div style="font-size: 11px; line-height: 1.3; white-space: pre-line; margin-bottom: 8px;">
            ${customization.headerText}
          </div>
        ` : ''}
        
        <!-- Contact Information -->
        <div style="font-size: 10px; line-height: 1.2;">
          ${customization.showAddress && customization.address ? `
            <div style="margin: 2px 0;">📍 ${customization.address.replace(/\n/g, '<br>')}</div>
          ` : ''}
          
          ${customization.showPhone && customization.phone ? `
            <div style="margin: 2px 0;">📞 ${customization.phone}</div>
          ` : ''}
          
          ${customization.showEmail && customization.email ? `
            <div style="margin: 2px 0;">📧 ${customization.email}</div>
          ` : ''}
          
          ${customization.showGST && customization.gstNumber ? `
            <div style="margin: 2px 0;">GST: ${customization.gstNumber}</div>
          ` : ''}
        </div>
      </div>

      <!-- Order Information -->
      <div style="margin-bottom: 15px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Order ID:</span>
          <span>${orderId}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Date:</span>
          <span>${dateStr} ${timeStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Customer:</span>
          <span>${order.customerName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Phone:</span>
          <span>${order.customerPhone}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Type:</span>
          <span>${order.orderType?.toUpperCase()}</span>
        </div>
        ${order.tableNumber ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Table:</span>
          <span><strong>TABLE ${order.tableNumber}</strong></span>
        </div>
        ` : ''}
        ${order.deliveryAddress ? `
        <div style="margin-bottom: 2px;">
          <span>Address:</span>
          <div style="margin-left: 10px; word-wrap: break-word; font-size: 10px;">${order.deliveryAddress}</div>
        </div>
        ` : ''}
      </div>

      <!-- Items -->
      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px; font-size: 11px;">
          <span style="width: 50%;">ITEM</span>
          <span style="width: 15%; text-align: center;">QTY</span>
          <span style="width: 20%; text-align: right;">RATE</span>
          <span style="width: 25%; text-align: right;">AMOUNT</span>
        </div>
        ${order.items?.map(item => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px;">
            <span style="width: 50%; word-wrap: break-word;">${item.name}</span>
            <span style="width: 15%; text-align: center;">${item.quantity}</span>
            <span style="width: 20%; text-align: right;">₹${item.price}</span>
            <span style="width: 25%; text-align: right;">₹${item.price * item.quantity}</span>
          </div>
        `).join('') || ''}
      </div>

      <!-- Total -->
      <div style="margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; padding: 5px 0; border-top: 1px solid #000;">
          <span>TOTAL AMOUNT:</span>
          <span>₹${order.totalAmount}</span>
        </div>
      </div>

      ${order.specialInstructions ? `
      <!-- Special Instructions -->
      <div style="margin-bottom: 15px; font-size: 10px;">
        <div style="font-weight: bold; margin-bottom: 3px;">Special Instructions:</div>
        <div style="font-style: italic;">${order.specialInstructions}</div>
      </div>
      ` : ''}

      <!-- Custom Footer -->
      <div style="text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px;">
        ${customization.footerText ? `
          <div style="margin-bottom: 15px; line-height: 1.3; white-space: pre-line;">
            ${customization.footerText}
          </div>
        ` : ''}
        
        ${customization.showQRCode ? `
          <div style="margin: 15px 0;">
            ${paymentQrUrl ? `
              <!-- UPI Payment QR Code -->
              <img src="${paymentQrUrl}" alt="Payment QR Code" style="width: 120px; height: 120px; border: 1px solid #ddd; object-fit: contain;">
              <div style="font-size: 11px; margin-top: 8px; font-weight: bold; color: #000;">
                💳 Scan & Pay ₹${order.totalAmount}
              </div>
              <div style="font-size: 9px; margin-top: 2px; color: #666;">
                ${printerSettings.upiBaseUrl ? printerSettings.upiBaseUrl.match(/pa=([^&]+)/)?.[1] || 'UPI Payment' : 'UPI Payment'}
              </div>
            ` : customization.qrCodeDataUrl ? `
              <!-- Custom QR Code -->
              <img src="${customization.qrCodeDataUrl}" alt="QR Code" style="width: 120px; height: 120px; border: 1px solid #ddd; object-fit: contain;">
            ` : ''}
          </div>
        ` : ''}
        
        <div style="font-size: 9px; color: #666; margin-top: 10px;">
          Printed: ${dateStr} ${timeStr}
        </div>
      </div>
    </div>
  `;
};

export const printCustomBill = (order, restaurant, customization) => {
  const customBillHTML = generateCustomBill(order, restaurant, customization);
  
  if (!customBillHTML) {
    return false; // Use default printing
  }

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Custom Bill - ${order.customerName}</title>
        <style>
          @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
        </style>
      </head>
      <body>
        ${customBillHTML}
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => {
        printWindow.close();
      }, 250);
    }, 500);
    
    return true;
  } else {
    alert('Please allow popups to print custom bills');
    return false;
  }
};

// Get printer settings including bill customization
export const getPrinterSettings = () => {
  const restaurantId = localStorage.getItem('restaurantId');
  const defaultSettings = {
    enableKitchenPrinting: true,
    enableFinalBillPrinting: true,
    kitchenReceiptSize: '80mm',
    cashCounterReceiptSize: '80mm',
    autoPrintKitchenBill: false,
    autoPrintFinalBill: false,
    kitchenPrinterName: 'Kitchen Printer',
    cashCounterPrinterName: 'Cash Counter Printer',
    // UPI Payment Settings
    enableUpiPayments: true,
    upiBaseUrl: 'upi://pay?pa=Q582735754@ybl&pn=PhonePeMerchant&mc=0000&mode=02&purpose=00',
    merchantName: 'PhonePeMerchant',
    defaultUpiApp: 'phonepe',
    billCustomization: {
      enableCustomBill: false,
      logoFile: null,
      logoDataUrl: '',
      logoSize: 'medium',
      headerText: '',
      footerText: 'Thank you for dining with us!',
      showQRCode: true,
      enableUpiPayment: true, // Enable UPI payment QR codes
      qrCodeFile: null,
      qrCodeDataUrl: '',
      showAddress: true,
      address: '',
      showPhone: true,
      phone: '',
      showEmail: false,
      email: '',
      showGST: false,
      gstNumber: '',
      billTemplate: 'modern'
    }
  };
  
  try {
    const savedSettings = localStorage.getItem(`printer_settings_${restaurantId}`);
    return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
  } catch (error) {
    console.error('Error loading printer settings:', error);
    return defaultSettings;
  }
};