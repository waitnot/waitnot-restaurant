import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Printer, Save, ArrowLeft } from 'lucide-react';
import axios from 'axios';

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
    upiMerchantId: '',
    merchantName: '',
    defaultUpiApp: 'phonepe'
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
                UPI Merchant ID
              </label>
              <input
                type="text"
                value={settings.upiMerchantId}
                onChange={(e) => handleSettingChange('upiMerchantId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="merchant@paytm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Your UPI ID where payments will be received
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
              • Redirects to selected UPI app for payment<br/>
              • Automatically fills amount and merchant details<br/>
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
                  if (!settings.upiMerchantId) {
                    alert('Please enter UPI Merchant ID first');
                    return;
                  }
                  const testAmount = 100;
                  const upiUrl = `upi://pay?pa=${settings.upiMerchantId}&pn=${encodeURIComponent(settings.merchantName || 'Test Restaurant')}&am=${testAmount}&cu=INR&tn=${encodeURIComponent('Test Payment')}`;
                  window.open(upiUrl, '_blank');
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