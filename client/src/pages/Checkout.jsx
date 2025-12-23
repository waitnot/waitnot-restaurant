import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Banknote, Smartphone } from 'lucide-react';
import { useCart } from '../context/CartContext';
import axios from 'axios';

export default function Checkout() {
  const { cart, restaurant, updateQuantity, removeFromCart, clearCart, total } = useCart();
  const navigate = useNavigate();
  const [orderType, setOrderType] = useState('delivery');
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    paymentMethod: 'upi'
  });
  const [showPayment, setShowPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, processing, success, failed

  // Get UPI settings
  const getUpiSettings = () => {
    const restaurantId = restaurant?._id;
    if (!restaurantId) {
      console.log('No restaurant ID available for UPI settings');
      return null;
    }
    
    try {
      const settingsKey = `printer_settings_${restaurantId}`;
      console.log('Looking for UPI settings with key:', settingsKey);
      
      const savedSettings = localStorage.getItem(settingsKey);
      console.log('Raw UPI settings:', savedSettings);
      
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

    const finalAmount = total + (orderType === 'delivery' ? 40 : 0) + Math.round(total * 0.05);
    const transactionNote = `Order from ${restaurant.name} - ${formData.customerName}`;
    
    // Create UPI payment URL
    const upiUrl = `upi://pay?pa=${upiSettings.upiMerchantId}&pn=${encodeURIComponent(upiSettings.merchantName || restaurant.name)}&am=${finalAmount}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
    
    setPaymentStatus('processing');
    
    // For mobile devices, try to open UPI app directly
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      window.location.href = upiUrl;
    } else {
      // For desktop, open in new tab
      window.open(upiUrl, '_blank');
    }
    
    // Simulate payment completion after a delay (in real app, this would be handled by payment gateway callback)
    setTimeout(() => {
      const confirmed = window.confirm(
        `Payment of ₹${finalAmount} initiated.\n\nHave you completed the payment in your UPI app?\n\nClick OK if payment is successful, Cancel if failed.`
      );
      
      if (confirmed) {
        setPaymentStatus('success');
        confirmPayment();
      } else {
        setPaymentStatus('failed');
        alert('Payment failed. Please try again.');
      }
    }, 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowPayment(true);
  };

  const confirmPayment = async () => {
    try {
      const finalAmount = total + (orderType === 'delivery' ? 40 : 0) + Math.round(total * 0.05);
      
      const orderData = {
        restaurantId: restaurant._id,
        items: cart.map(item => ({
          menuItemId: item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        totalAmount: finalAmount,
        orderType,
        ...formData,
        paymentStatus: formData.paymentMethod === 'upi' && paymentStatus === 'success' ? 'paid' : 'pending',
        paymentMethod: formData.paymentMethod
      };

      await axios.post('/api/orders', orderData);
      
      if (formData.paymentMethod === 'upi' && paymentStatus === 'success') {
        alert('✅ Payment successful! Order placed successfully!');
      } else if (formData.paymentMethod === 'cash') {
        alert('✅ Order placed successfully! Pay with cash on delivery/at table.');
      } else {
        alert('Order placed successfully! Payment pending.');
      }
      
      clearCart();
      navigate('/');
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order');
    }
  };

  const handlePaymentClick = () => {
    if (formData.paymentMethod === 'upi') {
      handleUpiPayment();
    } else {
      // Handle cash payment (pay on delivery/at table)
      alert('✅ Order placed! Pay with cash on delivery or at the restaurant.');
      setPaymentStatus('success'); // Cash payment is always successful
      confirmPayment();
    }
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-12 text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Your cart is empty</h2>
        <button
          onClick={() => navigate('/')}
          className="bg-primary text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-red-600 text-sm sm:text-base"
        >
          Browse Restaurants
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 sm:mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4">
              Order from {restaurant?.name}
            </h2>
            
            {cart.map((item) => (
              <div key={item._id} className="flex items-center gap-4 py-4 border-b">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{item.name}</h3>
                  <p className="text-primary font-bold">₹{item.price}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateQuantity(item._id, item.quantity - 1)}
                    className="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    -
                  </button>
                  <span className="font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item._id, item.quantity + 1)}
                    className="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    +
                  </button>
                </div>
                
                <button
                  onClick={() => removeFromCart(item._id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>

          {/* Order Details Form */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4">Order Details</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Order Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="delivery"
                      checked={orderType === 'delivery'}
                      onChange={(e) => setOrderType(e.target.value)}
                      className="mr-2"
                    />
                    Delivery
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="dine-in"
                      checked={orderType === 'dine-in'}
                      onChange={(e) => setOrderType(e.target.value)}
                      className="mr-2"
                    />
                    Dine-in
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  required
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {orderType === 'delivery' && (
                <div>
                  <label className="block text-gray-700 mb-2">Delivery Address</label>
                  <textarea
                    required
                    value={formData.deliveryAddress}
                    onChange={(e) => setFormData({...formData, deliveryAddress: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    rows="3"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-primary text-white py-3 rounded-lg hover:bg-red-600 font-semibold"
              >
                Proceed to Payment
              </button>
            </form>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 lg:sticky lg:top-24">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4">Order Summary</h2>
            
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">₹{total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Fee</span>
                <span className="font-semibold">₹{orderType === 'delivery' ? 40 : 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Taxes</span>
                <span className="font-semibold">₹{Math.round(total * 0.05)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">
                  ₹{total + (orderType === 'delivery' ? 40 : 0) + Math.round(total * 0.05)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 md:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Payment</h2>
            
            {paymentStatus === 'processing' && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Processing payment...</p>
                {formData.paymentMethod === 'upi' && (
                  <p className="text-sm text-gray-500 mt-2">Please complete payment in your UPI app</p>
                )}
              </div>
            )}
            
            {paymentStatus === 'pending' && (
              <>
                <div className="space-y-4 mb-6">
                  <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:border-primary ${
                    formData.paymentMethod === 'upi' ? 'border-primary bg-primary/5' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="payment"
                      value="upi"
                      checked={formData.paymentMethod === 'upi'}
                      onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                    />
                    <Smartphone size={24} className="text-primary" />
                    <div className="flex-1">
                      <span className="font-semibold">UPI Payment</span>
                      <p className="text-xs text-gray-500">Pay using PhonePe, Paytm, GPay, etc.</p>
                    </div>
                  </label>
                  
                  <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:border-primary ${
                    formData.paymentMethod === 'cash' ? 'border-primary bg-primary/5' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="payment"
                      value="cash"
                      checked={formData.paymentMethod === 'cash'}
                      onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                    />
                    <Banknote size={24} className="text-primary" />
                    <div className="flex-1">
                      <span className="font-semibold">Cash Payment</span>
                      <p className="text-xs text-gray-500">Pay with cash on delivery/at table</p>
                    </div>
                  </label>
                </div>

                {/* Payment Amount Summary */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-gray-800 mb-2">Payment Summary</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>₹{total}</span>
                    </div>
                    {orderType === 'delivery' && (
                      <div className="flex justify-between">
                        <span>Delivery Fee</span>
                        <span>₹40</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Taxes (5%)</span>
                      <span>₹{Math.round(total * 0.05)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold text-lg">
                      <span>Total Amount</span>
                      <span className="text-primary">₹{total + (orderType === 'delivery' ? 40 : 0) + Math.round(total * 0.05)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowPayment(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePaymentClick}
                    className="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-red-600 flex items-center justify-center gap-2"
                  >
                    {formData.paymentMethod === 'upi' ? (
                      <>
                        <Smartphone size={18} />
                        Pay with UPI
                      </>
                    ) : (
                      <>
                        <Banknote size={18} />
                        Pay with Cash
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
