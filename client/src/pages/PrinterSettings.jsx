import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Printer, Save, ArrowLeft } from 'lucide-react';
import axios from 'axios';

// Function to generate custom bill preview
const generateCustomBillPreview = (customization) => {
  const logoSize = customization.logoSize === 'small' ? '40px' : 
                   customization.logoSize === 'medium' ? '60px' : '80px';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Custom Bill Preview</title>
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: 'Courier New', monospace;
          background: white;
          max-width: 300px;
        }
        .bill-container {
          border: 1px solid #ddd;
          padding: 15px;
          background: white;
        }
        .bill-header {
          text-align: center;
          margin-bottom: 15px;
          border-bottom: 1px dashed #000;
          padding-bottom: 10px;
        }
        .bill-logo {
          margin-bottom: 10px;
        }
        .bill-header-text {
          font-size: 12px;
          line-height: 1.4;
          white-space: pre-line;
        }
        .bill-contact {
          font-size: 10px;
          margin: 5px 0;
        }
        .bill-items {
          margin: 15px 0;
          border-bottom: 1px dashed #000;
          padding-bottom: 10px;
        }
        .bill-item {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
          font-size: 11px;
        }
        .bill-total {
          font-weight: bold;
          font-size: 14px;
          text-align: right;
          margin: 10px 0;
        }
        .bill-footer {
          text-align: center;
          margin-top: 15px;
          border-top: 1px dashed #000;
          padding-top: 10px;
        }
        .bill-footer-text {
          font-size: 10px;
          line-height: 1.4;
          white-space: pre-line;
          margin-bottom: 10px;
        }
        .bill-qr {
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="bill-container">
        <div class="bill-header">
          ${customization.logoDataUrl ? `
            <div class="bill-logo">
              <img src="${customization.logoDataUrl}" alt="Logo" style="height: ${logoSize}; max-width: 100%;">
            </div>
          ` : ''}
          
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
            SAMPLE RESTAURANT
          </div>
          
          ${customization.headerText ? `
            <div class="bill-header-text">${customization.headerText}</div>
          ` : ''}
          
          ${customization.showAddress && customization.address ? `
            <div class="bill-contact">📍 ${customization.address.replace(/\n/g, '<br>')}</div>
          ` : ''}
          
          ${customization.showPhone && customization.phone ? `
            <div class="bill-contact">📞 ${customization.phone}</div>
          ` : ''}
          
          ${customization.showEmail && customization.email ? `
            <div class="bill-contact">📧 ${customization.email}</div>
          ` : ''}
          
          ${customization.showGST && customization.gstNumber ? `
            <div class="bill-contact">GST: ${customization.gstNumber}</div>
          ` : ''}
        </div>

        <div style="font-size: 11px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Order ID:</span>
            <span>ORD-12345</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Date:</span>
            <span>${new Date().toLocaleDateString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Time:</span>
            <span>${new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        <div class="bill-items">
          <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 5px; font-size: 11px;">
            <span>ITEM</span>
            <span>QTY</span>
            <span>AMOUNT</span>
          </div>
          <div class="bill-item">
            <span>Sample Dish 1</span>
            <span>2</span>
            <span>₹200</span>
          </div>
          <div class="bill-item">
            <span>Sample Dish 2</span>
            <span>1</span>
            <span>₹150</span>
          </div>
        </div>

        <div class="bill-total">
          TOTAL: ₹350
        </div>

        <div class="bill-footer">
          ${customization.footerText ? `
            <div class="bill-footer-text">${customization.footerText}</div>
          ` : ''}
          
          ${customization.showQRCode ? `
            <div class="bill-qr">
              ${customization.enableUpiPayment ? `
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('upi://pay?pa=Q582735754@ybl&pn=PhonePeMerchant&mc=0000&mode=02&purpose=00&am=350&cu=INR&tn=Bill%20Payment%20-%20ORD-12345')}&margin=10" alt="Payment QR Code" style="width: 100px; height: 100px;">
                <div style="font-size: 11px; margin-top: 8px; font-weight: bold; color: #000;">
                  💳 Scan & Pay ₹350
                </div>
                <div style="font-size: 9px; margin-top: 2px; color: #666;">
                  Q582735754@ybl
                </div>
              ` : customization.qrCodeDataUrl ? `
                <img src="${customization.qrCodeDataUrl}" alt="QR Code" style="width: 100px; height: 100px;">
              ` : `
                <div style="width: 100px; height: 100px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; margin: 0 auto; font-size: 10px; color: #666;">
                  QR Code Preview
                </div>
              `}
            </div>
          ` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
};

export default function PrinterSettings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
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
    // Bill Customization Settings
    billCustomization: {
      enableCustomBill: false,
      logoFile: null,
      logoDataUrl: '',
      logoSize: 'medium', // small, medium, large
      headerText: '',
      footerText: 'Thank you for dining with us!',
      showQRCode: true,
      enableUpiPayment: true, // Enable UPI payment QR codes by default
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
      billTemplate: 'modern' // classic, modern, minimal
    }
  });
  
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      navigate('/restaurant-login');
      return;
    }
    
    // Load existing settings
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      const savedSettings = localStorage.getItem(`printer_settings_${restaurantId}`);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading printer settings:', error);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      localStorage.setItem(`printer_settings_${restaurantId}`, JSON.stringify(settings));
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving printer settings:', error);
      alert('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle logo file upload
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check if it's an image file
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (PNG, JPG, GIF, SVG)');
        return;
      }
      
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Logo file is too large. Maximum size is 2MB.');
        return;
      }
      
      // Convert to base64
      const reader = new FileReader();
      reader.onload = () => {
        handleSettingChange('billCustomization', {
          ...settings.billCustomization,
          logoFile: file,
          logoDataUrl: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle QR code file upload
  const handleQRCodeUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check if it's an image file
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (PNG, JPG, GIF, SVG)');
        return;
      }
      
      // Check file size (max 1MB for QR codes)
      if (file.size > 1 * 1024 * 1024) {
        alert('QR code file is too large. Maximum size is 1MB.');
        return;
      }
      
      // Convert to base64
      const reader = new FileReader();
      reader.onload = () => {
        handleSettingChange('billCustomization', {
          ...settings.billCustomization,
          qrCodeFile: file,
          qrCodeDataUrl: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-md p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/restaurant-dashboard')}
              className="flex items-center gap-2 text-gray-700 hover:text-primary"
            >
              <ArrowLeft size={20} />
              <span>Back to Dashboard</span>
            </button>
            <div className="flex items-center gap-2">
              <Settings size={24} className="text-primary" />
              <h1 className="text-xl font-bold text-gray-800">Printer Settings</h1>
            </div>
          </div>
          
          <button
            onClick={saveSettings}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
              saved 
                ? 'bg-green-500 text-white' 
                : 'bg-primary text-white hover:bg-red-600'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Save size={18} />
            {saved ? 'Saved!' : loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        {/* Kitchen Printer Settings */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Printer size={24} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Kitchen Printer</h2>
              <p className="text-gray-600 text-sm">Prints KOT (Kitchen Order Tickets) for food preparation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Enable Kitchen Printing
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={settings.enableKitchenPrinting}
                    onChange={() => handleSettingChange('enableKitchenPrinting', true)}
                    className="w-4 h-4"
                  />
                  <span>ON</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!settings.enableKitchenPrinting}
                    onChange={() => handleSettingChange('enableKitchenPrinting', false)}
                    className="w-4 h-4"
                  />
                  <span>OFF</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Kitchen Receipt Size
              </label>
              <select
                value={settings.kitchenReceiptSize}
                onChange={(e) => handleSettingChange('kitchenReceiptSize', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="58mm">58mm</option>
                <option value="80mm">80mm</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Auto Print Kitchen Bill
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={settings.autoPrintKitchenBill}
                    onChange={() => handleSettingChange('autoPrintKitchenBill', true)}
                    className="w-4 h-4"
                  />
                  <span>YES</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!settings.autoPrintKitchenBill}
                    onChange={() => handleSettingChange('autoPrintKitchenBill', false)}
                    className="w-4 h-4"
                  />
                  <span>NO</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Kitchen Printer Name
              </label>
              <input
                type="text"
                value={settings.kitchenPrinterName}
                onChange={(e) => handleSettingChange('kitchenPrinterName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Kitchen Printer"
              />
            </div>
          </div>

          <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h4 className="font-semibold text-orange-800 mb-2">Kitchen Printer Role: KITCHEN</h4>
            <p className="text-orange-700 text-sm">
              • Prints only food items (no prices)<br/>
              • Receipt Type: KOT (Kitchen Order Ticket)<br/>
              • Shows table number, item names, and quantities<br/>
              • Used by kitchen staff for food preparation
            </p>
          </div>
        </div>

        {/* Cash Counter Printer Settings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-green-100 p-2 rounded-lg">
              <Printer size={24} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Cash Counter Printer</h2>
              <p className="text-gray-600 text-sm">Prints final customer receipts with prices and totals</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Enable Final Bill Printing
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={settings.enableFinalBillPrinting}
                    onChange={() => handleSettingChange('enableFinalBillPrinting', true)}
                    className="w-4 h-4"
                  />
                  <span>ON</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!settings.enableFinalBillPrinting}
                    onChange={() => handleSettingChange('enableFinalBillPrinting', false)}
                    className="w-4 h-4"
                  />
                  <span>OFF</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Cash Counter Receipt Size
              </label>
              <select
                value={settings.cashCounterReceiptSize}
                onChange={(e) => handleSettingChange('cashCounterReceiptSize', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="58mm">58mm</option>
                <option value="80mm">80mm</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Auto Print Final Bill
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={settings.autoPrintFinalBill}
                    onChange={() => handleSettingChange('autoPrintFinalBill', true)}
                    className="w-4 h-4"
                  />
                  <span>YES</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!settings.autoPrintFinalBill}
                    onChange={() => handleSettingChange('autoPrintFinalBill', false)}
                    className="w-4 h-4"
                  />
                  <span>NO</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Cash Counter Printer Name
              </label>
              <input
                type="text"
                value={settings.cashCounterPrinterName}
                onChange={(e) => handleSettingChange('cashCounterPrinterName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Cash Counter Printer"
              />
            </div>
          </div>

          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">Cash Counter Printer Role: CASH_COUNTER</h4>
            <p className="text-green-700 text-sm">
              • Prints complete customer receipt with prices<br/>
              • Receipt Type: FINAL_BILL<br/>
              • Shows all items, prices, taxes, and totals<br/>
              • Used for payment and customer receipt
            </p>
          </div>
        </div>

        {/* Bill Customization Settings */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 p-2 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Bill Customization</h2>
              <p className="text-gray-600 text-sm">Customize your customer bills with logo, branding, and QR codes</p>
            </div>
          </div>

          {/* Enable Custom Bill */}
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-2">
              Enable Custom Bill Design
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={settings.billCustomization.enableCustomBill}
                  onChange={() => handleSettingChange('billCustomization', {
                    ...settings.billCustomization,
                    enableCustomBill: true
                  })}
                  className="w-4 h-4"
                />
                <span>ON</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!settings.billCustomization.enableCustomBill}
                  onChange={() => handleSettingChange('billCustomization', {
                    ...settings.billCustomization,
                    enableCustomBill: false
                  })}
                  className="w-4 h-4"
                />
                <span>OFF</span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              When enabled, uses your custom design instead of default bill format
            </p>
          </div>

          {settings.billCustomization.enableCustomBill && (
            <>
              {/* Bill Template */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Bill Template
                  </label>
                  <select
                    value={settings.billCustomization.billTemplate}
                    onChange={(e) => handleSettingChange('billCustomization', {
                      ...settings.billCustomization,
                      billTemplate: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="classic">Classic</option>
                    <option value="modern">Modern</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>
              </div>

              {/* Logo Settings */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🖼️ Logo Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Upload Logo
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Upload PNG, JPG, GIF, or SVG (max 2MB)
                    </p>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Logo Size
                    </label>
                    <select
                      value={settings.billCustomization.logoSize}
                      onChange={(e) => handleSettingChange('billCustomization', {
                        ...settings.billCustomization,
                        logoSize: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="small">Small (40px)</option>
                      <option value="medium">Medium (60px)</option>
                      <option value="large">Large (80px)</option>
                    </select>
                  </div>
                </div>
                {settings.billCustomization.logoDataUrl && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Logo Preview:</p>
                    <div className="flex items-center gap-4">
                      <img 
                        src={settings.billCustomization.logoDataUrl} 
                        alt="Logo Preview"
                        className={`border border-gray-300 rounded ${
                          settings.billCustomization.logoSize === 'small' ? 'h-10' :
                          settings.billCustomization.logoSize === 'medium' ? 'h-15' : 'h-20'
                        }`}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <button
                        onClick={() => handleSettingChange('billCustomization', {
                          ...settings.billCustomization,
                          logoFile: null,
                          logoDataUrl: ''
                        })}
                        className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                      >
                        Remove Logo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Header & Footer Text */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📝 Custom Text</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Header Text (Below Logo)
                    </label>
                    <textarea
                      value={settings.billCustomization.headerText}
                      onChange={(e) => handleSettingChange('billCustomization', {
                        ...settings.billCustomization,
                        headerText: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      rows="3"
                      placeholder="Welcome to our restaurant!&#10;Best food in town&#10;Est. 2020"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Footer Text (Above QR Code)
                    </label>
                    <textarea
                      value={settings.billCustomization.footerText}
                      onChange={(e) => handleSettingChange('billCustomization', {
                        ...settings.billCustomization,
                        footerText: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      rows="3"
                      placeholder="Thank you for dining with us!&#10;Please visit again&#10;★★★★★"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📞 Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={settings.billCustomization.showAddress}
                        onChange={(e) => handleSettingChange('billCustomization', {
                          ...settings.billCustomization,
                          showAddress: e.target.checked
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-gray-700 font-semibold">
                        Show Address
                      </label>
                    </div>
                    <textarea
                      value={settings.billCustomization.address}
                      onChange={(e) => handleSettingChange('billCustomization', {
                        ...settings.billCustomization,
                        address: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      rows="3"
                      placeholder="123 Main Street&#10;City, State 12345&#10;Country"
                      disabled={!settings.billCustomization.showAddress}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={settings.billCustomization.showPhone}
                        onChange={(e) => handleSettingChange('billCustomization', {
                          ...settings.billCustomization,
                          showPhone: e.target.checked
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-gray-700 font-semibold">
                        Show Phone
                      </label>
                    </div>
                    <input
                      type="tel"
                      value={settings.billCustomization.phone}
                      onChange={(e) => handleSettingChange('billCustomization', {
                        ...settings.billCustomization,
                        phone: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="+91 98765 43210"
                      disabled={!settings.billCustomization.showPhone}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={settings.billCustomization.showEmail}
                        onChange={(e) => handleSettingChange('billCustomization', {
                          ...settings.billCustomization,
                          showEmail: e.target.checked
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-gray-700 font-semibold">
                        Show Email
                      </label>
                    </div>
                    <input
                      type="email"
                      value={settings.billCustomization.email}
                      onChange={(e) => handleSettingChange('billCustomization', {
                        ...settings.billCustomization,
                        email: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="contact@restaurant.com"
                      disabled={!settings.billCustomization.showEmail}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={settings.billCustomization.showGST}
                        onChange={(e) => handleSettingChange('billCustomization', {
                          ...settings.billCustomization,
                          showGST: e.target.checked
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-gray-700 font-semibold">
                        Show GST Number
                      </label>
                    </div>
                    <input
                      type="text"
                      value={settings.billCustomization.gstNumber}
                      onChange={(e) => handleSettingChange('billCustomization', {
                        ...settings.billCustomization,
                        gstNumber: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="22AAAAA0000A1Z5"
                      disabled={!settings.billCustomization.showGST}
                    />
                  </div>
                </div>
              </div>

              {/* QR Code Settings */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📱 QR Code Settings</h3>
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={settings.billCustomization.showQRCode}
                      onChange={(e) => handleSettingChange('billCustomization', {
                        ...settings.billCustomization,
                        showQRCode: e.target.checked
                      })}
                      className="w-4 h-4"
                    />
                    <label className="text-gray-700 font-semibold">
                      Show QR Code at Bottom
                    </label>
                  </div>
                </div>
                
                {settings.billCustomization.showQRCode && (
                  <div>
                    {/* QR Code Type Selection */}
                    <div className="mb-4">
                      <label className="block text-gray-700 font-semibold mb-2">
                        QR Code Type
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => handleSettingChange('billCustomization', {
                            ...settings.billCustomization,
                            enableUpiPayment: true
                          })}
                          className={`p-3 rounded-lg border-2 font-semibold text-sm ${
                            settings.billCustomization.enableUpiPayment
                              ? 'border-primary bg-primary text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-primary'
                          }`}
                        >
                          💳 UPI Payment QR
                          <div className="text-xs mt-1 opacity-80">
                            Auto-generates payment QR with bill amount
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSettingChange('billCustomization', {
                            ...settings.billCustomization,
                            enableUpiPayment: false
                          })}
                          className={`p-3 rounded-lg border-2 font-semibold text-sm ${
                            !settings.billCustomization.enableUpiPayment
                              ? 'border-primary bg-primary text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-primary'
                          }`}
                        >
                          🖼️ Custom QR Code
                          <div className="text-xs mt-1 opacity-80">
                            Upload your own QR code image
                          </div>
                        </button>
                      </div>
                    </div>

                    {settings.billCustomization.enableUpiPayment ? (
                      /* UPI Payment QR Code */
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h4 className="font-semibold text-green-800 mb-3">💳 UPI Payment QR Code</h4>
                        <div className="space-y-3 text-sm text-green-700">
                          <div className="flex items-start gap-2">
                            <span className="text-green-600">✓</span>
                            <span>Automatically generates payment QR code with exact bill amount</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600">✓</span>
                            <span>Uses UPI Base URL from UPI Payment Settings below</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600">✓</span>
                            <span>Customers can scan and pay directly from any UPI app</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600">✓</span>
                            <span>Shows "Scan & Pay ₹Amount" instead of generic text</span>
                          </div>
                        </div>
                        <div className="mt-3 p-2 bg-green-100 rounded text-xs text-green-800">
                          <strong>Note:</strong> Make sure to configure your UPI Base URL in the UPI Payment Settings section below for this to work.
                        </div>
                      </div>
                    ) : (
                      /* Custom QR Code Upload */
                      <div>
                        <div className="mb-4">
                          <label className="block text-gray-700 font-semibold mb-2">
                            Upload Custom QR Code Image
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleQRCodeUpload}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Upload your custom QR code image (PNG, JPG, GIF, SVG - max 1MB)
                          </p>
                        </div>
                        
                        {settings.billCustomization.qrCodeDataUrl && (
                          <div className="mt-4">
                            <p className="text-sm text-gray-600 mb-2">QR Code Preview:</p>
                            <div className="flex items-center gap-4">
                              <img 
                                src={settings.billCustomization.qrCodeDataUrl} 
                                alt="QR Code Preview"
                                className="w-20 h-20 border border-gray-300 rounded object-contain"
                              />
                              <button
                                onClick={() => handleSettingChange('billCustomization', {
                                  ...settings.billCustomization,
                                  qrCodeFile: null,
                                  qrCodeDataUrl: ''
                                })}
                                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                              >
                                Remove QR Code
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {!settings.billCustomization.qrCodeDataUrl && (
                          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="font-semibold text-blue-800 mb-2">💡 Custom QR Code Ideas:</h4>
                            <ul className="text-sm text-blue-700 space-y-1">
                              <li>• Website URL QR code</li>
                              <li>• Social media profile QR code</li>
                              <li>• Google Reviews QR code</li>
                              <li>• WiFi password QR code</li>
                              <li>• Contact information QR code</li>
                            </ul>
                            <p className="text-xs text-blue-600 mt-2">
                              Generate QR codes online at qr-code-generator.com or similar services
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Preview Button */}
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    // Generate preview of custom bill using uploaded files
                    const previewWindow = window.open('', '_blank', 'width=400,height=600');
                    if (previewWindow) {
                      const previewHTML = generateCustomBillPreview(settings.billCustomization);
                      previewWindow.document.write(previewHTML);
                      previewWindow.document.close();
                    } else {
                      alert('Please allow popups to preview custom bills');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Preview Custom Bill
                </button>
              </div>
            </>
          )}
        </div>

        {/* UPI Payment Settings */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-purple-100 p-2 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">UPI Payment Settings</h2>
              <p className="text-gray-600 text-sm">Configure UPI payment integration for seamless transactions</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Enable UPI Payments
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={settings.enableUpiPayments}
                    onChange={() => handleSettingChange('enableUpiPayments', true)}
                    className="w-4 h-4"
                  />
                  <span>ON</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!settings.enableUpiPayments}
                    onChange={() => handleSettingChange('enableUpiPayments', false)}
                    className="w-4 h-4"
                  />
                  <span>OFF</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                UPI Base URL
              </label>
              <input
                type="text"
                value={settings.upiBaseUrl}
                onChange={(e) => handleSettingChange('upiBaseUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="upi://pay?pa=yourname@upi&pn=YourName&mc=0000&mode=02&purpose=00"
              />
              <p className="text-xs text-gray-500 mt-1">
                Your complete UPI URL (amount will be added automatically)
              </p>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Merchant Name
              </label>
              <input
                type="text"
                value={settings.merchantName}
                onChange={(e) => handleSettingChange('merchantName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Restaurant Name"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Default UPI App
              </label>
              <select
                value={settings.defaultUpiApp}
                onChange={(e) => handleSettingChange('defaultUpiApp', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="phonepe">PhonePe</option>
                <option value="paytm">Paytm</option>
                <option value="googlepay">Google Pay</option>
                <option value="bhim">BHIM UPI</option>
              </select>
            </div>
          </div>

          <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 className="font-semibold text-purple-800 mb-2">UPI Payment Integration</h4>
            <p className="text-purple-700 text-sm">
              • Uses your complete UPI URL with bill amount added automatically<br/>
              • Redirects to selected UPI app for payment<br/>
              • Returns to app after payment completion<br/>
              • Updates order status automatically
            </p>
          </div>

          {/* UPI Test Section */}
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-3">Test UPI Payment</h4>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  if (!settings.upiBaseUrl) {
                    alert('Please enter UPI Base URL first');
                    return;
                  }
                  const testAmount = 100;
                  const testUpiUrl = `${settings.upiBaseUrl}&am=${testAmount}&cu=INR&tn=${encodeURIComponent('Test Payment')}`;
                  window.open(testUpiUrl, '_blank');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                Test UPI Payment (₹100)
              </button>
            </div>
          </div>
        </div>

        {/* Print Test Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Test Printers</h3>
          <div className="flex gap-4">
            <button
              onClick={() => {
                // Test kitchen printer
                alert('Kitchen printer test - would print KOT format');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              <Printer size={18} />
              Test Kitchen Printer
            </button>
            <button
              onClick={() => {
                // Test cash counter printer
                alert('Cash counter printer test - would print final bill format');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              <Printer size={18} />
              Test Cash Counter Printer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}