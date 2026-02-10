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
      font-family: 'Courier New', 'Lucida Console', monospace;
      font-size: 14px;
      font-weight: bold;
      line-height: 1.3;
      color: #000;
      background: white;
      padding: 8px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    ">
      <!-- Custom Header -->
      <div style="text-align: center; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px;">
        ${customization.logoDataUrl ? `
          <div style="margin-bottom: 8px;">
            <img src="${customization.logoDataUrl}" alt="Logo" style="height: ${logoSize}; max-width: 100%; object-fit: contain;">
          </div>
        ` : ''}
        
        <div style="font-size: 18px; font-weight: 900; margin-bottom: 4px; letter-spacing: 1px;">
          ${restaurant?.name?.toUpperCase() || 'RESTAURANT'}
        </div>
        
        ${customization.headerText ? `
          <div style="font-size: 12px; line-height: 1.3; white-space: pre-line; margin-bottom: 6px; font-weight: bold;">
            ${customization.headerText}
          </div>
        ` : ''}
        
        <!-- Contact Information -->
        <div style="font-size: 11px; line-height: 1.2; font-weight: bold;">
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
      <div style="margin-bottom: 12px; font-size: 12px; font-weight: bold;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>ORDER ID:</span>
          <span>${orderId}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>DATE:</span>
          <span>${dateStr} ${timeStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>CUSTOMER:</span>
          <span>${order.customerName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>PHONE:</span>
          <span>${order.customerPhone}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>TYPE:</span>
          <span>${order.orderType?.toUpperCase()}</span>
        </div>
        ${order.tableNumber ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>TABLE:</span>
          <span style="font-weight: 900;">TABLE ${order.tableNumber}</span>
        </div>
        ` : ''}
        ${order.waiterNumber ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>WAITER:</span>
          <span style="font-weight: 900;">${order.waiterNumber}</span>
        </div>
        ` : ''}
        ${order.deliveryAddress ? `
        <div style="margin-bottom: 3px;">
          <span>ADDRESS:</span>
          <div style="margin-left: 8px; word-wrap: break-word; font-size: 11px; margin-top: 2px;">${order.deliveryAddress}</div>
        </div>
        ` : ''}
      </div>

      <!-- Items -->
      <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 8px 0; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; font-weight: 900; margin-bottom: 6px; font-size: 12px;">
          <span style="width: 45%;">ITEM</span>
          <span style="width: 15%; text-align: center;">QTY</span>
          <span style="width: 20%; text-align: right;">RATE</span>
          <span style="width: 25%; text-align: right;">AMOUNT</span>
        </div>
        ${order.items?.map(item => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; font-weight: bold;">
            <span style="width: 45%; word-wrap: break-word;">${item.name}</span>
            <span style="width: 15%; text-align: center;">${item.quantity}</span>
            <span style="width: 20%; text-align: right;">₹${item.price}</span>
            <span style="width: 25%; text-align: right;">₹${item.price * item.quantity}</span>
          </div>
        `).join('') || ''}
      </div>

      <!-- Total -->
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; padding: 6px 4px; border-top: 2px solid #000; background: #f0f0f0;">
          <span>TOTAL AMOUNT:</span>
          <span>₹${order.totalAmount}</span>
        </div>
      </div>

      ${order.specialInstructions ? `
      <!-- Special Instructions -->
      <div style="margin-bottom: 12px; font-size: 11px; font-weight: bold;">
        <div style="font-weight: 900; margin-bottom: 3px;">SPECIAL INSTRUCTIONS:</div>
        <div style="font-style: italic; font-weight: normal;">${order.specialInstructions}</div>
      </div>
      ` : ''}

      <!-- Custom Footer -->
      <div style="text-align: center; margin-top: 15px; font-size: 11px; border-top: 2px solid #000; padding-top: 8px; font-weight: bold;">
        ${customization.footerText ? `
          <div style="margin-bottom: 12px; line-height: 1.3; white-space: pre-line;">
            ${customization.footerText}
          </div>
        ` : ''}
        
        ${customization.showQRCode ? `
          <div style="margin: 12px 0;">
            ${paymentQrUrl ? `
              <!-- UPI Payment QR Code -->
              <img src="${paymentQrUrl}" alt="Payment QR Code" style="width: 120px; height: 120px; border: 2px solid #000; object-fit: contain;">
              <div style="font-size: 12px; margin-top: 6px; font-weight: 900; color: #000;">
                💳 SCAN & PAY ₹${order.totalAmount}
              </div>
              <div style="font-size: 10px; margin-top: 2px; color: #333; font-weight: normal;">
                ${printerSettings.upiBaseUrl ? printerSettings.upiBaseUrl.match(/pa=([^&]+)/)?.[1] || 'UPI Payment' : 'UPI Payment'}
              </div>
            ` : customization.qrCodeDataUrl ? `
              <!-- Custom QR Code -->
              <img src="${customization.qrCodeDataUrl}" alt="QR Code" style="width: 120px; height: 120px; border: 2px solid #000; object-fit: contain;">
            ` : ''}
          </div>
        ` : ''}
        
        <div style="font-size: 9px; color: #333; margin-top: 8px; font-weight: normal;">
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
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            * {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              font-weight: bold !important;
            }
          }
          body {
            margin: 0;
            padding: 0;
            background: white;
            font-family: 'Courier New', 'Lucida Console', monospace;
            font-weight: bold;
          }
          @font-face {
            font-family: 'ThermalPrint';
            src: local('Courier New'), local('Lucida Console'), local('monospace');
            font-weight: bold;
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
    // Try to load from localStorage first (for immediate access)
    const savedSettings = localStorage.getItem(`printer_settings_${restaurantId}`);
    return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
  } catch (error) {
    console.error('Error loading printer settings:', error);
    return defaultSettings;
  }
};

// Async function to load settings from API and update localStorage
export const loadPrinterSettingsFromAPI = async () => {
  try {
    const token = localStorage.getItem('restaurantToken');
    const restaurantId = localStorage.getItem('restaurantId');
    
    if (!token || !restaurantId) {
      console.log('No token or restaurant ID available for API call');
      return null;
    }

    const response = await fetch('/api/printer-settings', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.settings) {
        // Update localStorage with latest settings from database
        localStorage.setItem(`printer_settings_${restaurantId}`, JSON.stringify(data.settings));
        console.log('✅ Printer settings synced from database to localStorage');
        return data.settings;
      }
    }
  } catch (error) {
    console.error('Error loading printer settings from API:', error);
  }
  
  return null;
};