import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Minus, Banknote, Smartphone, CheckCircle, Leaf, AlertTriangle, Phone, Mail, Calendar, Tag, Search, ShoppingCart, Star, Clock, MapPin, Sparkles } from 'lucide-react';
import axios from 'axios';
import { trackQROrderEvent, trackMenuEvent, trackOrderEvent } from '../utils/analytics';
import MenuItemImage from '../components/MenuItemImage';
import { useMenuImages } from '../hooks/useMenuImages';


export default function QROrder() {
  const { restaurantId, tableNumber } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, processing, success, failed
  const [availableDiscounts, setAvailableDiscounts] = useState([]);
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [discountApplied, setDiscountApplied] = useState(null);
  const [bannerDiscounts, setBannerDiscounts] = useState([]);

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
    fetchAvailableDiscounts();
    fetchBannerDiscounts();
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
      
      // Check if QR ordering is enabled
      if (data.features && data.features.qrOrderingEnabled === false) {
        console.log('QR ordering is disabled for this restaurant');
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    }
  };

  const fetchAvailableDiscounts = async () => {
    try {
      const { data } = await axios.get(`/api/discounts/active/${restaurantId}?qr=true`);
      setAvailableDiscounts(data);
    } catch (error) {
      console.error('Error fetching discounts:', error);
    }
  };

  const fetchBannerDiscounts = async () => {
    try {
      const { data } = await axios.get(`/api/discounts/banners/${restaurantId}`);
      setBannerDiscounts(data);
    } catch (error) {
      console.error('Error fetching banner discounts:', error);
    }
  };

  const removeDiscount = () => {
    setDiscountApplied(null);
    setSelectedDiscount(null);
    
    // Track discount removal
    trackQROrderEvent('discount_removed', restaurantId, tableNumber, {
      discount_name: selectedDiscount?.name
    });
    
    // Note: The useEffect will automatically reapply the best discount after removal
    // if there are other applicable discounts
  };

  const addToCart = (item) => {
    // Track menu item addition
    trackMenuEvent('add_to_cart', item.name, item.category, item.price);
    trackQROrderEvent('add_to_cart', restaurantId, tableNumber, {
      item_name: item.name,
      item_price: item.price,
      item_category: item.category
    });
    
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
    const item = cart.find(i => i._id === itemId);
    if (item) {
      if (quantity === 0) {
        trackMenuEvent('remove_from_cart', item.name, item.category, item.price);
        trackQROrderEvent('remove_from_cart', restaurantId, tableNumber, {
          item_name: item.name
        });
      } else {
        trackMenuEvent('update_quantity', item.name, item.category, item.price);
        trackQROrderEvent('update_quantity', restaurantId, tableNumber, {
          item_name: item.name,
          new_quantity: quantity
        });
      }
    }
    
    if (quantity === 0) {
      setCart(cart.filter(i => i._id !== itemId));
    } else {
      setCart(cart.map(i => i._id === itemId ? { ...i, quantity } : i));
    }
  };

  // Calculate discount for individual items
  const getItemDiscount = (item) => {
    if (!availableDiscounts.length) return null;
    
    // Find the best applicable discount for this item
    let bestDiscount = null;
    let bestSavings = 0;
    
    for (const discount of availableDiscounts) {
      // Check if discount applies to this item's category
      if (discount.applicable_categories && discount.applicable_categories.length > 0) {
        if (!discount.applicable_categories.includes(item.category)) {
          continue; // Skip if item category not in applicable categories
        }
      }
      
      let itemSavings = 0;
      if (discount.discount_type === 'percentage') {
        itemSavings = (item.price * discount.discount_value) / 100;
      } else {
        itemSavings = Math.min(discount.discount_value, item.price);
      }
      
      // Apply maximum discount limit
      if (discount.max_discount_amount && itemSavings > discount.max_discount_amount) {
        itemSavings = discount.max_discount_amount;
      }
      
      if (itemSavings > bestSavings) {
        bestSavings = itemSavings;
        bestDiscount = {
          ...discount,
          itemSavings: Math.round(itemSavings * 100) / 100,
          discountedPrice: Math.round((item.price - itemSavings) * 100) / 100
        };
      }
    }
    
    return bestDiscount;
  };

  const applyDiscount = async (discount) => {
    try {
      const response = await axios.post('/api/discounts/apply', {
        discountId: discount.id,
        orderAmount: total,
        items: cart,
        isQrOrder: true
      });
      
      setDiscountApplied(response.data);
      setSelectedDiscount(discount);
      
      // Track discount application
      trackQROrderEvent('discount_applied', restaurantId, tableNumber, {
        discount_name: discount.name,
        discount_value: discount.discount_value,
        discount_type: discount.discount_type,
        original_amount: total,
        discount_amount: response.data.discountAmount,
        final_amount: response.data.finalAmount
      });
      
    } catch (error) {
      console.error('Error applying discount:', error);
      alert(error.response?.data?.error || 'Failed to apply discount');
    }
  };

  // Auto-apply best discount when cart changes
  const autoApplyBestDiscount = useCallback(async () => {
    if (availableDiscounts.length === 0 || total === 0) {
      return;
    }

    // Find the best discount (highest savings)
    let bestDiscount = null;
    let bestSavings = 0;

    for (const discount of availableDiscounts) {
      try {
        // Check if this discount is applicable
        if (total < discount.min_order_amount) {
          continue; // Skip if order doesn't meet minimum
        }

        const response = await axios.post('/api/discounts/apply', {
          discountId: discount.id,
          orderAmount: total,
          items: cart,
          isQrOrder: true
        });

        if (response.data.savings > bestSavings) {
          bestSavings = response.data.savings;
          bestDiscount = {
            discount,
            result: response.data
          };
        }
      } catch (error) {
        // Skip this discount if it can't be applied
        console.log(`Discount ${discount.name} not applicable:`, error.response?.data?.error);
      }
    }

    // Apply the best discount if found
    if (bestDiscount && bestSavings > 0) {
      setDiscountApplied(bestDiscount.result);
      setSelectedDiscount(bestDiscount.discount);
      
      // Track automatic discount application
      trackQROrderEvent('discount_auto_applied', restaurantId, tableNumber, {
        discount_name: bestDiscount.discount.name,
        discount_value: bestDiscount.discount.discount_value,
        discount_type: bestDiscount.discount.discount_type,
        original_amount: total,
        discount_amount: bestDiscount.result.discountAmount,
        final_amount: bestDiscount.result.finalAmount,
        auto_applied: true
      });
    } else {
      // No applicable discount found, clear any existing discount
      if (discountApplied) {
        setDiscountApplied(null);
        setSelectedDiscount(null);
      }
    }
  }, [availableDiscounts, total, cart, restaurantId, tableNumber, discountApplied]);

  // Auto-apply best discount when cart total or available discounts change
  useEffect(() => {
    if (availableDiscounts.length > 0 && total > 0) {
      autoApplyBestDiscount();
    }
  }, [autoApplyBestDiscount, availableDiscounts, total]);

  const placeOrder = async () => {
    try {
      // Track order placement
      const orderId = `${restaurantId}_${tableNumber}_${Date.now()}`;
      trackOrderEvent('place_order', orderId, total, cart.length);
      trackQROrderEvent('place_order', restaurantId, tableNumber, {
        total_amount: total,
        item_count: cart.length,
        payment_method: paymentMethod,
        customer_name: customerInfo.name
      });
      
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
        originalAmount: total,
        discountId: null,
        discountAmount: 0,
        isQrOrder: true,
        orderType: 'dine-in',
        customerName: customerInfo.name || 'Guest Customer',
        customerPhone: customerInfo.phone || '',
        paymentStatus: paymentMethod === 'upi' && paymentStatus === 'success' ? 'paid' : 'pending',
        paymentMethod
      };

      const response = await axios.post('/api/orders', orderData);
      const createdOrder = response.data;
      
      // Track successful order
      trackOrderEvent('order_success', orderId, total, cart.length);
      
      setOrderPlaced(true);
      setTimeout(() => {
        alert('🎉 Order placed successfully! Your food will be served shortly.');
        
        setOrderPlaced(false);
        setCart([]);
        setShowCheckout(false);
        setPaymentStatus('pending'); // Reset payment status
      }, 2000);
    } catch (error) {
      console.error('Error placing order:', error);
      
      // Track order failure
      trackOrderEvent('order_failed', `${restaurantId}_${tableNumber}_${Date.now()}`, total, cart.length);
      
      alert('Failed to place order');
    }
  };

  const handlePaymentClick = () => {
    // Debug logging
    console.log('Payment click - Customer Info:', customerInfo);
    console.log('Restaurant ID:', restaurant?._id);
    
    // Name and phone are now optional - no validation required
    
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

  // Check if QR ordering is disabled
  if (restaurant.features && restaurant.features.qrOrderingEnabled === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border border-gray-100 animate-bounce-in">
          <div className="mb-8">
            {/* Restaurant Logo */}
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-4 border-red-100">
                {restaurant.image ? (
                  <img 
                    src={restaurant.image} 
                    alt={`${restaurant.name} logo`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                ) : null}
                <span 
                  className="text-2xl text-gray-400"
                  style={{ display: restaurant.image ? 'none' : 'block' }}
                >
                  🍽️
                </span>
              </div>
            </div>
            
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping"></div>
              <div className="relative bg-gradient-to-r from-red-500 to-orange-500 p-4 rounded-full mx-auto w-20 h-20 flex items-center justify-center">
                <AlertTriangle size={40} className="text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">QR Ordering Unavailable</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              QR ordering has been temporarily disabled for <span className="font-semibold text-red-600">{restaurant.name}</span>. 
              Please contact the restaurant directly to place your order.
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center justify-center gap-2">
                <Phone size={18} className="text-red-500" />
                Contact Information
              </h3>
              <div className="space-y-3 text-sm">
                {restaurant.phone && (
                  <div className="flex items-center justify-center gap-2">
                    <Phone size={16} className="text-gray-500" />
                    <a 
                      href={`tel:${restaurant.phone}`} 
                      className="text-blue-600 hover:text-blue-800 font-semibold hover:underline transition-colors"
                    >
                      {restaurant.phone}
                    </a>
                  </div>
                )}
                {restaurant.email && (
                  <div className="flex items-center justify-center gap-2">
                    <Mail size={16} className="text-gray-500" />
                    <a 
                      href={`mailto:${restaurant.email}`} 
                      className="text-blue-600 hover:text-blue-800 font-semibold hover:underline transition-colors"
                    >
                      {restaurant.email}
                    </a>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4 border border-red-200">
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                <MapPin size={16} className="text-red-500" />
                <span>Table <span className="font-bold text-red-600">#{tableNumber}</span></span>
                <span>•</span>
                <span className="font-semibold">{restaurant.name}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Get unique categories from menu items
  const uniqueCategories = [...new Set(restaurant.menu.map(item => item.category))];
  const categories = ['All', ...uniqueCategories];
  
  // Filter menu based on selected category and search query
  let filteredMenu = selectedCategory === 'All' 
    ? restaurant.menu 
    : restaurant.menu.filter(item => item.category === selectedCategory);
  
  // Apply search filter
  if (searchQuery.trim()) {
    filteredMenu = filteredMenu.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-green-100">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
            <div className="relative bg-gradient-to-r from-green-500 to-emerald-500 p-6 rounded-full mx-auto w-24 h-24 flex items-center justify-center">
              <CheckCircle size={48} className="text-white" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Order Placed Successfully! 🎉</h2>
            <p className="text-gray-600 text-lg">Your delicious food will be served shortly</p>
            
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 mt-6">
              {/* Restaurant Logo and Info */}
              <div className="flex items-center justify-center mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                    {restaurant.image ? (
                      <img 
                        src={restaurant.image} 
                        alt={`${restaurant.name} logo`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                    ) : null}
                    <span 
                      className="text-lg text-gray-400"
                      style={{ display: restaurant.image ? 'none' : 'block' }}
                    >
                      🍽️
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-800">{restaurant.name}</div>
                    <div className="text-sm text-gray-500">Table #{tableNumber}</div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600">Table Number</span>
                <span className="font-bold text-xl text-red-600">#{tableNumber}</span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600">Restaurant</span>
                <span className="font-semibold text-gray-800">{restaurant.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Amount</span>
                <span className="font-bold text-xl text-green-600">₹{finalTotal}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 mt-6">
              <Clock size={16} />
              <span>Estimated delivery: 15-20 minutes</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Enhanced Header with Gradient */}
      <div className="bg-gradient-to-r from-red-500 via-red-600 to-red-700 text-white sticky top-0 z-20 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-2 w-16 h-16 flex items-center justify-center overflow-hidden">
                {restaurant.image ? (
                  <img 
                    src={restaurant.image} 
                    alt={`${restaurant.name} logo`}
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      // Fallback to emoji if image fails to load
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                ) : null}
                <span 
                  className="text-2xl"
                  style={{ display: restaurant.image ? 'none' : 'block' }}
                >
                  🍽️
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{restaurant.name}</h1>
                <div className="flex items-center space-x-2 text-red-100">
                  <MapPin size={16} />
                  <span className="text-sm">Table {tableNumber}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="flex items-center space-x-1 text-sm">
                  <Star size={14} className="text-yellow-300 fill-current" />
                  <span>{restaurant.rating || '4.5'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Menu */}
        {!showCheckout ? (
          <>
            {/* Enhanced Search Bar */}
            <div className="mb-6">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="flex items-center px-4 py-3">
                    <Search className="w-5 h-5 text-gray-400 mr-3" />
                    <input
                      type="text"
                      placeholder="Search delicious food..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 outline-none text-gray-700 placeholder-gray-400"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="ml-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Category Filter */}
            <div className="mb-6">
              <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                {categories.map((category, index) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-6 py-3 rounded-full whitespace-nowrap font-medium transition-all duration-300 transform hover:scale-105 ${
                      selectedCategory === category
                        ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-red-300 hover:text-red-600 shadow-sm'
                    }`}
                    style={{
                      animationDelay: `${index * 100}ms`
                    }}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Results Info with Animation */}
            {searchQuery && (
              <div className="mb-4 animate-fade-in">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Search size={16} className="text-blue-600" />
                    {filteredMenu.length > 0 ? (
                      <p className="text-blue-800 text-sm">
                        Found <span className="font-semibold">{filteredMenu.length}</span> item{filteredMenu.length !== 1 ? 's' : ''} for "<span className="font-semibold">{searchQuery}</span>"
                      </p>
                    ) : (
                      <p className="text-blue-800 text-sm">
                        No items found for "<span className="font-semibold">{searchQuery}</span>". Try a different search term.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Menu List */}
            <div className="space-y-4 mb-24">
              {filteredMenu.map((item, index) => {
                const quantity = cart.find(i => i._id === item._id)?.quantity || 0;
                const itemDiscount = getItemDiscount(item);
                
                return (
                  <div 
                    key={item._id} 
                    className={`group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-red-200 transform hover:-translate-y-1 animate-slide-up stagger-${Math.min(index + 1, 5)} menu-card`}
                  >
                    <div className="flex items-stretch">
                      {/* Enhanced Item Image */}
                      <div className="item-image w-28 h-28 sm:w-36 sm:h-36 bg-gradient-to-br from-red-400 via-red-500 to-red-600 flex items-center justify-center flex-shrink-0 relative overflow-hidden rounded-l-2xl">
                        {item.image ? (
                          <img 
                            src={item.image} 
                            alt={item.name} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                          />
                        ) : (
                          <span className="text-white text-2xl sm:text-4xl group-hover:scale-110 transition-transform duration-300">🍽️</span>
                        )}
                        
                        {/* Veg/Non-veg Indicator */}
                        {item.isVeg && (
                          <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm p-1 sm:p-1.5 rounded-lg shadow-sm">
                            <Leaf size={12} className="text-green-600 sm:w-4 sm:h-4" />
                          </div>
                        )}
                        
                        {/* Discount Badge */}
                        {itemDiscount && (
                          <div className="absolute top-2 right-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-1.5 py-1 sm:px-2.5 sm:py-1.5 rounded-full text-xs font-bold shadow-lg animate-bounce-in">
                            <Sparkles size={10} className="inline mr-0.5 sm:w-3 sm:h-3 sm:mr-1" />
                            <span className="hidden sm:inline">Save </span>₹{itemDiscount.itemSavings}
                          </div>
                        )}
                      </div>
                      
                      {/* Enhanced Item Details */}
                      <div className="item-details flex-1 p-3 sm:p-5 flex flex-col justify-between min-w-0">
                        <div className="flex-1">
                          <h3 className="text-base sm:text-xl font-bold text-gray-800 mb-1 sm:mb-2 group-hover:text-red-600 transition-colors leading-tight text-wrap">
                            {item.name}
                          </h3>
                          <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-4 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                          
                          {/* Enhanced Price with Discount */}
                          <div className="flex items-center flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-3">
                            {itemDiscount ? (
                              <>
                                <span className="text-lg sm:text-2xl font-bold text-red-600">₹{itemDiscount.discountedPrice}</span>
                                <span className="text-sm sm:text-base text-gray-500 line-through">₹{item.price}</span>
                                <div className="bg-green-100 text-green-700 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-semibold">
                                  {Math.round(((item.price - itemDiscount.discountedPrice) / item.price) * 100)}% OFF
                                </div>
                              </>
                            ) : (
                              <span className="text-lg sm:text-2xl font-bold text-gray-800">₹{item.price}</span>
                            )}
                          </div>
                          
                          {/* QR Exclusive Badge */}
                          {itemDiscount?.is_qr_exclusive && (
                            <div className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-semibold">
                              <Sparkles size={10} className="sm:w-3 sm:h-3" />
                              <span className="hidden sm:inline">QR </span>Exclusive
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Enhanced Add to Cart Button */}
                      <div className="flex items-center justify-center p-3 sm:p-5 min-w-[100px] sm:min-w-[120px]">
                        {quantity === 0 ? (
                          <button
                            onClick={() => addToCart(item)}
                            className="add-button bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-1 sm:gap-2 whitespace-nowrap text-sm sm:text-base"
                          >
                            <Plus size={16} className="sm:w-5 sm:h-5" />
                            Add
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl px-2 py-2 sm:px-3 sm:py-3 shadow-lg">
                            <button
                              onClick={() => updateQuantity(item._id, quantity - 1)}
                              className="p-1 sm:p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                              <Minus size={16} className="sm:w-5 sm:h-5" />
                            </button>
                            <span className="font-bold min-w-[20px] sm:min-w-[28px] text-center text-base sm:text-lg">{quantity}</span>
                            <button
                              onClick={() => updateQuantity(item._id, quantity + 1)}
                              className="p-1 sm:p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                              <Plus size={16} className="sm:w-5 sm:h-5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Enhanced Cart Summary */}
            {cart.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl z-10 cart-summary">
                <div className="max-w-4xl mx-auto p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="bg-red-100 p-2 sm:p-3 rounded-full flex-shrink-0">
                        <ShoppingCart size={20} className="text-red-600 sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm text-gray-600 font-medium">
                          {cart.length} item{cart.length !== 1 ? 's' : ''} added
                        </p>
                        {discountApplied ? (
                          <div className="flex items-center space-x-2 flex-wrap">
                            <p className="text-sm sm:text-lg text-gray-500 line-through">₹{total}</p>
                            <p className="text-lg sm:text-xl font-bold text-red-600">₹{finalTotal}</p>
                            <div className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                              <Sparkles size={10} />
                              <span className="hidden sm:inline">Saved </span>₹{discountApplied.savings}!
                            </div>
                          </div>
                        ) : (
                          <p className="text-lg sm:text-xl font-bold text-gray-800">₹{total}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCheckout(true)}
                      className="checkout-button bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-3 sm:px-8 sm:py-4 rounded-xl hover:from-red-600 hover:to-red-700 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center gap-2 whitespace-nowrap text-sm sm:text-base flex-shrink-0"
                    >
                      <span className="hidden sm:inline">Proceed to </span>Checkout
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Enhanced Checkout */
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-gradient-to-r from-red-500 to-red-600 p-3 rounded-full">
                <ShoppingCart size={24} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Checkout</h2>
            </div>
            
            {/* Enhanced Order Items */}
            <div className="mb-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>Your Order</span>
                <div className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs font-semibold">
                  {cart.length} item{cart.length !== 1 ? 's' : ''}
                </div>
              </h3>
              
              <div className="space-y-3 mb-4">
                {cart.map((item) => (
                  <div key={item._id} className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-red-400 to-red-500 rounded-lg flex items-center justify-center">
                        <span className="text-white text-lg">🍽️</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800">{item.name}</span>
                        <div className="text-sm text-gray-600">Qty: {item.quantity}</div>
                      </div>
                    </div>
                    <span className="font-bold text-gray-800">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between py-2 text-lg">
                  <span className="font-semibold text-gray-700">Subtotal</span>
                  <span className="font-bold text-gray-800">₹{total}</span>
                </div>
              </div>
              
              {/* Enhanced Discount Section */}
              {discountApplied ? (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mt-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-green-500 p-2 rounded-full">
                        <Sparkles size={16} className="text-white" />
                      </div>
                      <div>
                        <span className="font-bold text-green-800">Discount Applied!</span>
                        <div className="flex items-center gap-2 mt-1">
                          {selectedDiscount.is_qr_exclusive && (
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-semibold">QR Exclusive</span>
                          )}
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-semibold">✨ Auto Applied</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={removeDiscount}
                      className="text-red-600 hover:text-red-800 text-sm font-medium hover:bg-red-50 px-2 py-1 rounded transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="flex justify-between text-green-700 bg-white/50 rounded-lg p-3">
                    <span className="font-medium">Discount ({selectedDiscount.discount_type === 'percentage' ? `${selectedDiscount.discount_value}%` : `₹${selectedDiscount.discount_value}`})</span>
                    <span className="font-bold">-₹{discountApplied.discountAmount}</span>
                  </div>
                  <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                    <Sparkles size={14} />
                    Best available discount automatically applied!
                  </p>
                </div>
              ) : availableDiscounts.length > 0 && total > 0 && (
                <div className="mt-4">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="bg-blue-500 p-2 rounded-full">
                        <Tag size={16} className="text-white" />
                      </div>
                      <span className="font-bold text-blue-800">Smart Discounts</span>
                    </div>
                    <p className="text-sm text-blue-700 mb-4">
                      🤖 We automatically apply the best available discount for you! 
                      {availableDiscounts.length > 0 && total === 0 && " Add items to see available offers."}
                      {availableDiscounts.length > 0 && total > 0 && availableDiscounts.every(d => total < d.min_order_amount) && 
                        ` Add ₹${Math.min(...availableDiscounts.map(d => d.min_order_amount)) - total} more to unlock discounts.`}
                    </p>
                    
                    {/* Available Discounts */}
                    <div className="space-y-3">
                      <p className="text-sm text-blue-600 font-semibold">Available Offers:</p>
                      {availableDiscounts.map((discount) => (
                        <div key={discount.id} className="bg-white border border-blue-100 rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                {discount.is_qr_exclusive && (
                                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-semibold">QR Exclusive</span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-1">{discount.description}</p>
                              {discount.min_order_amount > 0 && (
                                <p className="text-xs text-gray-500">Min order: ₹{discount.min_order_amount}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-green-600 font-semibold bg-green-100 px-2 py-1 rounded-full">Auto-applies</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex justify-between py-3 text-xl font-bold text-red-600 bg-red-50 rounded-xl px-4">
                  <span>Total</span>
                  <span>₹{finalTotal}</span>
                </div>
              </div>
            </div>

            {/* Enhanced Customer Info */}
            <div className="mb-6 space-y-4">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span>Customer Information</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Optional</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Name</label>
                  <input
                    type="text"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    placeholder="Enter your name (optional)"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Phone</label>
                  <input
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    placeholder="Enter your phone number (optional)"
                  />
                </div>
              </div>
            </div>

            {/* Enhanced Payment Method */}
            <div className="mb-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>Payment Method</span>
              </h3>
              
              {paymentStatus === 'processing' && (
                <div className="text-center py-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                  <p className="text-gray-700 font-semibold text-lg">Processing payment...</p>
                  {paymentMethod === 'upi' && (
                    <p className="text-sm text-gray-600 mt-2">Please complete payment in your UPI app</p>
                  )}
                </div>
              )}
              
              {paymentStatus === 'pending' && (
                <div className="space-y-4">
                  <label className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer hover:border-red-300 transition-all transform hover:scale-[1.02] ${
                    paymentMethod === 'upi' ? 'border-red-500 bg-red-50 shadow-lg' : 'border-gray-200 bg-white'
                  }`}>
                    <input
                      type="radio"
                      value="upi"
                      checked={paymentMethod === 'upi'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-5 h-5 text-red-600"
                    />
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-full">
                      <Smartphone size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <span className="font-bold text-gray-800">UPI Payment</span>
                      <p className="text-sm text-gray-600">Pay using PhonePe, Paytm, GPay, etc.</p>
                    </div>
                    {paymentMethod === 'upi' && (
                      <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                        Selected
                      </div>
                    )}
                  </label>
                  
                  <label className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer hover:border-red-300 transition-all transform hover:scale-[1.02] ${
                    paymentMethod === 'cash' ? 'border-red-500 bg-red-50 shadow-lg' : 'border-gray-200 bg-white'
                  }`}>
                    <input
                      type="radio"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-5 h-5 text-red-600"
                    />
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-3 rounded-full">
                      <Banknote size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <span className="font-bold text-gray-800">Cash Payment</span>
                      <p className="text-sm text-gray-600">Pay with cash at the table</p>
                    </div>
                    {paymentMethod === 'cash' && (
                      <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                        Selected
                      </div>
                    )}
                  </label>
                </div>
              )}
            </div>

            {paymentStatus === 'pending' && (
              <div className="flex gap-4">
                <button
                  onClick={() => setShowCheckout(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-xl hover:bg-gray-200 font-semibold transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Menu
                </button>
                
                <button
                  onClick={handlePaymentClick}
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-4 rounded-xl hover:from-red-600 hover:to-red-700 flex items-center justify-center gap-3 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                >
                  {paymentMethod === 'upi' ? (
                    <>
                      <Smartphone size={20} />
                      Pay ₹{finalTotal} with UPI
                    </>
                  ) : (
                    <>
                      <Banknote size={20} />
                      Pay ₹{finalTotal} with Cash
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

