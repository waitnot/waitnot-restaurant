import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Minus, Banknote, Smartphone, CheckCircle, Leaf, AlertTriangle, Phone, Mail, Calendar, Tag, Search, ShoppingCart, Star, Clock, MapPin, Sparkles, MessageCircle, Home, User } from 'lucide-react';
import axios from 'axios';
import { trackMenuEvent, trackOrderEvent } from '../utils/analytics';
import FeedbackForm from '../components/FeedbackForm';

export default function HomeDelivery() {
  const { restaurantId } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ 
    name: '', 
    phone: '', 
    address: '',
    email: '' 
  });
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [availableDiscounts, setAvailableDiscounts] = useState([]);
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [discountApplied, setDiscountApplied] = useState(null);
  const [bannerDiscounts, setBannerDiscounts] = useState([]);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState(null);

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

  // Calculate totals
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const finalTotal = discountApplied ? discountApplied.finalAmount : total;

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

    const transactionNote = `Home Delivery - ${restaurant.name} - ${customerInfo.name}`;
    
    // Create UPI payment URL
    const upiUrl = `upi://pay?pa=${upiSettings.upiMerchantId}&pn=${encodeURIComponent(upiSettings.merchantName || restaurant.name)}&am=${finalTotal}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
    
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
        `Payment of ₹${finalTotal} initiated.\n\nHave you completed the payment in your UPI app?\n\nClick OK if payment is successful, Cancel if failed.`
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
  }, [restaurantId]);

  const fetchRestaurant = async () => {
    try {
      const { data } = await axios.get(`/api/restaurants/${restaurantId}`);
      setRestaurant(data);
      
      if (data.features && data.features.qrOrderingEnabled === false) {
        console.log('QR ordering is disabled for this restaurant');
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    }
  };

  // Remove discount
  const removeDiscount = () => {
    setSelectedDiscount(null);
    setDiscountApplied(null);
    
    // Track discount removal
    trackMenuEvent('discount_removed', restaurantId, 'home_delivery', {
      discount_name: selectedDiscount?.name
    });
  };

  const addToCart = (item) => {
    // Track menu item addition
    trackMenuEvent('add_to_cart', item.name, item.category, item.price);
    
    const existingItem = cart.find(cartItem => cartItem._id === item._id);
    if (existingItem) {
      setCart(cart.map(cartItem =>
        cartItem._id === item._id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (itemId, quantity) => {
    const item = cart.find(cartItem => cartItem._id === itemId);
    
    if (quantity === 0) {
      trackMenuEvent('remove_from_cart', item.name, item.category, item.price);
      setCart(cart.filter(cartItem => cartItem._id !== itemId));
    } else {
      trackMenuEvent('update_quantity', item.name, item.category, item.price);
      setCart(cart.map(cartItem =>
        cartItem._id === itemId
          ? { ...cartItem, quantity }
          : cartItem
      ));
    }
  };

  const removeFromCart = (itemId) => {
    const item = cart.find(cartItem => cartItem._id === itemId);
    if (item) {
      trackMenuEvent('remove_from_cart', item.name, item.category, item.price);
      setCart(cart.filter(cartItem => cartItem._id !== itemId));
    }
  };

  const placeOrder = async () => {
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.address) {
      alert('Please fill in all required customer details');
      return;
    }

    try {
      const orderData = {
        restaurantId,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerEmail: customerInfo.email,
        deliveryAddress: customerInfo.address,
        items: cart,
        totalAmount: finalTotal,
        orderType: 'delivery',
        paymentMethod,
        paymentStatus: paymentMethod === 'cash' ? 'pending' : paymentStatus,
        source: 'home_delivery',
        discount: discountApplied ? {
          name: discountApplied.discount.name,
          value: discountApplied.discount.discount_value,
          type: discountApplied.discount.discount_type,
          amount: discountApplied.discountAmount
        } : null
      };

      const { data } = await axios.post('/api/orders', orderData);
      
      // Track successful order
      const orderId = `${restaurantId}_delivery_${Date.now()}`;
      trackOrderEvent('place_order', orderId, finalTotal, cart.length);
      
      setOrderPlaced(true);
      setCompletedOrderId(data._id);
      setCart([]);
      setCustomerInfo({ name: '', phone: '', address: '', email: '' });
      setSelectedDiscount(null);
      setDiscountApplied(null);
      
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
    }
  };

  // Filter menu items
  const filteredItems = restaurant?.menu?.filter(item => {
    if (!item.available) return false;
    
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesSearch;
  }) || [];

  // Get unique categories
  const categories = ['All', ...new Set(restaurant?.menu?.filter(item => item.available).map(item => item.category) || [])];

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading restaurant...</p>
        </div>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Placed Successfully!</h2>
          <p className="text-gray-600 mb-6">
            Your home delivery order has been sent to {restaurant.name}. 
            You will receive updates on your phone.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">Order Total</p>
            <p className="text-2xl font-bold text-green-600">₹{finalTotal}</p>
            <p className="text-sm text-gray-500 mt-2">
              Delivery Address: {customerInfo.address}
            </p>
          </div>
          <button
            onClick={() => {
              setOrderPlaced(false);
              setShowCheckout(false);
            }}
            className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 font-semibold"
          >
            Place Another Order
          </button>
          
          {completedOrderId && (
            <button
              onClick={() => setShowFeedbackForm(true)}
              className="w-full mt-3 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center gap-2"
            >
              <MessageCircle size={18} />
              Share Feedback
            </button>
          )}
        </div>
        
        {showFeedbackForm && completedOrderId && (
          <FeedbackForm
            restaurantId={restaurantId}
            orderId={completedOrderId}
            onClose={() => setShowFeedbackForm(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Home className="w-6 h-6 text-red-600 mr-2" />
              <div>
                <h1 className="text-xl font-bold text-gray-800">{restaurant.name}</h1>
                <p className="text-sm text-gray-600">Home Delivery</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Cart Total</p>
                <p className="text-lg font-bold text-red-600">₹{finalTotal}</p>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setShowCheckout(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <ShoppingCart size={18} />
                  Checkout ({cart.length})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Restaurant Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{restaurant.name}</h2>
              <p className="text-gray-600 mb-4">{restaurant.description}</p>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center">
                  <Star className="w-4 h-4 text-yellow-500 mr-1" />
                  <span>{restaurant.rating || '4.5'}</span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>{restaurant.deliveryTime || '30-45'} mins</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span>Home Delivery Available</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Categories */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-4">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  selectedCategory === category
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div key={item._id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {item.image && (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
                  {item.isVeg ? (
                    <Leaf className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 border-2 border-red-600 flex-shrink-0">
                      <div className="w-full h-full bg-red-600 rounded-full transform scale-50"></div>
                    </div>
                  )}
                </div>
                
                {item.description && (
                  <p className="text-gray-600 text-sm mb-3">{item.description}</p>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-red-600">₹{item.price}</span>
                  
                  {cart.find(cartItem => cartItem._id === item._id) ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateQuantity(item._id, cart.find(cartItem => cartItem._id === item._id).quantity - 1)}
                        className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="font-semibold min-w-[2rem] text-center">
                        {cart.find(cartItem => cartItem._id === item._id)?.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item._id, cart.find(cartItem => cartItem._id === item._id).quantity + 1)}
                        className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Add
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No items found</h3>
            <p className="text-gray-500">Try adjusting your search or category filter</p>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Checkout</h2>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>

              {/* Customer Details Form */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Customer Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="Enter your phone number"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Address *
                    </label>
                    <textarea
                      value={customerInfo.address}
                      onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="Enter complete delivery address"
                      rows="3"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={customerInfo.email}
                      onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Order Summary</h3>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item._id} className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-sm text-gray-600">₹{item.price} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">₹{item.price * item.quantity}</span>
                        <button
                          onClick={() => removeFromCart(item._id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-red-600">₹{finalTotal}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Payment Method</h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="mr-3"
                    />
                    <Banknote className="w-5 h-5 mr-2" />
                    Cash on Delivery
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="upi"
                      checked={paymentMethod === 'upi'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="mr-3"
                    />
                    <Smartphone className="w-5 h-5 mr-2" />
                    UPI Payment
                  </label>
                </div>
              </div>

              {/* Place Order Button */}
              <div className="space-y-3">
                {paymentMethod === 'cash' ? (
                  <button
                    onClick={placeOrder}
                    disabled={!customerInfo.name || !customerInfo.phone || !customerInfo.address}
                    className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Place Order - Cash on Delivery
                  </button>
                ) : (
                  <button
                    onClick={handleUpiPayment}
                    disabled={!customerInfo.name || !customerInfo.phone || !customerInfo.address || paymentStatus === 'processing'}
                    className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {paymentStatus === 'processing' ? 'Processing Payment...' : `Pay ₹${finalTotal} via UPI`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}