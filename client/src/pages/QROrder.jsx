import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Minus, Banknote, Smartphone, CheckCircle } from 'lucide-react';
import axios from 'axios';

export default function QROrder() {
  const { restaurantId, tableNumber } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, processing, success, failed

  // Get UPI settings
  const getUpiSettings = () => {
    if (!restaurant?._id) {
      console.log('No restaurant ID available');
      return null;
    }
    
    try {
      const settingsKey = `printer_settings_${restaurant._id}`;
      console.log('Looking for settings with key:', settingsKey);
      
      const savedSettings = localStorage.getItem(settingsKey);
      console.log('Raw saved settings:', savedSettings);
      
      const settings = savedSettings ? JSON.parse(savedSettings) : null;
      console.log('Parsed UPI settings:', settings);
      
      return settings;
    } catch (error) {
      console.error('Error loading UPI settings:', error);
      return null;
    }
  };

  const handleUpiPayment = () => {
    const upiSettings = getUpiSettings();
    
    if (!upiSettings || !upiSettings.enableUpiPayments) {
      alert('UPI payments are not enabled for this restaurant');
      return;
    }
    
    if (!upiSettings.upiMerchantId) {
      alert('UPI Merchant ID not configured');
      return;
    }

    const transactionNote = `Table ${tableNumber} - ${restaurant.name} - ${customerInfo.name}`;
    
    // Create UPI payment URL
    const upiUrl = `upi://pay?pa=${upiSettings.upiMerchantId}&pn=${encodeURIComponent(upiSettings.merchantName || restaurant.name)}&am=${total}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
    
    setPaymentStatus('processing');
    
    // For mobile devices, try to open UPI app directly
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      window.location.href = upiUrl;
    } else {
      // For desktop, open in new tab
      window.open(upiUrl, '_blank');
    }
    
    // Simulate payment completion after a delay
    setTimeout(() => {
      const confirmed = window.confirm(
        `Payment of ₹${total} initiated.\n\nHave you completed the payment in your UPI app?\n\nClick OK if payment is successful, Cancel if failed.`
      );
      
      if (confirmed) {
        setPaymentStatus('success');
        placeOrder();
      } else {
        setPaymentStatus('failed');
        alert('Payment failed. Please try again.');
      }
    }, 3000);
  };

  useEffect(() => {
    fetchRestaurant();
    loadSavedCustomerInfo();
  }, [restaurantId, tableNumber]);

  const loadSavedCustomerInfo = () => {
    // Load saved customer info for this table
    const sessionKey = `table_session_${restaurantId}_${tableNumber}`;
    const savedSession = localStorage.getItem(sessionKey);
    
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        // Check if session is still active (not older than 24 hours)
        const sessionAge = Date.now() - session.timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (sessionAge < maxAge) {
          setCustomerInfo({
            name: session.name || '',
            phone: session.phone || ''
          });
          console.log('Loaded saved customer info:', session.name);
        } else {
          // Session expired, clear it
          localStorage.removeItem(sessionKey);
        }
      } catch (error) {
        console.error('Error loading session:', error);
      }
    }
  };

  const saveCustomerInfo = (name, phone) => {
    const sessionKey = `table_session_${restaurantId}_${tableNumber}`;
    const session = {
      name,
      phone,
      timestamp: Date.now()
    };
    localStorage.setItem(sessionKey, JSON.stringify(session));
  };

  const fetchRestaurant = async () => {
    try {
      const { data } = await axios.get(`/api/restaurants/${restaurantId}`);
      setRestaurant(data);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    }
  };

  const addToCart = (item) => {
    const existing = cart.find(i => i._id === item._id);
    if (existing) {
      setCart(cart.map(i => 
        i._id === item._id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (itemId, quantity) => {
    if (quantity === 0) {
      setCart(cart.filter(i => i._id !== itemId));
    } else {
      setCart(cart.map(i => i._id === itemId ? { ...i, quantity } : i));
    }
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const placeOrder = async () => {
    try {
      // Save customer info for future orders
      saveCustomerInfo(customerInfo.name, customerInfo.phone);
      
      const orderData = {
        restaurantId,
        tableNumber: parseInt(tableNumber),
        items: cart.map(item => ({
          menuItemId: item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        totalAmount: total,
        orderType: 'dine-in',
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        paymentStatus: paymentMethod === 'upi' && paymentStatus === 'success' ? 'paid' : 'pending',
        paymentMethod
      };

      await axios.post('/api/orders', orderData);
      setOrderPlaced(true);
      setTimeout(() => {
        // Don't navigate away, allow ordering again
        setOrderPlaced(false);
        setCart([]);
        setShowCheckout(false);
        setPaymentStatus('pending'); // Reset payment status
      }, 2000);
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order');
    }
  };

  const handlePaymentClick = () => {
    // Debug logging
    console.log('Payment click - Customer Info:', customerInfo);
    console.log('Restaurant ID:', restaurant?._id);
    
    if (!customerInfo.name || !customerInfo.phone) {
      alert('Please enter your name and phone number');
      return;
    }

    // Debug UPI settings
    const upiSettings = getUpiSettings();
    console.log('UPI Settings:', upiSettings);

    if (paymentMethod === 'upi') {
      handleUpiPayment();
    } else {
      // Handle cash payment
      alert('✅ Order placed! Pay with cash at the table when food is served.');
      setPaymentStatus('success'); // Cash payment is always successful (pay at table)
      placeOrder();
    }
  };

  if (!restaurant) return <div className="text-center py-12">Loading...</div>;

  if (orderPlaced) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <CheckCircle size={80} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Order Placed!</h2>
          <p className="text-gray-600 mb-4">Your food will be served shortly</p>
          <p className="text-sm text-gray-500">Table {tableNumber}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold">{restaurant.name}</h1>
          <p className="text-sm">Table {tableNumber}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Menu */}
        {!showCheckout ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-20">
              {restaurant.menu.map((item) => {
                const quantity = cart.find(i => i._id === item._id)?.quantity || 0;
                
                return (
                  <div key={item._id} className="bg-white rounded-lg shadow overflow-hidden">
                    {/* Item Image */}
                    <div className="h-40 bg-gradient-to-r from-accent to-secondary flex items-center justify-center relative">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-3xl">🍽️</span>
                      )}
                      {item.isVeg && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded">
                          <span className="text-sm">🌱</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4">
                      <h3 className="font-bold text-gray-800">{item.name}</h3>
                      <p className="text-sm text-gray-600">{item.description}</p>
                      <p className="text-lg font-bold text-primary mt-2">₹{item.price}</p>
                    </div>
                    
                    <div className="px-4 pb-4">
                      {quantity === 0 ? (
                        <button
                          onClick={() => addToCart(item)}
                          className="w-full bg-primary text-white py-2 rounded-lg hover:bg-red-600"
                        >
                          Add
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-primary text-white rounded-lg p-2">
                          <button
                            onClick={() => updateQuantity(item._id, quantity - 1)}
                            className="p-1 hover:bg-red-600 rounded"
                          >
                            <Minus size={20} />
                          </button>
                          <span className="font-bold">{quantity}</span>
                          <button
                            onClick={() => updateQuantity(item._id, quantity + 1)}
                            className="p-1 hover:bg-red-600 rounded"
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cart Summary */}
            {cart.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{cart.length} items</p>
                    <p className="text-xl font-bold text-primary">₹{total}</p>
                  </div>
                  <button
                    onClick={() => setShowCheckout(true)}
                    className="bg-primary text-white px-8 py-3 rounded-lg hover:bg-red-600 font-semibold"
                  >
                    Proceed to Checkout
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Checkout */
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Checkout</h2>
            
            {/* Order Items */}
            <div className="mb-6">
              <h3 className="font-bold text-gray-800 mb-3">Your Order</h3>
              {cart.map((item) => (
                <div key={item._id} className="flex justify-between py-2 border-b">
                  <span>{item.name} x {item.quantity}</span>
                  <span className="font-semibold">₹{item.price * item.quantity}</span>
                </div>
              ))}
              <div className="flex justify-between py-3 text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">₹{total}</span>
              </div>
            </div>

            {/* Customer Info */}
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="mb-6">
              <h3 className="font-bold text-gray-800 mb-3">Payment Method</h3>
              
              {paymentStatus === 'processing' && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-gray-600">Processing payment...</p>
                  {paymentMethod === 'upi' && (
                    <p className="text-sm text-gray-500 mt-2">Please complete payment in your UPI app</p>
                  )}
                </div>
              )}
              
              {paymentStatus === 'pending' && (
                <div className="space-y-3">
                  <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:border-primary ${
                    paymentMethod === 'upi' ? 'border-primary bg-primary/5' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      value="upi"
                      checked={paymentMethod === 'upi'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <Smartphone size={24} className="text-primary" />
                    <div className="flex-1">
                      <span className="font-semibold">UPI Payment</span>
                      <p className="text-xs text-gray-500">Pay using PhonePe, Paytm, GPay, etc.</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:border-primary ${
                    paymentMethod === 'cash' ? 'border-primary bg-primary/5' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <Banknote size={24} className="text-primary" />
                    <div className="flex-1">
                      <span className="font-semibold">Cash Payment</span>
                      <p className="text-xs text-gray-500">Pay with cash at the table</p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {paymentStatus === 'pending' && (
              <div className="flex gap-4">
                <button
                  onClick={() => setShowCheckout(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300"
                >
                  Back
                </button>
                
                {/* Show different button states based on form completion */}
                {!customerInfo.name || !customerInfo.phone ? (
                  <div className="flex-1">
                    <button
                      disabled
                      className="w-full bg-gray-300 text-gray-500 py-3 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {paymentMethod === 'upi' ? (
                        <>
                          <Smartphone size={18} />
                          Enter Name & Phone First
                        </>
                      ) : (
                        <>
                          <Banknote size={18} />
                          Enter Name & Phone First
                        </>
                      )}
                    </button>
                    <p className="text-xs text-red-500 mt-1 text-center">
                      Please fill in your name and phone number above
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handlePaymentClick}
                    className="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-red-600 flex items-center justify-center gap-2"
                  >
                    {paymentMethod === 'upi' ? (
                      <>
                        <Smartphone size={18} />
                        Pay ₹{total} with UPI
                      </>
                    ) : (
                      <>
                        <Banknote size={18} />
                        Pay ₹{total} with Cash
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
