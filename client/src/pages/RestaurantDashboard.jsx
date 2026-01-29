import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, LogOut, X, Settings, Printer, BarChart3, User } from 'lucide-react';
import axios from 'axios';
import io from 'socket.io-client';
import FeatureGuard from '../components/FeatureGuard';
import { useFeatures } from '../context/FeatureContext';
import { trackRestaurantEvent } from '../utils/analytics';
import notificationSound from '../utils/notificationSound';
import { getWebSocketUrl, getEnvironmentInfo } from '../config/environment.js';
import { printCustomBill, getPrinterSettings, loadPrinterSettingsFromAPI } from '../utils/customBillGenerator.js';
import ThirdPartyOrderForm from '../components/ThirdPartyOrderForm';
import DiscountManager from '../components/DiscountManager';

export default function RestaurantDashboard() {
  const navigate = useNavigate();
  const { isFeatureEnabled } = useFeatures();
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [thirdPartyOrders, setThirdPartyOrders] = useState([]);
  const [thirdPartyStats, setThirdPartyStats] = useState(null);
  const [showThirdPartyForm, setShowThirdPartyForm] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    // Set default tab based on available features - Staff Order comes first
    if (isFeatureEnabled('staffOrders')) return 'Staff';
    if (isFeatureEnabled('thirdPartyOrders')) return 'third-party';
    if (isFeatureEnabled('deliveryOrders')) return 'delivery';
    if (isFeatureEnabled('orderManagement')) return 'dine-in';
    if (isFeatureEnabled('menuManagement')) return 'menu';
    if (isFeatureEnabled('qrCodeGeneration')) return 'qr';
    if (isFeatureEnabled('orderHistory')) return 'history';
    if (isFeatureEnabled('customerFeedback')) return 'feedback';
    return 'Staff'; // fallback to staff orders
  });

  // Effect to handle tab switching when features change
  useEffect(() => {
    // If current tab is disabled, switch to the first available tab
    if (activeTab === 'Staff' && !isFeatureEnabled('staffOrders')) {
      if (isFeatureEnabled('thirdPartyOrders')) {
        setActiveTab('third-party');
      } else if (isFeatureEnabled('deliveryOrders')) {
        setActiveTab('delivery');
      } else if (isFeatureEnabled('orderManagement')) {
        setActiveTab('dine-in');
      } else if (isFeatureEnabled('menuManagement')) {
        setActiveTab('menu');
      } else if (isFeatureEnabled('qrCodeGeneration')) {
        setActiveTab('qr');
      } else if (isFeatureEnabled('orderHistory')) {
        setActiveTab('history');
      } else if (isFeatureEnabled('customerFeedback')) {
        setActiveTab('feedback');
      }
    }
    // Handle other disabled tabs
    if (activeTab === 'third-party' && !isFeatureEnabled('thirdPartyOrders')) {
      setActiveTab('Staff');
    }
    if (activeTab === 'delivery' && !isFeatureEnabled('deliveryOrders')) {
      setActiveTab('Staff');
    }
    if (activeTab === 'feedback' && !isFeatureEnabled('customerFeedback')) {
      setActiveTab('Staff');
    }
  }, [activeTab, isFeatureEnabled]);
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [menuForm, setMenuForm] = useState({
    name: '', price: '', category: '', description: '', isVeg: true, image: ''
  });
  const [imageUploadMethod, setImageUploadMethod] = useState('url'); // 'url' or 'upload'
  const [imageFile, setImageFile] = useState(null);

  // Staff Order State
  const [receptionistOrder, setReceptionistOrder] = useState({
    customerName: '',
    customerPhone: '',
    orderType: 'takeaway', // 'takeaway', 'delivery', 'dine-in'
    deliveryAddress: '',
    tableNumber: '',
    items: [],
    specialInstructions: ''
  });
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  
  // State to store the last created order for printing
  const [lastCreatedOrder, setLastCreatedOrder] = useState(null);
  
  // Edit Order State (for completed staff orders only)
  const [editingOrder, setEditingOrder] = useState(null);
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);

  useEffect(() => {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      navigate('/restaurant-login');
      return;
    }

    fetchRestaurant(restaurantId);
    fetchOrders(restaurantId);
    fetchFeedback(restaurantId);
    fetchFeedbackStats(restaurantId);
    fetchThirdPartyOrders(restaurantId);
    
    // Sync printer settings from database
    loadPrinterSettingsFromAPI().catch(error => {
      console.log('Printer settings sync failed, using localStorage:', error.message);
    });

    // Connect to appropriate server WebSocket based on environment
    const socketUrl = getWebSocketUrl();
    
    console.log('🔌 WebSocket Configuration:', getEnvironmentInfo());
    
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      maxReconnectionAttempts: 5
    });
    
    socket.emit('join-restaurant', restaurantId);
    
    socket.on('connect', () => {
      console.log('Connected to WaitNot server');
      // Re-join restaurant room on reconnection
      socket.emit('join-restaurant', restaurantId);
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from WaitNot server');
    });
    
    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });
    
    socket.on('new-order', (order) => {
      setOrders(prev => [order, ...prev]);
      
      // Play notification sound for new order
      notificationSound.playNewOrderSound();
      
      // Track new order event
      trackRestaurantEvent('new_order_received', restaurantId, {
        order_id: order._id,
        order_type: order.orderType,
        total_amount: order.totalAmount,
        customer_name: order.customerName
      });
    });

    socket.on('order-updated', (updatedOrder) => {
      setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
    });

    return () => socket.disconnect();
  }, []);

  const fetchRestaurant = async (id) => {
    try {
      const { data } = await axios.get(`/api/restaurants/${id}`);
      setRestaurant(data);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    }
  };

  const fetchOrders = async (id) => {
    try {
      const { data } = await axios.get(`/api/orders/restaurant/${id}`);
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchFeedback = async (id) => {
    try {
      const { data } = await axios.get(`/api/feedback/restaurant/${id}`);
      setFeedback(data);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }
  };

  const fetchFeedbackStats = async (id) => {
    try {
      const { data } = await axios.get(`/api/feedback/restaurant/${id}/stats`);
      setFeedbackStats(data);
    } catch (error) {
      console.error('Error fetching feedback stats:', error);
    }
  };

  const fetchThirdPartyOrders = async (id) => {
    try {
      const { data } = await axios.get(`/api/third-party/restaurant/${id}`);
      setThirdPartyOrders(data.orders);
      setThirdPartyStats(data.analytics);
    } catch (error) {
      console.error('Error fetching third-party orders:', error);
    }
  };

  const handleFeedbackResponse = async (feedbackId, response) => {
    try {
      await axios.patch(`/api/feedback/${feedbackId}/response`, {
        restaurantResponse: response
      });
      
      // Refresh feedback
      const restaurantId = localStorage.getItem('restaurantId');
      await fetchFeedback(restaurantId);
      await fetchFeedbackStats(restaurantId);
      
      alert('✅ Response sent successfully!');
    } catch (error) {
      console.error('Error sending feedback response:', error);
      alert('❌ Failed to send response. Please try again.');
    }
  };

  const handleFeedbackStatusUpdate = async (feedbackId, status) => {
    try {
      await axios.patch(`/api/feedback/${feedbackId}/status`, { status });
      
      // Refresh feedback
      const restaurantId = localStorage.getItem('restaurantId');
      await fetchFeedback(restaurantId);
      await fetchFeedbackStats(restaurantId);
    } catch (error) {
      console.error('Error updating feedback status:', error);
      alert('❌ Failed to update feedback status. Please try again.');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.patch(`/api/orders/${orderId}/status`, { status });
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  // Use the getPrinterSettings from customBillGenerator utility

  // Notification Sound Settings
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(() => notificationSound.getEnabled());
  const [notificationVolume, setNotificationVolume] = useState(() => notificationSound.getVolume());

  const handleNotificationToggle = (enabled) => {
    setNotificationEnabled(enabled);
    notificationSound.setEnabled(enabled);
    
    // Track notification settings change
    trackRestaurantEvent('notification_settings_changed', restaurant?._id, {
      enabled: enabled,
      volume: notificationVolume
    });
  };

  const handleVolumeChange = (volume) => {
    setNotificationVolume(volume);
    notificationSound.setVolume(volume);
    
    // Track volume change
    trackRestaurantEvent('notification_volume_changed', restaurant?._id, {
      volume: volume
    });
  };

  const testNotificationSound = () => {
    const success = notificationSound.testSound();
    if (success) {
      alert('🔊 Test sound played successfully!');
    } else {
      alert('❌ Failed to play test sound. Please check your browser settings and ensure sound is enabled.');
    }
    
    // Track test sound
    trackRestaurantEvent('notification_sound_tested', restaurant?._id, {
      success: success
    });
  };

  // Check if table has unprinted items for kitchen
  const hasUnprintedKitchenItems = (tableOrders) => {
    return tableOrders.some(order => 
      order.items.some(item => !item.printed_to_kitchen)
    );
  };

  // Mark items as printed to kitchen
  const markItemsAsPrintedToKitchen = async (tableOrders) => {
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      
      // Update each order's items to mark them as printed to kitchen
      for (const order of tableOrders) {
        const updatedItems = order.items.map(item => ({
          ...item,
          printed_to_kitchen: true
        }));
        
        // Update the order in the backend
        await axios.patch(`/api/orders/${order._id}/items`, { items: updatedItems });
      }
      
      // Refresh orders to update UI
      await fetchOrders(restaurantId);
    } catch (error) {
      console.error('Error marking items as printed to kitchen:', error);
    }
  };

  const handleMenuSubmit = async (e) => {
    e.preventDefault();
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      if (editingItem) {
        await axios.put(`/api/restaurants/${restaurantId}/menu/${editingItem._id}`, menuForm);
      } else {
        await axios.post(`/api/restaurants/${restaurantId}/menu`, menuForm);
      }
      fetchRestaurant(restaurantId);
      setShowMenuForm(false);
      setEditingItem(null);
      setMenuForm({ name: '', price: '', category: '', description: '', isVeg: true });
    } catch (error) {
      console.error('Error saving menu item:', error);
    }
  };

  const deleteMenuItem = async (menuId) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      const response = await axios.delete(`/api/restaurants/${restaurantId}/menu/${menuId}`);
      
      // Handle the response message
      if (response.data.message) {
        if (response.data.message.includes('marked unavailable') || response.data.message.includes('order history')) {
          alert('⚠️ Menu item removed from availability\n\nThis item cannot be permanently deleted because it exists in order history. It has been marked as unavailable instead.');
        } else {
          alert('✅ Menu item deleted successfully');
        }
      }
      
      fetchRestaurant(restaurantId);
    } catch (error) {
      console.error('Error deleting menu item:', error);
      
      if (error.response?.data?.error) {
        if (error.response.data.type === 'constraint_violation') {
          alert('⚠️ Cannot Delete Menu Item\n\nThis item exists in order history and cannot be permanently deleted. It has been marked as unavailable instead.');
        } else {
          alert('❌ Error: ' + error.response.data.error);
        }
      } else {
        alert('❌ Failed to delete menu item. Please try again.');
      }
      
      // Refresh the restaurant data even if there was an error (in case of soft delete)
      const restaurantId = localStorage.getItem('restaurantId');
      fetchRestaurant(restaurantId);
    }
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check if it's an image file
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Check file size (max 2MB for images)
      if (file.size > 2 * 1024 * 1024) {
        alert('Image file is too large. Maximum size is 2MB.\n\nTip: Compress your image at tinypng.com or use a smaller image.');
        return;
      }
      
      setImageFile(file);
      
      // Convert to base64 and preview
      const reader = new FileReader();
      reader.onload = () => {
        setMenuForm({...menuForm, image: reader.result});
      };
      reader.readAsDataURL(file);
    }
  };

  const addTable = async () => {
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      const newTableCount = (restaurant.tables || 0) + 1;
      
      console.log('Adding table:', { restaurantId, newTableCount });
      
      const response = await axios.patch(`/api/restaurants/${restaurantId}/tables`, {
        tables: newTableCount
      });
      
      console.log('Table added response:', response.data);
      
      await fetchRestaurant(restaurantId);
      alert(`Table ${newTableCount} added successfully!`);
    } catch (error) {
      console.error('Error adding table:', error);
      console.error('Error response:', error.response?.data);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Failed to add table: ${errorMsg}`);
    }
  };

  const deleteTable = async (tableNum) => {
    if (!window.confirm(`Delete Table ${tableNum}? This will remove the last table and its QR code.`)) {
      return;
    }
    
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      const newTableCount = Math.max(0, (restaurant.tables || 0) - 1);
      
      console.log('Deleting table:', { restaurantId, tableNum, newTableCount });
      
      const response = await axios.patch(`/api/restaurants/${restaurantId}/tables`, {
        tables: newTableCount
      });
      
      console.log('Table deleted response:', response.data);
      
      await fetchRestaurant(restaurantId);
      alert('Table deleted successfully!');
    } catch (error) {
      console.error('Error deleting table:', error);
      console.error('Error response:', error.response?.data);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Failed to delete table: ${errorMsg}`);
    }
  };

  const downloadQRCode = async (tableNum, qrUrl) => {
    try {
      // Get the QR code image
      const imgElement = document.querySelector(`#qr-table-${tableNum} img`);
      if (!imgElement) {
        alert('QR code not found. Please try again.');
        return;
      }

      // Create a canvas to draw the QR code with labels
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size (larger for print quality)
      const qrSize = 400;
      const padding = 60;
      canvas.width = qrSize + (padding * 2);
      canvas.height = qrSize + (padding * 3);
      
      // Fill white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Load and draw QR code
      const qrImage = new Image();
      qrImage.crossOrigin = 'anonymous';
      
      qrImage.onload = () => {
        // Draw QR code in center
        ctx.drawImage(qrImage, padding, padding + 40, qrSize, qrSize);
        
        // Add restaurant name at top
        ctx.fillStyle = 'black';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(restaurant.name, canvas.width / 2, 40);
        
        // Add table number at bottom
        ctx.font = 'bold 36px Arial';
        ctx.fillText(`Table ${tableNum}`, canvas.width / 2, qrSize + padding + 80);
        
        // Add "Scan to Order" text
        ctx.font = '20px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText('Scan to Order', canvas.width / 2, qrSize + padding + 115);
        
        // Download the canvas as PNG
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `${restaurant.name.replace(/\s+/g, '-')}-Table-${tableNum}-QR.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        });
      };
      
      qrImage.onerror = () => {
        alert('Failed to load QR code. Please try again.');
      };
      
      // Use the API URL to generate QR code
      qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrUrl)}&margin=20`;
      
    } catch (error) {
      console.error('Error downloading QR code:', error);
      alert('Failed to download QR code. Please try again.');
    }
  };

  const clearTableAndSaveToHistory = async (tableNumber, tableOrders, totalAmount) => {
    console.log('🧹 Clear Table clicked:', { tableNumber, orderCount: tableOrders.length, totalAmount });
    
    // Create bill summary
    const allItems = {};
    tableOrders.forEach(order => {
      order.items.forEach(item => {
        const key = item.name;
        if (allItems[key]) {
          allItems[key].quantity += item.quantity;
          allItems[key].total += item.price * item.quantity;
        } else {
          allItems[key] = {
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity
          };
        }
      });
    });

    const billSummary = Object.values(allItems)
      .map(item => `${item.name} x ${item.quantity} = ₹${item.total}`)
      .join('\n');

    const confirmMessage = `Clear Table ${tableNumber} and Save to Order History?\n\n` +
      `Orders: ${tableOrders.length}\n` +
      `Customer: ${tableOrders[0].customerName}\n\n` +
      `Items:\n${billSummary}\n\n` +
      `TOTAL: ₹${totalAmount}\n\n` +
      `This will:\n` +
      `✓ Save all orders to Order History\n` +
      `✓ Clear table from Table Orders\n` +
      `✓ Ready table for next customer`;

    if (!window.confirm(confirmMessage)) {
      console.log('❌ Clear Table cancelled by user');
      return;
    }
    
    console.log('✅ Clearing table and saving to order history...');
    
    try {
      // Mark all orders as completed (saves to order history)
      for (const order of tableOrders) {
        if (order.status !== 'completed') {
          await updateOrderStatus(order._id, 'completed');
        }
      }

      // Clear the customer session for this table
      const sessionKey = `table_session_${restaurant._id}_${tableNumber}`;
      localStorage.removeItem(sessionKey);
      
      alert(`✅ Table Cleared Successfully!\n\nTable ${tableNumber}\nTotal: ₹${totalAmount}\n\nOrders saved to Order History.\nTable is ready for next customer.\n\nCustomer session cleared - next customer will need to enter their details.`);
      
      // Refresh orders
      const restaurantId = localStorage.getItem('restaurantId');
      await fetchOrders(restaurantId);
      console.log('✅ Table cleared and orders refreshed');
    } catch (error) {
      console.error('❌ Error clearing table:', error);
      alert(`Failed to clear table: ${error.response?.data?.error || error.message}`);
    }
  };

  const clearIndividualOrder = async (order) => {
    console.log('🧹 Clear Individual Order clicked:', { orderId: order._id, customer: order.customerName, total: order.totalAmount });
    
    const billSummary = order.items
      .map(item => `${item.name} x ${item.quantity} = ₹${item.price * item.quantity}`)
      .join('\n');

    const orderTypeText = order.orderType === 'delivery' ? 'Delivery' : 
                         order.orderType === 'takeaway' ? 'Takeaway' : 'Order';

    const confirmMessage = `Clear ${orderTypeText} Order and Save to Order History?\n\n` +
      `Customer: ${order.customerName}\n` +
      `Phone: ${order.customerPhone}\n` +
      `${order.deliveryAddress ? `Address: ${order.deliveryAddress}\n` : ''}` +
      `\nItems:\n${billSummary}\n\n` +
      `TOTAL: ₹${order.totalAmount}\n\n` +
      `This will:\n` +
      `✓ Save order to Order History\n` +
      `✓ Remove from active orders\n` +
      `✓ Mark as completed`;

    if (!window.confirm(confirmMessage)) {
      console.log('❌ Clear Order cancelled by user');
      return;
    }
    
    console.log('✅ Clearing individual order and saving to order history...');
    
    try {
      // Mark order as completed (saves to order history)
      if (order.status !== 'completed') {
        await updateOrderStatus(order._id, 'completed');
      }
      
      alert(`✅ Order Cleared Successfully!\n\n${orderTypeText} Order\nCustomer: ${order.customerName}\nTotal: ₹${order.totalAmount}\n\nOrder saved to Order History.`);
      
      // Refresh orders
      const restaurantId = localStorage.getItem('restaurantId');
      await fetchOrders(restaurantId);
      console.log('✅ Individual order cleared and orders refreshed');
    } catch (error) {
      console.error('❌ Error clearing individual order:', error);
      alert(`Failed to clear order: ${error.response?.data?.error || error.message}`);
    }
  };

  const printReceipt = (tableNumber, tableOrders, totalAmount) => {
    const settings = getPrinterSettings();
    
    // Try to use custom bill first if enabled
    if (settings.billCustomization.enableCustomBill) {
      // Create a combined order object for custom bill printing
      const combinedOrder = {
        _id: `table-${tableNumber}-${Date.now()}`,
        customerName: tableOrders[0]?.customerName || 'Table Customer',
        customerPhone: tableOrders[0]?.customerPhone || '',
        orderType: 'dine-in',
        tableNumber: tableNumber,
        totalAmount: totalAmount,
        createdAt: new Date().toISOString(),
        items: []
      };
      
      // Combine all items from all orders
      const allItems = {};
      tableOrders.forEach(order => {
        order.items.forEach(item => {
          const key = item.name;
          if (allItems[key]) {
            allItems[key].quantity += item.quantity;
            allItems[key].total += item.price * item.quantity;
          } else {
            allItems[key] = {
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              total: item.price * item.quantity
            };
          }
        });
      });
      
      // Convert to items array for custom bill
      combinedOrder.items = Object.values(allItems);
      
      const customPrintSuccess = printCustomBill(combinedOrder, restaurant, settings.billCustomization);
      if (customPrintSuccess) {
        return; // Custom bill printed successfully
      }
    }
    
    // Enhanced thermal printer optimized bill format
    // Create bill summary
    const allItems = {};
    tableOrders.forEach(order => {
      order.items.forEach(item => {
        const key = item.name;
        if (allItems[key]) {
          allItems[key].quantity += item.quantity;
          allItems[key].total += item.price * item.quantity;
        } else {
          allItems[key] = {
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity
          };
        }
      });
    });

    const firstOrder = tableOrders[0];
    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-IN');
    const timeStr = currentDate.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Create receipt HTML with enhanced thermal printer styling
    const receiptHTML = `
      <div id="receipt-content" style="
        width: 80mm;
        max-width: 302px;
        font-family: 'Courier New', 'Lucida Console', monospace;
        font-size: 14px;
        font-weight: bold;
        line-height: 1.3;
        color: #000;
        background: white;
        padding: 8px;
        margin: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      ">
        <!-- Restaurant Header -->
        <div style="text-align: center; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px;">
          <div style="font-size: 18px; font-weight: 900; margin-bottom: 4px; letter-spacing: 1px;">
            ${restaurant.name.toUpperCase()}
          </div>
          <div style="font-size: 12px; font-weight: bold;">
            RESTAURANT RECEIPT
          </div>
        </div>

        <!-- Order Info -->
        <div style="margin-bottom: 12px; font-size: 12px; font-weight: bold;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>TABLE:</span>
            <span style="font-weight: 900; font-size: 14px;">${tableNumber}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>ORDER ID:</span>
            <span>${orderId}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>DATE:</span>
            <span>${dateStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>TIME:</span>
            <span>${timeStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>CUSTOMER:</span>
            <span>${firstOrder.customerName}</span>
          </div>
        </div>

        <!-- Items Header -->
        <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 12px;">
            <span style="width: 55%;">ITEM</span>
            <span style="width: 15%; text-align: center;">QTY</span>
            <span style="width: 30%; text-align: right;">AMOUNT</span>
          </div>
        </div>

        <!-- Items List -->
        <div style="margin-bottom: 12px;">
          ${Object.values(allItems).map(item => `
            <div style="margin-bottom: 6px; font-size: 12px; font-weight: bold;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="width: 55%; word-wrap: break-word;">${item.name}</span>
                <span style="width: 15%; text-align: center;">${item.quantity}</span>
                <span style="width: 30%; text-align: right;">₹${item.total}</span>
              </div>
              <div style="font-size: 10px; color: #333; margin-left: 0; font-weight: normal;">
                @ ₹${item.price} each
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Total Section -->
        <div style="border-top: 2px solid #000; padding-top: 8px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-bottom: 4px;">
            <span>SUBTOTAL:</span>
            <span>₹${totalAmount}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; border-top: 2px solid #000; padding-top: 6px; background: #f0f0f0; padding: 6px 4px;">
            <span>TOTAL:</span>
            <span>₹${totalAmount}</span>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 11px; border-top: 2px solid #000; padding-top: 8px; font-weight: bold;">
          <div style="margin-bottom: 4px;">THANK YOU FOR DINING WITH US!</div>
          <div style="margin-bottom: 4px;">PLEASE VISIT AGAIN</div>
          <div style="margin-bottom: 8px; font-size: 14px;">★★★★★</div>
          <div style="font-size: 9px; color: #333; font-weight: normal;">
            Printed: ${dateStr} ${timeStr}
          </div>
        </div>
      </div>
    `;

    // Create a new window for printing with enhanced print styles
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - Table ${tableNumber}</title>
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
          ${receiptHTML}
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setTimeout(() => {
            printWindow.close();
          }, 250);
        }, 500);
      };
    } else {
      alert('Please allow popups to print receipts');
    }
  };

  const printIndividualReceipt = (order) => {
    const settings = getPrinterSettings();
    
    // Try to use custom bill first
    if (settings.billCustomization.enableCustomBill) {
      const customPrintSuccess = printCustomBill(order, restaurant, settings.billCustomization);
      if (customPrintSuccess) {
        return; // Custom bill printed successfully
      }
    }
    
    // Enhanced thermal printer optimized bill format
    const orderId = `ORD-${order._id.slice(-6).toUpperCase()}`;
    const currentDate = new Date(order.createdAt);
    const dateStr = currentDate.toLocaleDateString('en-IN');
    const timeStr = currentDate.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Create receipt HTML with enhanced thermal printer styling
    const receiptHTML = `
      <div id="receipt-content" style="
        width: 80mm;
        max-width: 302px;
        font-family: 'Courier New', 'Lucida Console', monospace;
        font-size: 14px;
        font-weight: bold;
        line-height: 1.3;
        color: #000;
        background: white;
        padding: 8px;
        margin: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      ">
        <!-- Restaurant Header -->
        <div style="text-align: center; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px;">
          <div style="font-size: 18px; font-weight: 900; margin-bottom: 4px; letter-spacing: 1px;">
            ${restaurant.name.toUpperCase()}
          </div>
          <div style="font-size: 12px; font-weight: bold;">
            ${order.orderType === 'delivery' ? 'DELIVERY RECEIPT' : 'DINE-IN RECEIPT'}
          </div>
        </div>

        <!-- Order Info -->
        <div style="margin-bottom: 12px; font-size: 12px; font-weight: bold;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>ORDER ID:</span>
            <span>${orderId}</span>
          </div>
          ${order.orderType === 'dine-in' ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>TABLE:</span>
            <span style="font-weight: 900;">${order.tableNumber}</span>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>DATE:</span>
            <span>${dateStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>TIME:</span>
            <span>${timeStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>CUSTOMER:</span>
            <span>${order.customerName}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>PHONE:</span>
            <span>${order.customerPhone}</span>
          </div>
          ${order.deliveryAddress ? `
          <div style="margin-top: 6px; font-size: 11px; font-weight: bold;">
            <div>DELIVERY ADDRESS:</div>
            <div style="margin-left: 8px; word-wrap: break-word; margin-top: 2px;">${order.deliveryAddress}</div>
          </div>
          ` : ''}
        </div>

        <!-- Items Header -->
        <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 12px;">
            <span style="width: 55%;">ITEM</span>
            <span style="width: 15%; text-align: center;">QTY</span>
            <span style="width: 30%; text-align: right;">AMOUNT</span>
          </div>
        </div>

        <!-- Items List -->
        <div style="margin-bottom: 12px;">
          ${order.items.map(item => `
            <div style="margin-bottom: 6px; font-size: 12px; font-weight: bold;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="width: 55%; word-wrap: break-word;">${item.name}</span>
                <span style="width: 15%; text-align: center;">${item.quantity}</span>
                <span style="width: 30%; text-align: right;">₹${item.price * item.quantity}</span>
              </div>
              <div style="font-size: 10px; color: #333; margin-left: 0; font-weight: normal;">
                @ ₹${item.price} each
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Total Section -->
        <div style="border-top: 2px solid #000; padding-top: 8px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-bottom: 4px;">
            <span>SUBTOTAL:</span>
            <span>₹${order.totalAmount}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; border-top: 2px solid #000; padding-top: 6px; background: #f0f0f0; padding: 6px 4px;">
            <span>TOTAL:</span>
            <span>₹${order.totalAmount}</span>
          </div>
        </div>

        <!-- Status -->
        <div style="text-align: center; margin-bottom: 12px; font-size: 12px;">
          <div style="background: #000; color: white; padding: 6px; font-weight: bold;">
            STATUS: ${order.status.toUpperCase()}
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 11px; border-top: 2px solid #000; padding-top: 8px; font-weight: bold;">
          <div style="margin-bottom: 4px;">THANK YOU FOR ${order.orderType === 'delivery' ? 'ORDERING' : 'DINING'} WITH US!</div>
          <div style="margin-bottom: 4px;">PLEASE VISIT AGAIN</div>
          <div style="margin-bottom: 8px; font-size: 14px;">★★★★★</div>
          <div style="font-size: 9px; color: #333; font-weight: normal;">
            Printed: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    `;

    // Create a new window for printing with enhanced print styles
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - Order ${orderId}</title>
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
          ${receiptHTML}
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setTimeout(() => {
            printWindow.close();
          }, 250);
        }, 500);
      };
    } else {
      alert('Please allow popups to print receipts');
    }
  };

  const printKitchenOrder = (tableNumber, tableOrders) => {
    const settings = getPrinterSettings();
    
    if (!settings.enableKitchenPrinting) {
      alert('Kitchen printing is disabled in settings');
      return;
    }

    // Get only unprinted items
    const unprintedItems = [];
    tableOrders.forEach(order => {
      order.items.forEach(item => {
        if (!item.printed_to_kitchen) {
          unprintedItems.push({
            ...item,
            orderId: order._id,
            customerName: order.customerName,
            orderTime: order.createdAt
          });
        }
      });
    });

    if (unprintedItems.length === 0) {
      alert('No new items to print to kitchen');
      return;
    }

    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-IN');
    const timeStr = currentDate.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    const receiptWidth = settings.kitchenReceiptSize === '58mm' ? '58mm' : '80mm';
    const maxWidth = settings.kitchenReceiptSize === '58mm' ? '220px' : '302px';

    // Create KOT (Kitchen Order Ticket) HTML
    const kotHTML = `
      <div id="kot-content" style="
        width: ${receiptWidth};
        max-width: ${maxWidth};
        font-family: 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.2;
        color: black;
        background: white;
        padding: 10px;
        margin: 0;
      ">
        <!-- KOT Header -->
        <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px;">
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">
            KITCHEN ORDER (KOT)
          </div>
          <div style="font-size: 14px; font-weight: bold;">
            TABLE ${tableNumber}
          </div>
        </div>

        <!-- Order Info -->
        <div style="margin-bottom: 15px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Date:</strong></span>
            <span>${dateStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Time:</strong></span>
            <span>${timeStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Customer:</strong></span>
            <span>${unprintedItems[0].customerName}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span><strong>Items:</strong></span>
            <span>${unprintedItems.length} item(s)</span>
          </div>
        </div>

        <!-- Items Header -->
        <div style="border-top: 2px solid #000; border-bottom: 1px solid #000; padding: 5px 0; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px;">
            <span style="width: 70%;">ITEM</span>
            <span style="width: 30%; text-align: center;">QTY</span>
          </div>
        </div>

        <!-- Items List (NO PRICES) -->
        <div style="margin-bottom: 20px;">
          ${unprintedItems.map(item => `
            <div style="margin-bottom: 12px; font-size: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span style="width: 70%; word-wrap: break-word;">${item.name}</span>
                <span style="width: 30%; text-align: center; font-size: 16px; font-weight: bold;">${item.quantity}</span>
              </div>
              ${item.description ? `
                <div style="font-size: 10px; color: #666; margin-top: 2px; font-style: italic;">
                  ${item.description}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <!-- Instructions -->
        <div style="border-top: 2px solid #000; padding-top: 10px; margin-bottom: 15px; text-align: center;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">
            PREPARE ITEMS ABOVE
          </div>
          <div style="font-size: 10px; color: #666;">
            Check off items as completed
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px;">
          <div style="margin-bottom: 5px;">Kitchen Copy</div>
          <div style="font-size: 9px; color: #666;">
            Printed: ${dateStr} ${timeStr}
          </div>
        </div>
      </div>
    `;

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>KOT - Table ${tableNumber}</title>
          <style>
            @media print {
              @page {
                size: ${receiptWidth} auto;
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
          ${kotHTML}
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
          
          // Mark items as printed to kitchen after successful print
          markItemsAsPrintedToKitchen(tableOrders);
        }, 250);
      };
    } else {
      alert('Please allow popups to print kitchen orders');
    }
  };

  const printKitchenOrderIndividual = (order) => {
    const settings = getPrinterSettings();
    
    if (!settings.enableKitchenPrinting) {
      alert('Kitchen printing is disabled in settings');
      return;
    }

    // Check if order has unprinted items
    const unprintedItems = order.items.filter(item => !item.printed_to_kitchen);
    
    if (unprintedItems.length === 0) {
      alert('No new items to print to kitchen');
      return;
    }

    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-IN');
    const timeStr = currentDate.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    const receiptWidth = settings.kitchenReceiptSize === '58mm' ? '58mm' : '80mm';
    const maxWidth = settings.kitchenReceiptSize === '58mm' ? '220px' : '302px';

    // Create KOT (Kitchen Order Ticket) HTML
    const kotHTML = `
      <div id="kot-content" style="
        width: ${receiptWidth};
        max-width: ${maxWidth};
        font-family: 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.2;
        color: black;
        background: white;
        padding: 10px;
        margin: 0;
      ">
        <!-- KOT Header -->
        <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px;">
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">
            KITCHEN ORDER (KOT)
          </div>
          <div style="font-size: 14px; font-weight: bold;">
            ${order.orderType === 'delivery' ? 'DELIVERY ORDER' : `TABLE ${order.tableNumber}`}
          </div>
        </div>

        <!-- Order Info -->
        <div style="margin-bottom: 15px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Order ID:</strong></span>
            <span>${order._id.slice(-6).toUpperCase()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Date:</strong></span>
            <span>${dateStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Time:</strong></span>
            <span>${timeStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Customer:</strong></span>
            <span>${order.customerName}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span><strong>Items:</strong></span>
            <span>${unprintedItems.length} item(s)</span>
          </div>
        </div>

        <!-- Items Header -->
        <div style="border-top: 2px solid #000; border-bottom: 1px solid #000; padding: 5px 0; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px;">
            <span style="width: 70%;">ITEM</span>
            <span style="width: 30%; text-align: center;">QTY</span>
          </div>
        </div>

        <!-- Items List (NO PRICES) -->
        <div style="margin-bottom: 20px;">
          ${unprintedItems.map(item => `
            <div style="margin-bottom: 12px; font-size: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span style="width: 70%; word-wrap: break-word;">${item.name}</span>
                <span style="width: 30%; text-align: center; font-size: 16px; font-weight: bold;">${item.quantity}</span>
              </div>
              ${item.description ? `
                <div style="font-size: 10px; color: #666; margin-top: 2px; font-style: italic;">
                  ${item.description}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <!-- Instructions -->
        <div style="border-top: 2px solid #000; padding-top: 10px; margin-bottom: 15px; text-align: center;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">
            PREPARE ITEMS ABOVE
          </div>
          <div style="font-size: 10px; color: #666;">
            ${order.orderType === 'delivery' ? 'For delivery preparation' : 'Check off items as completed'}
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px;">
          <div style="margin-bottom: 5px;">Kitchen Copy</div>
          <div style="font-size: 9px; color: #666;">
            Printed: ${dateStr} ${timeStr}
          </div>
        </div>
      </div>
    `;

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>KOT - Order ${order._id.slice(-6).toUpperCase()}</title>
          <style>
            @media print {
              @page {
                size: ${receiptWidth} auto;
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
          ${kotHTML}
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
          
          // Mark items as printed to kitchen after successful print
          markItemsAsPrintedToKitchen([order]);
        }, 250);
      };
    } else {
      alert('Please allow popups to print kitchen orders');
    }
  };

  // Staff Order Functions
  const updateReceptionistOrderItem = (item, quantityChange) => {
    setReceptionistOrder(prevOrder => {
      const existingItemIndex = prevOrder.items.findIndex(orderItem => orderItem._id === item._id);
      let newItems = [...prevOrder.items];

      if (existingItemIndex >= 0) {
        // Item exists, update quantity
        const newQuantity = newItems[existingItemIndex].quantity + quantityChange;
        if (newQuantity <= 0) {
          // Remove item if quantity becomes 0 or less
          newItems.splice(existingItemIndex, 1);
        } else {
          newItems[existingItemIndex].quantity = newQuantity;
        }
      } else if (quantityChange > 0) {
        // Add new item
        newItems.push({
          _id: item._id,
          name: item.name,
          price: item.price,
          category: item.category,
          quantity: quantityChange
        });
      }

      return { ...prevOrder, items: newItems };
    });
  };

  // Print KOT without saving order
  const printStaffKOTOnly = () => {
    // Validate required fields - only items are required now
    if (receptionistOrder.items.length === 0) {
      alert('Please select at least one item.');
      return;
    }

    if (receptionistOrder.orderType === 'delivery' && !receptionistOrder.deliveryAddress) {
      alert('Please enter delivery address for delivery orders.');
      return;
    }

    if (receptionistOrder.orderType === 'dine-in' && !receptionistOrder.tableNumber) {
      alert('Please select a table number for dine-in orders.');
      return;
    }

    // Calculate total amount
    const totalAmount = receptionistOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Create temporary order object for printing
    const tempOrder = {
      _id: `TEMP-${Date.now()}`,
      customerName: receptionistOrder.customerName || 'Guest Customer',
      customerPhone: receptionistOrder.customerPhone || '',
      orderType: receptionistOrder.orderType,
      items: receptionistOrder.items,
      totalAmount,
      specialInstructions: receptionistOrder.specialInstructions,
      source: 'staff',
      deliveryAddress: receptionistOrder.deliveryAddress,
      tableNumber: receptionistOrder.tableNumber ? parseInt(receptionistOrder.tableNumber) : null,
      createdAt: new Date().toISOString()
    };

    // Print KOT
    printStaffKOT(tempOrder);
  };

  // Print Customer Bill without saving order
  const printStaffBillOnly = () => {
    // Validate required fields - only items are required now
    if (receptionistOrder.items.length === 0) {
      alert('Please select at least one item.');
      return;
    }

    if (receptionistOrder.orderType === 'delivery' && !receptionistOrder.deliveryAddress) {
      alert('Please enter delivery address for delivery orders.');
      return;
    }

    if (receptionistOrder.orderType === 'dine-in' && !receptionistOrder.tableNumber) {
      alert('Please select a table number for dine-in orders.');
      return;
    }

    // Calculate total amount
    const totalAmount = receptionistOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Create temporary order object for printing
    const tempOrder = {
      _id: `TEMP-${Date.now()}`,
      customerName: receptionistOrder.customerName || 'Guest Customer',
      customerPhone: receptionistOrder.customerPhone || '',
      orderType: receptionistOrder.orderType,
      items: receptionistOrder.items,
      totalAmount,
      specialInstructions: receptionistOrder.specialInstructions,
      source: 'staff',
      deliveryAddress: receptionistOrder.deliveryAddress,
      tableNumber: receptionistOrder.tableNumber ? parseInt(receptionistOrder.tableNumber) : null,
      createdAt: new Date().toISOString()
    };

    // Print Customer Bill
    printStaffCustomerBill(tempOrder);
  };

  const clearReceptionistOrder = async () => {
    // Check if there's an order to save - only check for items now
    if (receptionistOrder.items.length > 0) {
      const customerName = receptionistOrder.customerName || 'Guest Customer';
      const customerPhone = receptionistOrder.customerPhone || 'No phone provided';
      
      const confirmSave = window.confirm(
        `Save this order to order history?\n\n` +
        `Customer: ${customerName}\n` +
        `Phone: ${customerPhone}\n` +
        `Items: ${receptionistOrder.items.length}\n` +
        `Total: ₹${receptionistOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)}\n\n` +
        `Click "OK" to save and clear\n` +
        `Click "Cancel" to just clear without saving`
      );

      if (confirmSave) {
        try {
          const restaurantId = localStorage.getItem('restaurantId');
          console.log('🔄 Saving Staff order...', { restaurantId, receptionistOrder });
          
          // Validate required fields before saving
          if (receptionistOrder.orderType === 'delivery' && !receptionistOrder.deliveryAddress) {
            alert('Please enter delivery address before saving delivery orders.');
            return;
          }

          if (receptionistOrder.orderType === 'dine-in' && !receptionistOrder.tableNumber) {
            alert('Please select a table number before saving dine-in orders.');
            return;
          }

          // Calculate total amount
          const totalAmount = receptionistOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

          // Prepare order data
          const orderData = {
            restaurantId,
            customerName: receptionistOrder.customerName || 'Guest Customer',
            customerPhone: receptionistOrder.customerPhone || '',
            orderType: receptionistOrder.orderType,
            items: receptionistOrder.items,
            totalAmount,
            specialInstructions: receptionistOrder.specialInstructions,
            source: 'staff', // Mark as Staff order
            status: 'pending', // Set as pending so it appears in Table Orders until final bill
            ...(receptionistOrder.orderType === 'delivery' && { deliveryAddress: receptionistOrder.deliveryAddress }),
            ...(receptionistOrder.orderType === 'dine-in' && { tableNumber: parseInt(receptionistOrder.tableNumber) })
          };

          console.log('📤 Sending order data:', orderData);

          // Submit order
          const response = await axios.post('/api/orders', orderData);
          const createdOrder = response.data;

          console.log('✅ Order saved successfully:', createdOrder);

          // Track analytics
          trackRestaurantEvent('staff_order_saved', {
            orderType: receptionistOrder.orderType,
            itemCount: receptionistOrder.items.length,
            totalAmount
          });

          // Show success message
          alert(
            `✅ Order saved successfully!\n\n` +
            `Order ID: ${createdOrder._id}\n` +
            `Customer: ${customerName}\n` +
            `Total: ₹${totalAmount}\n\n` +
            `Order has been added to order history.`
          );
          
          // Refresh orders to show in delivery/dine-in tabs and history
          console.log('🔄 Refreshing orders...');
          await fetchOrders(restaurantId);
          console.log('✅ Orders refreshed');

        } catch (error) {
          console.error('❌ Error saving Staff order:', error);
          console.error('Error details:', error.response?.data);
          alert(`❌ Failed to save order: ${error.response?.data?.error || error.message}`);
          return; // Don't clear the form if save failed
        }
      }
    }

    // Clear the form
    console.log('🧹 Clearing Staff order form');
    setReceptionistOrder({
      customerName: '',
      customerPhone: '',
      orderType: 'takeaway',
      deliveryAddress: '',
      tableNumber: '',
      items: [],
      specialInstructions: ''
    });
    setSelectedCategory('all');
    setStaffSearchQuery(''); // Clear search query
  };

  // Print KOT (Kitchen Order Ticket) for Staff orders
  const printStaffKOT = (order) => {
    const settings = getPrinterSettings();
    
    const receiptWidth = settings.receiptWidth || '80mm';
    const maxWidth = receiptWidth === '58mm' ? '200px' : '300px';
    
    const dateStr = new Date().toLocaleDateString('en-IN');
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    
    const kotHTML = `
      <div id="kot-content" style="
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
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px;">
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
            ${restaurant.name.toUpperCase()}
          </div>
          <div style="font-size: 14px; font-weight: bold;">
            === KITCHEN ORDER TICKET ===
          </div>
          <div style="font-size: 10px; margin-top: 5px;">
            👥 Staff ORDER
          </div>
        </div>

        <!-- Order Info -->
        <div style="margin-bottom: 15px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Order ID:</strong></span>
            <span>${order._id.slice(-8).toUpperCase()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Date:</strong></span>
            <span>${dateStr} ${timeStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Customer:</strong></span>
            <span>${order.customerName}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Phone:</strong></span>
            <span>${order.customerPhone}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Type:</strong></span>
            <span>${order.orderType.toUpperCase()}</span>
          </div>
          ${order.tableNumber ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Table:</strong></span>
            <span><strong>TABLE ${order.tableNumber}</strong></span>
          </div>
          ` : ''}
          ${order.deliveryAddress ? `
          <div style="margin-bottom: 2px;">
            <strong>Address:</strong>
            <div style="margin-left: 10px; word-wrap: break-word;">${order.deliveryAddress}</div>
          </div>
          ` : ''}
        </div>

        <!-- Items -->
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin-bottom: 15px;">
          <div style="font-weight: bold; margin-bottom: 8px; text-align: center;">ITEMS TO PREPARE</div>
          ${order.items.map(item => `
            <div style="margin-bottom: 8px; padding: 5px; background: #f5f5f5;">
              <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span>${item.name}</span>
                <span>x ${item.quantity}</span>
              </div>
              <div style="font-size: 10px; color: #666; margin-top: 2px;">
                Category: ${item.category}
              </div>
            </div>
          `).join('')}
        </div>

        ${order.specialInstructions ? `
        <!-- Special Instructions -->
        <div style="margin-bottom: 15px; padding: 8px; border: 1px solid #000; background: #fffacd;">
          <div style="font-weight: bold; margin-bottom: 5px;">⚠️ SPECIAL INSTRUCTIONS:</div>
          <div style="font-size: 11px;">${order.specialInstructions}</div>
        </div>
        ` : ''}

        <!-- Footer -->
        <div style="text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px;">
          <div style="margin-bottom: 5px;">🍳 PREPARE WITH CARE 🍳</div>
          <div style="margin-bottom: 10px;">Staff Order - Priority Service</div>
          <div style="font-size: 9px; color: #666;">
            Printed: ${dateStr} ${timeStr}
          </div>
        </div>
      </div>
    `;

    // Create and print
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>KOT - ${order.customerName}</title>
          <style>
            @media print {
              @page {
                size: ${receiptWidth} auto;
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
          ${kotHTML}
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
    } else {
      alert('Please allow popups to print KOT');
    }
  };

  // Print Customer Bill for Staff orders
  const printStaffCustomerBill = (order) => {
    const settings = getPrinterSettings();
    
    // Try to use custom bill first
    if (settings.billCustomization.enableCustomBill) {
      const customPrintSuccess = printCustomBill(order, restaurant, settings.billCustomization);
      if (customPrintSuccess) {
        return; // Custom bill printed successfully
      }
    }
    
    // Fallback to default bill format
    const receiptWidth = settings.receiptWidth || '80mm';
    const maxWidth = receiptWidth === '58mm' ? '200px' : '300px';
    
    const dateStr = new Date().toLocaleDateString('en-IN');
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    
    const billHTML = `
      <div id="bill-content" style="
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
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px;">
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
            ${restaurant.name.toUpperCase()}
          </div>
          <div style="font-size: 10px;">
            👥 Staff Order Receipt
          </div>
        </div>

        <!-- Order Info -->
        <div style="margin-bottom: 15px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Order ID:</span>
            <span>${order._id.slice(-8).toUpperCase()}</span>
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
            <span>${order.orderType.toUpperCase()}</span>
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
            <div style="margin-left: 10px; word-wrap: break-word;">${order.deliveryAddress}</div>
          </div>
          ` : ''}
        </div>

        <!-- Items -->
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px;">
            <span>ITEM</span>
            <span>QTY</span>
            <span>RATE</span>
            <span>AMOUNT</span>
          </div>
          ${order.items.map(item => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px;">
              <span style="flex: 2;">${item.name}</span>
              <span style="width: 30px; text-align: center;">${item.quantity}</span>
              <span style="width: 50px; text-align: right;">₹${item.price}</span>
              <span style="width: 60px; text-align: right;">₹${item.price * item.quantity}</span>
            </div>
          `).join('')}
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
          <div>${order.specialInstructions}</div>
        </div>
        ` : ''}

        <!-- Footer -->
        <div style="text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px;">
          <div style="margin-bottom: 10px;">Thank you for your order!</div>
          <div style="margin-bottom: 10px;">★★★★★</div>
          <div style="font-size: 9px; color: #666;">
            Printed: ${dateStr} ${timeStr}
          </div>
        </div>
      </div>
    `;

    // Create and print
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bill - ${order.customerName}</title>
          <style>
            @media print {
              @page {
                size: ${receiptWidth} auto;
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
          ${billHTML}
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
    } else {
      alert('Please allow popups to print customer bill');
    }
  };

  // Edit Order Functions (for completed staff orders only)
  const openEditOrderModal = (order) => {
    setEditingOrder({
      ...order,
      items: [...order.items] // Create a copy of items array
    });
    setShowEditOrderModal(true);
  };

  const closeEditOrderModal = () => {
    setEditingOrder(null);
    setShowEditOrderModal(false);
  };

  const updateEditOrderItem = (itemIndex, field, value) => {
    setEditingOrder(prev => ({
      ...prev,
      items: prev.items.map((item, index) => 
        index === itemIndex ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeEditOrderItem = (itemIndex) => {
    setEditingOrder(prev => ({
      ...prev,
      items: prev.items.filter((_, index) => index !== itemIndex)
    }));
  };

  const addItemToEditOrder = (menuItem) => {
    setEditingOrder(prev => {
      const existingItemIndex = prev.items.findIndex(item => item.menuItemId === menuItem._id);
      
      if (existingItemIndex >= 0) {
        // Item exists, increase quantity
        return {
          ...prev,
          items: prev.items.map((item, index) => 
            index === existingItemIndex 
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        };
      } else {
        // New item, add to order
        return {
          ...prev,
          items: [...prev.items, {
            menuItemId: menuItem._id,
            name: menuItem.name,
            price: menuItem.price,
            quantity: 1
          }]
        };
      }
    });
  };

  const saveEditedOrder = async () => {
    try {
      if (!editingOrder.items.length) {
        alert('❌ Order must have at least one item');
        return;
      }

      const totalAmount = editingOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const updatedOrderData = {
        customerName: editingOrder.customerName,
        customerPhone: editingOrder.customerPhone,
        orderType: editingOrder.orderType,
        deliveryAddress: editingOrder.deliveryAddress,
        tableNumber: editingOrder.tableNumber,
        items: editingOrder.items,
        totalAmount,
        specialInstructions: editingOrder.specialInstructions
      };

      console.log('🔄 Updating order...', { orderId: editingOrder._id, updatedOrderData });

      const response = await axios.put(`/api/orders/${editingOrder._id}`, updatedOrderData);
      
      console.log('✅ Order updated successfully:', response.data);
      
      // Refresh orders
      const restaurantId = localStorage.getItem('restaurantId');
      await fetchOrders(restaurantId);
      
      // Track analytics
      trackRestaurantEvent('order_edited', {
        orderId: editingOrder._id,
        itemCount: editingOrder.items.length,
        totalAmount,
        orderSource: editingOrder.source || 'qr'
      });
      
      alert('✅ Order updated successfully!');
      closeEditOrderModal();
      
    } catch (error) {
      console.error('❌ Error updating order:', error);
      alert(`❌ Failed to update order: ${error.response?.data?.error || error.message}`);
    }
  };

  const logout = () => {
    localStorage.removeItem('restaurantToken');
    localStorage.removeItem('restaurantId');
    localStorage.removeItem('restaurantData');
    navigate('/restaurant-login');
  };

  if (!restaurant) return <div className="text-center py-12">Loading...</div>;

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    preparing: 'bg-blue-100 text-blue-800',
    'out-for-delivery': 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800'
  };

  // Filter orders based on type (ensure orders are valid and not duplicated)
  const validOrders = orders.filter(order => order && order._id && order.orderType);
  
  const deliveryOrders = validOrders.filter(order => 
    order.orderType === 'delivery' || 
    (order.source === 'staff' && (order.orderType === 'delivery' || order.orderType === 'takeaway'))
  );
  const dineInOrders = validOrders.filter(order => 
    order.orderType === 'dine-in' || 
    (order.source === 'staff' && order.orderType === 'dine-in')
  );

  // Count only active orders for badges (exclude completed orders)
  const activeDeliveryOrders = deliveryOrders.filter(order => order.status !== 'completed');
  const activeDineInOrders = dineInOrders.filter(order => order.status !== 'completed');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md p-3 sm:p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-primary truncate">{restaurant.name}</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <FeatureGuard feature="profileEdit">
              <button 
                onClick={() => navigate('/restaurant-profile')}
                className="flex items-center gap-1 sm:gap-2 text-gray-700 hover:text-primary text-sm sm:text-base"
              >
                <User size={18} className="sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Profile</span>
              </button>
            </FeatureGuard>
            <FeatureGuard feature="analytics">
              <button 
                onClick={() => navigate('/analytics')}
                className="flex items-center gap-1 sm:gap-2 text-gray-700 hover:text-primary text-sm sm:text-base"
              >
                <BarChart3 size={18} className="sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Analytics</span>
              </button>
            </FeatureGuard>
            <FeatureGuard feature="printerSettings">
              <button 
                onClick={() => navigate('/printer-settings')}
                className="flex items-center gap-1 sm:gap-2 text-gray-700 hover:text-primary text-sm sm:text-base"
              >
                <Settings size={18} className="sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Printer Settings</span>
              </button>
            </FeatureGuard>
            <button 
              onClick={() => setShowNotificationSettings(true)}
              className="flex items-center gap-1 sm:gap-2 text-gray-700 hover:text-primary text-sm sm:text-base"
              title="Notification sound settings"
            >
              <span className="text-lg">🔔</span>
              <span className="hidden sm:inline">Notifications</span>
            </button>
            <button onClick={logout} className="flex items-center gap-1 sm:gap-2 text-gray-700 hover:text-primary text-sm sm:text-base">
              <LogOut size={18} className="sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-3 sm:p-4">
        <div className="flex gap-2 sm:gap-4 mb-4 sm:mb-6 overflow-x-auto pb-2 hide-scrollbar">
          {/* Staff Ordering Tab - Moved to first position */}
          <FeatureGuard feature="staffOrders">
            <button
              onClick={() => setActiveTab('Staff')}
              className={`relative px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'Staff' ? 'bg-primary text-white' : 'bg-white text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">👥 Staff Order</span>
              <span className="sm:hidden">👥 Staff</span>
            </button>
          </FeatureGuard>

          {/* Third-Party Orders Tab */}
          <FeatureGuard feature="thirdPartyOrders">
            <button
              onClick={() => setActiveTab('third-party')}
              className={`relative px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'third-party' ? 'bg-primary text-white' : 'bg-white text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">📱 Third-Party</span>
              <span className="sm:hidden">📱</span>
              {thirdPartyOrders.length > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${
                  activeTab === 'third-party' 
                    ? 'bg-white text-primary' 
                    : 'bg-primary text-white'
                }`}>
                  {thirdPartyOrders.length}
                </span>
              )}
            </button>
          </FeatureGuard>

          <FeatureGuard feature="deliveryOrders">
            <button
              onClick={() => setActiveTab('delivery')}
              className={`relative px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'delivery' ? 'bg-primary text-white' : 'bg-white text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">Delivery Orders</span>
              <span className="sm:hidden">Delivery</span>
              {activeDeliveryOrders.length > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${
                  activeTab === 'delivery' 
                    ? 'bg-white text-primary' 
                    : 'bg-primary text-white'
                }`}>
                  {activeDeliveryOrders.length}
                </span>
              )}
            </button>
          </FeatureGuard>
          <FeatureGuard feature="orderManagement">
            <button
              onClick={() => setActiveTab('dine-in')}
              className={`relative px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'dine-in' ? 'bg-primary text-white' : 'bg-white text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">Table Orders</span>
              <span className="sm:hidden">Tables</span>
              {activeDineInOrders.length > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${
                  activeTab === 'dine-in' 
                    ? 'bg-white text-primary' 
                    : 'bg-primary text-white'
                }`}>
                  {activeDineInOrders.length}
                </span>
              )}
            </button>
          </FeatureGuard>
          <FeatureGuard feature="menuManagement">
            <button
              onClick={() => setActiveTab('menu')}
              className={`relative px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'menu' ? 'bg-primary text-white' : 'bg-white text-gray-700'
              }`}
            >
              Menu
              {restaurant?.menu?.filter(item => item.available).length > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${
                  activeTab === 'menu' 
                    ? 'bg-white text-primary' 
                    : 'bg-primary text-white'
                }`}>
                  {restaurant.menu.filter(item => item.available).length}
                </span>
              )}
            </button>
          </FeatureGuard>
          <FeatureGuard feature="qrCodeGeneration">
            <button
              onClick={() => setActiveTab('qr')}
              className={`relative px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'qr' ? 'bg-primary text-white' : 'bg-white text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">QR Codes</span>
              <span className="sm:hidden">QR</span>
              {restaurant?.tables > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${
                  activeTab === 'qr' 
                    ? 'bg-white text-primary' 
                    : 'bg-primary text-white'
                }`}>
                  {restaurant.tables}
                </span>
              )}
            </button>
          </FeatureGuard>
          <FeatureGuard feature="orderHistory">
            <button
              onClick={() => setActiveTab('history')}
              className={`relative px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'history' ? 'bg-primary text-white' : 'bg-white text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">Order History</span>
              <span className="sm:hidden">History</span>
              {validOrders.filter(o => o.status === 'completed').length > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${
                  activeTab === 'history' 
                    ? 'bg-white text-primary' 
                    : 'bg-primary text-white'
                }`}>
                  {validOrders.filter(o => o.status === 'completed').length}
                </span>
              )}
            </button>
          </FeatureGuard>
          <FeatureGuard feature="customerFeedback">
            <button
              onClick={() => setActiveTab('feedback')}
              className={`relative px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'feedback' ? 'bg-primary text-white' : 'bg-white text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">Feedback</span>
              <span className="sm:hidden">💬</span>
              {feedback.length > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${
                  activeTab === 'feedback' 
                    ? 'bg-white text-primary' 
                    : 'bg-primary text-white'
                }`}>
                  {feedback.length}
                </span>
              )}
            </button>
          </FeatureGuard>
          
          <button
            onClick={() => setActiveTab('discounts')}
            className={`relative px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'discounts' ? 'bg-primary text-white' : 'bg-white text-gray-700'
            }`}
          >
            <span className="hidden sm:inline">🎉 Discounts</span>
            <span className="sm:hidden">🎉</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'delivery' && isFeatureEnabled('deliveryOrders') && (
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">Delivery & Takeaway Orders</h2>
              <p className="text-gray-600 text-xs sm:text-sm">Total: {activeDeliveryOrders.length} active orders</p>
            </div>
            {activeDeliveryOrders.map((order) => (
              <div key={order._id} className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">
                      {order.source === 'staff' ? (
                        order.orderType === 'takeaway' ? '👥 Staff - Takeaway' : 
                        order.orderType === 'delivery' ? '👥 Staff - Delivery' : 
                        '👥 Staff Order'
                      ) : (
                        '🚚 Delivery Order'
                      )}
                    </h3>
                    <p className="text-sm text-gray-600">{order.customerName} • {order.customerPhone}</p>
                    {order.deliveryAddress && (
                      <p className="text-sm text-gray-600 mt-1">📍 {order.deliveryAddress}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[order.status]}`}>
                    {order.status}
                  </span>
                </div>

                <div className="mb-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-1">
                      <span>{item.name} x {item.quantity}</span>
                      <span>₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                  <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-primary">₹{order.totalAmount}</span>
                  </div>
                </div>

                {/* Print Buttons */}
                <div className="mb-3 flex gap-2">
                  {order.source === 'staff' ? (
                    // Staff Order Print Buttons
                    <>
                      <button
                        onClick={() => printStaffKOT(order)}
                        className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 rounded-lg hover:from-orange-600 hover:to-red-600 font-semibold flex items-center justify-center gap-2"
                      >
                        🍳 Print KOT
                      </button>
                      <button
                        onClick={() => printStaffCustomerBill(order)}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 rounded-lg hover:from-blue-600 hover:to-indigo-600 font-semibold flex items-center justify-center gap-2"
                      >
                        🖨️ Print Bill
                      </button>
                      {/* Clear Order Button for Staff Orders */}
                      <button
                        onClick={() => clearIndividualOrder(order)}
                        className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 rounded-lg hover:from-purple-600 hover:to-pink-600 font-semibold flex items-center justify-center gap-2"
                      >
                        🧹 Clear Order
                      </button>
                      {/* Edit Order Button for Completed Staff Orders */}
                      {(order.status === 'completed' || order.status === 'pending') && (
                        <button
                          onClick={() => openEditOrderModal(order)}
                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-2 rounded-lg hover:from-green-600 hover:to-emerald-600 font-semibold flex items-center justify-center gap-2"
                        >
                          <Edit size={16} />
                          Edit Order
                        </button>
                      )}
                    </>
                  ) : (
                    // Regular Order Print Buttons
                    <>
                      {/* Kitchen Print Button - Smart Visibility */}
                      {order.items.some(item => !item.printed_to_kitchen) && (
                        <button
                          onClick={() => printKitchenOrderIndividual(order)}
                          className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 rounded-lg hover:from-orange-600 hover:to-red-600 font-semibold flex items-center justify-center gap-2"
                        >
                          🍳 Print Bill (Kitchen)
                        </button>
                      )}
                      
                      {/* Cash Counter Print Receipt Button */}
                      <button
                        onClick={() => printIndividualReceipt(order)}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 rounded-lg hover:from-blue-600 hover:to-indigo-600 font-semibold flex items-center justify-center gap-2"
                      >
                        🖨️ Print Receipt
                      </button>
                      
                      {/* Edit Order Button for QR Orders */}
                      {(order.status === 'completed' || order.status === 'pending') && (
                        <button
                          onClick={() => openEditOrderModal(order)}
                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-2 rounded-lg hover:from-green-600 hover:to-emerald-600 font-semibold flex items-center justify-center gap-2"
                        >
                          <Edit size={16} />
                          Edit Order
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => updateOrderStatus(order._id, 'preparing')}
                      className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
                    >
                      Start Preparing
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button
                      onClick={() => updateOrderStatus(order._id, 'out-for-delivery')}
                      className="flex-1 bg-purple-500 text-white py-2 rounded-lg hover:bg-purple-600"
                    >
                      Out for Delivery
                    </button>
                  )}
                  {order.status === 'out-for-delivery' && (
                    <button
                      onClick={() => updateOrderStatus(order._id, 'delivered')}
                      className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600"
                    >
                      Mark Delivered
                    </button>
                  )}
                  {order.status === 'delivered' && (
                    <button
                      onClick={() => updateOrderStatus(order._id, 'completed')}
                      className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
            {activeDeliveryOrders.length === 0 && (
              <div className="text-center py-12 text-gray-500">No active delivery orders</div>
            )}
          </div>
        )}

        {activeTab === 'dine-in' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">Dine-In / Table Orders</h2>
              <p className="text-gray-600 text-xs sm:text-sm">Total: {activeDineInOrders.length} active orders</p>
            </div>
            
            {/* Group orders by table - only show active orders (not completed) */}
            {Object.entries(
              dineInOrders
                .filter(order => order.status !== 'completed')
                .reduce((acc, order) => {
                  const tableNum = order.tableNumber;
                  if (!acc[tableNum]) acc[tableNum] = [];
                  acc[tableNum].push(order);
                  return acc;
                }, {})
            ).map(([tableNum, tableOrders]) => {
              // Check if this is a Staff order
              const isStaffOrder = tableOrders.some(order => order.source === 'staff');
              
              // Combine all items from all orders
              const combinedItems = {};
              tableOrders.forEach(order => {
                order.items.forEach(item => {
                  const key = item.name;
                  if (combinedItems[key]) {
                    combinedItems[key].quantity += item.quantity;
                    combinedItems[key].total += item.price * item.quantity;
                  } else {
                    combinedItems[key] = {
                      name: item.name,
                      price: item.price,
                      quantity: item.quantity,
                      total: item.price * item.quantity
                    };
                  }
                });
              });
              
              const tableTotal = tableOrders.reduce((sum, order) => sum + order.totalAmount, 0);
              const firstOrder = tableOrders[0];
              
              return (
                <div key={tableNum} className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-lg p-4 sm:p-6 mb-4">
                  {/* Table Header */}
                  <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-purple-200">
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        {isStaffOrder ? '👥 Staff - Table' : '🍽️ Table'} {tableNum}
                      </h3>
                      <p className="text-sm text-gray-600">{tableOrders.length} order(s)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="text-2xl font-bold text-primary">₹{tableTotal}</p>
                    </div>
                  </div>

                  {/* Combined Bill */}
                  <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">{firstOrder.customerName} • {firstOrder.customerPhone}</p>
                      <p className="text-xs text-gray-500">{new Date(firstOrder.createdAt).toLocaleTimeString()}</p>
                    </div>

                    <div className="mb-4">
                      {Object.values(combinedItems).map((item, idx) => (
                        <div key={idx} className="flex justify-between py-2 text-sm">
                          <span>{item.name} x {item.quantity}</span>
                          <span>₹{item.total}</span>
                        </div>
                      ))}
                      <div className="border-t-2 mt-3 pt-3 flex justify-between font-bold text-lg">
                        <span>Subtotal</span>
                        <span className="text-primary">₹{tableTotal}</span>
                      </div>
                    </div>
                  </div>

                  {/* Kitchen Print, Print Receipt, and Clear Table Buttons for Table */}
                  <div className="mt-4 pt-4 border-t-2 border-purple-200">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      {isStaffOrder ? (
                        // Staff Order Print Buttons
                        <>
                          <button
                            onClick={() => printStaffKOT(firstOrder)}
                            className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 sm:py-3 rounded-lg hover:from-orange-600 hover:to-red-600 font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-1 sm:gap-2"
                          >
                            🍳 <span className="hidden sm:inline">Print KOT</span><span className="sm:hidden">KOT</span>
                          </button>
                          <button
                            onClick={() => printStaffCustomerBill(firstOrder)}
                            className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 sm:py-3 rounded-lg hover:from-blue-600 hover:to-indigo-600 font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-1 sm:gap-2"
                          >
                            🖨️ <span className="hidden sm:inline">Print Bill</span><span className="sm:hidden">Bill</span>
                          </button>
                          {/* Clear Table Button for Staff Orders */}
                          <button
                            onClick={() => clearTableAndSaveToHistory(tableNum, tableOrders, tableTotal)}
                            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 sm:py-3 rounded-lg hover:from-purple-600 hover:to-pink-600 font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-1 sm:gap-2"
                          >
                            🧹 <span className="hidden sm:inline">Clear Table</span><span className="sm:hidden">Clear</span>
                          </button>
                          {/* Edit Order Button for Completed Staff Orders */}
                          {(firstOrder.status === 'completed' || firstOrder.status === 'pending') && (
                            <button
                              onClick={() => openEditOrderModal(firstOrder)}
                              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-2 sm:py-3 rounded-lg hover:from-green-600 hover:to-emerald-600 font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-1 sm:gap-2"
                            >
                              <Edit size={16} />
                              <span className="hidden sm:inline">Edit Order</span><span className="sm:hidden">Edit</span>
                            </button>
                          )}
                        </>
                      ) : (
                        // Regular Table Order Print Buttons
                        <>
                          {/* Kitchen Print Button - Always visible */}
                          <button
                            onClick={() => printKitchenOrder(tableNum, tableOrders)}
                            className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 sm:py-3 rounded-lg hover:from-orange-600 hover:to-red-600 font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-1 sm:gap-2"
                          >
                            🍳 <span className="hidden sm:inline">Print KOT</span><span className="sm:hidden">KOT</span>
                          </button>
                          
                          {/* Print Receipt Button (Cash Counter) */}
                          <button
                            onClick={() => printReceipt(tableNum, tableOrders, tableTotal)}
                            className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 sm:py-3 rounded-lg hover:from-blue-600 hover:to-indigo-600 font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-1 sm:gap-2"
                          >
                            🖨️ <span className="hidden sm:inline">Print Bill</span><span className="sm:hidden">Bill</span>
                          </button>
                          
                          {/* Clear Table Button */}
                          <button
                            onClick={() => clearTableAndSaveToHistory(tableNum, tableOrders, tableTotal)}
                            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 sm:py-3 rounded-lg hover:from-purple-600 hover:to-pink-600 font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-1 sm:gap-2"
                          >
                            🧹 <span className="hidden sm:inline">Clear Table</span><span className="sm:hidden">Clear</span>
                          </button>
                          
                          {/* Edit Order Button for QR Orders */}
                          {(firstOrder.status === 'completed' || firstOrder.status === 'pending') && (
                            <button
                              onClick={() => openEditOrderModal(firstOrder)}
                              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-2 sm:py-3 rounded-lg hover:from-green-600 hover:to-emerald-600 font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-1 sm:gap-2"
                            >
                              <Edit size={16} />
                              <span className="hidden sm:inline">Edit Order</span><span className="sm:hidden">Edit</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {activeDineInOrders.length === 0 && (
              <div className="text-center py-12 text-gray-500">No active table orders</div>
            )}
          </div>
        )}

        {activeTab === 'menu' && (
          <div>
            <FeatureGuard feature="menuManagement">
              <button
                onClick={() => setShowMenuForm(true)}
                className="mb-4 sm:mb-6 bg-primary text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-red-600 flex items-center gap-2 text-sm sm:text-base"
              >
                <Plus size={18} className="sm:w-5 sm:h-5" />
                Add Menu Item
              </button>
            </FeatureGuard>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {restaurant.menu.map((item) => (
                <div key={item._id} className={`bg-white rounded-lg shadow-md overflow-hidden ${
                  !item.available ? 'opacity-60 border-2 border-red-200' : ''
                }`}>
                  {/* Unavailable Badge */}
                  {!item.available && (
                    <div className="bg-red-500 text-white text-xs px-2 py-1 text-center">
                      UNAVAILABLE - Removed from menu
                    </div>
                  )}
                  
                  {/* Item Image */}
                  {item.image && (
                    <div className="h-32 bg-gray-100">
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className={`w-full h-full object-cover ${!item.available ? 'grayscale' : ''}`}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-bold ${!item.available ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                        {item.name}
                      </h3>
                      <div className="flex gap-2">
                        <FeatureGuard feature="menuManagement">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setMenuForm(item);
                              setShowMenuForm(true);
                            }}
                            className="text-blue-500 hover:text-blue-700"
                            title={!item.available ? 'Edit unavailable item' : 'Edit item'}
                          >
                            <Edit size={18} />
                          </button>
                        </FeatureGuard>
                        <FeatureGuard feature="menuManagement">
                          <button
                            onClick={() => deleteMenuItem(item._id)}
                            className="text-red-500 hover:text-red-700"
                            title={!item.available ? 'Permanently delete (if possible)' : 'Delete item'}
                          >
                            <Trash2 size={18} />
                          </button>
                        </FeatureGuard>
                      </div>
                    </div>
                    <p className={`text-sm mb-2 ${!item.available ? 'text-gray-400' : 'text-gray-600'}`}>
                      {item.description}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className={`text-lg font-bold ${!item.available ? 'text-gray-400 line-through' : 'text-primary'}`}>
                        ₹{item.price}
                      </span>
                      <span className={`text-sm ${!item.available ? 'text-gray-400' : 'text-gray-600'}`}>
                        {item.category}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <div>
                        {item.isVeg ? (
                          <span className={`text-sm ${!item.available ? 'text-gray-400' : 'text-green-600'}`}>
                            🌱 Veg
                          </span>
                        ) : (
                          <span className={`text-sm ${!item.available ? 'text-gray-400' : 'text-red-600'}`}>
                            🍖 Non-Veg
                          </span>
                        )}
                      </div>
                      {!item.available && (
                        <span className="text-xs text-red-500 font-medium">
                          In Order History
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {showMenuForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg p-4 sm:p-6 md:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">
                    {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
                  </h2>
                  <form onSubmit={handleMenuSubmit} className="space-y-4">
                    <div>
                      <label className="block text-gray-700 mb-2">Name</label>
                      <input
                        type="text"
                        required
                        value={menuForm.name}
                        onChange={(e) => setMenuForm({...menuForm, name: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">Price</label>
                      <input
                        type="number"
                        required
                        value={menuForm.price}
                        onChange={(e) => setMenuForm({...menuForm, price: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">Category</label>
                      <input
                        type="text"
                        required
                        value={menuForm.category}
                        onChange={(e) => setMenuForm({...menuForm, category: e.target.value})}
                        placeholder="Enter category (e.g., Starters, Main Course, Desserts, Drinks)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">Description</label>
                      <textarea
                        value={menuForm.description}
                        onChange={(e) => setMenuForm({...menuForm, description: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        rows="3"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-3 font-semibold">Image</label>
                      
                      {/* Upload Method Selection */}
                      <div className="flex gap-4 mb-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="url"
                            checked={imageUploadMethod === 'url'}
                            onChange={(e) => setImageUploadMethod(e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-700">Image URL</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="upload"
                            checked={imageUploadMethod === 'upload'}
                            onChange={(e) => setImageUploadMethod(e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-700">Upload File</span>
                        </label>
                      </div>

                      {/* Image URL Input */}
                      {imageUploadMethod === 'url' && (
                        <div>
                          <input
                            type="url"
                            value={menuForm.image}
                            onChange={(e) => setMenuForm({...menuForm, image: e.target.value})}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="https://example.com/image.jpg"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Direct link to image file (jpg, png, etc.)
                          </p>
                        </div>
                      )}

                      {/* File Upload */}
                      {imageUploadMethod === 'upload' && (
                        <div>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageFileChange}
                              className="hidden"
                              id="image-upload"
                            />
                            <label htmlFor="image-upload" className="cursor-pointer">
                              {imageFile ? (
                                <div>
                                  <p className="text-green-600 font-semibold mb-1">✓ {imageFile.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {(imageFile.size / (1024 * 1024)).toFixed(2)} MB
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setImageFile(null);
                                      setMenuForm({...menuForm, image: ''});
                                    }}
                                    className="text-xs text-red-500 hover:underline mt-2"
                                  >
                                    Remove file
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-gray-600 font-semibold mb-1">Click to upload image</p>
                                  <p className="text-xs text-gray-500">
                                    JPG, PNG up to 2MB
                                  </p>
                                </div>
                              )}
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Image Preview */}
                      {menuForm.image && (
                        <div className="mt-3">
                          <label className="block text-gray-700 mb-2">Preview</label>
                          <div className="bg-gray-100 rounded-lg overflow-hidden max-w-[200px]">
                            <img 
                              src={menuForm.image} 
                              alt="Preview" 
                              className="w-full h-32 object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">Type</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={menuForm.isVeg}
                            onChange={() => setMenuForm({...menuForm, isVeg: true})}
                            className="w-4 h-4"
                          />
                          <span className="text-green-600">🌱 Vegetarian</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={!menuForm.isVeg}
                            onChange={() => setMenuForm({...menuForm, isVeg: false})}
                            className="w-4 h-4"
                          />
                          <span className="text-red-600">🍖 Non-Vegetarian</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenuForm(false);
                          setEditingItem(null);
                          setMenuForm({ name: '', price: '', category: '', description: '', isVeg: true, image: '' });
                          setImageFile(null);
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-600"
                      >
                        {editingItem ? 'Update Item' : 'Add Item'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'qr' && (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <p className="text-sm text-blue-800 mb-2">
                <strong>📱 Scan to Order:</strong> Customers can scan these QR codes to order directly from their table without waiting for a waiter.
              </p>
              <p className="text-xs text-blue-700">
                💡 Print these QR codes and place them on each table. You can right-click and save each QR code image.
              </p>
            </div>

            <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                Table QR Codes ({restaurant.tables || 0} tables)
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    console.log('Current restaurant:', restaurant);
                    console.log('Restaurant ID:', localStorage.getItem('restaurantId'));
                    console.log('Current tables:', restaurant.tables);
                    alert(`Restaurant ID: ${localStorage.getItem('restaurantId')}\nCurrent tables: ${restaurant.tables}`);
                  }}
                  className="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 text-sm"
                  title="Debug Info"
                >
                  🐛 Debug
                </button>
                <FeatureGuard feature="tableManagement">
                  <button
                    onClick={addTable}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2 text-sm sm:text-base"
                  >
                    <Plus size={18} />
                    Add Table
                  </button>
                </FeatureGuard>
              </div>
            </div>
            {restaurant.tables === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-md">
                <p className="text-gray-500 mb-4">No tables added yet</p>
                <button
                  onClick={addTable}
                  className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-red-600"
                >
                  Add Your First Table
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {Array.from({ length: restaurant.tables || 0 }, (_, i) => i + 1).map((tableNum) => {
                  const qrUrl = `${window.location.origin}/qr/${restaurant._id}/${tableNum}`;
                  return (
                    <div key={tableNum} className="bg-white rounded-lg shadow-md p-4 text-center relative">
                      {/* Delete Button */}
                      {tableNum === restaurant.tables && (
                        <FeatureGuard feature="tableManagement">
                          <button
                            onClick={() => deleteTable(tableNum)}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                            title="Delete this table"
                          >
                            <X size={16} />
                          </button>
                        </FeatureGuard>
                      )}
                      
                      <div id={`qr-table-${tableNum}`} className="bg-white p-3 rounded-lg mb-3 inline-block border-2 border-gray-200">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}&margin=10`}
                          alt={`QR Code for Table ${tableNum}`}
                          className="w-[150px] h-[150px]"
                          crossOrigin="anonymous"
                        />
                      </div>
                      <p className="font-bold text-gray-800 text-lg mb-2">Table {tableNum}</p>
                      <p className="text-xs text-gray-500 mb-2">Scan to order</p>
                      <a
                        href={qrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-500 hover:underline block mb-2"
                      >
                        Test Link
                      </a>
                      <FeatureGuard feature="qrCodeGeneration">
                        <button
                          onClick={() => downloadQRCode(tableNum, qrUrl)}
                          className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:bg-red-600 w-full"
                        >
                          📥 Download QR
                        </button>
                      </FeatureGuard>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">📜 Order History</h2>
              <p className="text-gray-600 text-xs sm:text-sm">
                Completed orders: {orders.filter(o => o.status === 'completed').length}
              </p>
            </div>
            
            {/* Group completed orders by table/session */}
            {(() => {
              const completedOrders = orders.filter(order => order.status === 'completed');
              
              // Group dine-in orders by table and completion time (within 1 minute = same bill)
              const groupedOrders = [];
              const processedIds = new Set();
              
              completedOrders.forEach(order => {
                if (processedIds.has(order._id)) return;
                
                if (order.orderType === 'dine-in') {
                  // Find all orders from same table completed around the same time
                  const relatedOrders = completedOrders.filter(o => 
                    o.orderType === 'dine-in' &&
                    o.tableNumber === order.tableNumber &&
                    Math.abs(new Date(o.updatedAt) - new Date(order.updatedAt)) < 60000 // Within 1 minute
                  );
                  
                  relatedOrders.forEach(o => processedIds.add(o._id));
                  groupedOrders.push(relatedOrders);
                } else {
                  // Delivery orders are individual
                  processedIds.add(order._id);
                  groupedOrders.push([order]);
                }
              });
              
              return groupedOrders.map((orderGroup, groupIdx) => {
                const firstOrder = orderGroup[0];
                const isDineIn = firstOrder.orderType === 'dine-in';
                
                // Combine items if multiple orders
                const combinedItems = {};
                let totalAmount = 0;
                
                orderGroup.forEach(order => {
                  totalAmount += order.totalAmount;
                  order.items.forEach(item => {
                    const key = item.name;
                    if (combinedItems[key]) {
                      combinedItems[key].quantity += item.quantity;
                      combinedItems[key].total += item.price * item.quantity;
                    } else {
                      combinedItems[key] = {
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        total: item.price * item.quantity
                      };
                    }
                  });
                });
                
                return (
                  <div key={groupIdx} className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">
                          {isDineIn ? (
                            firstOrder.source === 'staff' ? 
                              `📞 Staff - Table ${firstOrder.tableNumber}` : 
                              `🍽️ Table ${firstOrder.tableNumber}`
                          ) : (
                            firstOrder.source === 'staff' ? (
                              firstOrder.orderType === 'takeaway' ? '📞 Staff - Takeaway' :
                              firstOrder.orderType === 'delivery' ? '📞 Staff - Delivery' :
                              '📞 Staff Order'
                            ) : (
                              '🚚 Delivery Order'
                            )
                          )}
                          {orderGroup.length > 1 && ` (${orderGroup.length} orders)`}
                        </h3>
                        <p className="text-sm text-gray-600">{firstOrder.customerName} • {firstOrder.customerPhone}</p>
                        <p className="text-xs text-gray-500">{new Date(firstOrder.updatedAt).toLocaleString()}</p>
                        {firstOrder.deliveryAddress && (
                          <p className="text-sm text-gray-600 mt-1">📍 {firstOrder.deliveryAddress}</p>
                        )}
                      </div>
                      <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                        Completed
                      </span>
                    </div>

                    <div className="mb-4">
                      {Object.values(combinedItems).map((item, idx) => (
                        <div key={idx} className="flex justify-between py-1 text-sm">
                          <span>{item.name} x {item.quantity}</span>
                          <span>₹{item.total}</span>
                        </div>
                      ))}
                      <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                        <span>Total</span>
                        <span className="text-primary">₹{totalAmount}</span>
                      </div>
                    </div>

                    {/* Print Receipt Button for History */}
                    <div className="mt-3">
                      <button
                        onClick={() => {
                          if (orderGroup.length === 1) {
                            // Single order - print individual receipt
                            printIndividualReceipt(orderGroup[0]);
                          } else {
                            // Multiple orders - print combined receipt like table bill
                            printReceipt(
                              isDineIn ? firstOrder.tableNumber : 'Delivery', 
                              orderGroup, 
                              totalAmount
                            );
                          }
                        }}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 rounded-lg hover:from-blue-600 hover:to-indigo-600 font-semibold flex items-center justify-center gap-2"
                      >
                        🖨️ Print Receipt
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
            
            {orders.filter(o => o.status === 'completed').length === 0 && (
              <div className="text-center py-12 text-gray-500">No completed orders yet</div>
            )}
          </div>
        )}

        {/* Feedback Tab */}
        {activeTab === 'feedback' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">💬 Customer Feedback</h2>
              <p className="text-gray-600 text-xs sm:text-sm">
                View and respond to customer feedback and reviews
              </p>
              
              {/* Feedback Stats */}
              {feedbackStats && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{feedbackStats.totalFeedback}</div>
                    <div className="text-xs text-blue-600">Total Reviews</div>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {feedbackStats.averageRating ? feedbackStats.averageRating.toFixed(1) : '0.0'}⭐
                    </div>
                    <div className="text-xs text-yellow-600">Average Rating</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{feedbackStats.responded}</div>
                    <div className="text-xs text-green-600">Responded</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600">{feedbackStats.pendingResponses}</div>
                    <div className="text-xs text-red-600">Pending</div>
                  </div>
                </div>
              )}
            </div>

            {/* Feedback List */}
            {feedback.map((item) => (
              <div key={item._id} className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-gray-800">
                        {item.isAnonymous ? 'Anonymous Customer' : item.customerName}
                      </h3>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <span
                            key={i}
                            className={`text-lg ${
                              i < item.rating ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                          >
                            ⭐
                          </span>
                        ))}
                      </div>
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {item.feedbackType}
                      </span>
                    </div>
                    
                    {!item.isAnonymous && (
                      <div className="text-sm text-gray-600 mb-2">
                        {item.customerPhone && `📞 ${item.customerPhone}`}
                        {item.customerEmail && ` | 📧 ${item.customerEmail}`}
                        {item.tableNumber && ` | 🪑 Table ${item.tableNumber}`}
                      </div>
                    )}
                    
                    <p className="text-gray-700 mb-3">{item.feedbackText}</p>
                    
                    <div className="text-xs text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      item.status === 'responded' 
                        ? 'bg-green-100 text-green-800' 
                        : item.status === 'archived'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>

                {/* Restaurant Response */}
                {item.restaurantResponse && (
                  <div className="bg-blue-50 p-3 rounded-lg mb-3">
                    <div className="text-sm font-semibold text-blue-800 mb-1">Restaurant Response:</div>
                    <p className="text-blue-700 text-sm">{item.restaurantResponse}</p>
                    <div className="text-xs text-blue-600 mt-1">
                      Responded on {new Date(item.respondedAt).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                )}

                {/* Response Form */}
                {item.status === 'active' && (
                  <div className="border-t pt-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type your response..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            handleFeedbackResponse(item._id, e.target.value.trim());
                            e.target.value = '';
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          const input = e.target.parentElement.querySelector('input');
                          if (input.value.trim()) {
                            handleFeedbackResponse(item._id, input.value.trim());
                            input.value = '';
                          }
                        }}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-600 text-sm"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mt-3">
                  {item.status === 'active' && (
                    <button
                      onClick={() => handleFeedbackStatusUpdate(item._id, 'archived')}
                      className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                    >
                      Archive
                    </button>
                  )}
                  {item.status === 'archived' && (
                    <button
                      onClick={() => handleFeedbackStatusUpdate(item._id, 'active')}
                      className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {feedback.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">💬</div>
                <div>No customer feedback yet</div>
                <div className="text-sm mt-2">Customer feedback will appear here when submitted</div>
              </div>
            )}
          </div>
        )}

        {/* Discounts Tab */}
        {activeTab === 'discounts' && (
          <DiscountManager restaurant={restaurant} />
        )}

        {/* Third-Party Orders Tab */}
        {activeTab === 'third-party' && isFeatureEnabled('thirdPartyOrders') && (
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-3 sm:mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800">📱 Third-Party Orders</h2>
                  <p className="text-gray-600 text-xs sm:text-sm">
                    Manage orders from Swiggy, Zomato, Uber Eats, and other platforms
                  </p>
                </div>
                <button
                  onClick={() => setShowThirdPartyForm(true)}
                  className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-red-600 font-semibold flex items-center gap-2"
                >
                  <Plus size={18} />
                  Add Order
                </button>
              </div>
              
              {/* Third-Party Stats */}
              {thirdPartyStats && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{thirdPartyStats.totalOrders}</div>
                    <div className="text-xs text-blue-600">Total Orders</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">₹{thirdPartyStats.totalRevenue}</div>
                    <div className="text-xs text-green-600">Total Revenue</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600">₹{thirdPartyStats.totalCommission}</div>
                    <div className="text-xs text-red-600">Commission Paid</div>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-600">₹{thirdPartyStats.netRevenue}</div>
                    <div className="text-xs text-yellow-600">Net Revenue</div>
                  </div>
                </div>
              )}
            </div>

            {/* Platform Breakdown */}
            {thirdPartyStats && Object.keys(thirdPartyStats.platformBreakdown).some(platform => thirdPartyStats.platformBreakdown[platform].orders > 0) && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Platform Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(thirdPartyStats.platformBreakdown).map(([platform, stats]) => {
                    if (stats.orders === 0) return null;
                    
                    const platformConfig = {
                      swiggy: { name: '🍊 Swiggy', color: 'bg-orange-500' },
                      zomato: { name: '🍅 Zomato', color: 'bg-red-500' },
                      'uber-eats': { name: '🚗 Uber Eats', color: 'bg-black' },
                      foodpanda: { name: '🐼 Foodpanda', color: 'bg-pink-500' }
                    };
                    
                    const config = platformConfig[platform] || { name: platform, color: 'bg-gray-500' };
                    
                    return (
                      <div key={platform} className="border rounded-lg p-3">
                        <div className={`${config.color} text-white text-center py-2 rounded-lg mb-2 font-semibold`}>
                          {config.name}
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Orders:</span>
                            <span className="font-semibold">{stats.orders}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Revenue:</span>
                            <span className="font-semibold">₹{stats.revenue}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Commission:</span>
                            <span className="font-semibold text-red-600">-₹{stats.commission}</span>
                          </div>
                          <div className="flex justify-between border-t pt-1">
                            <span>Net:</span>
                            <span className="font-bold text-green-600">₹{stats.netRevenue}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Third-Party Orders List */}
            {thirdPartyOrders.map((order) => {
              const platformConfig = {
                swiggy: { name: '🍊 Swiggy', color: 'bg-orange-500' },
                zomato: { name: '🍅 Zomato', color: 'bg-red-500' },
                'uber-eats': { name: '🚗 Uber Eats', color: 'bg-black' },
                foodpanda: { name: '🐼 Foodpanda', color: 'bg-pink-500' }
              };
              
              const config = platformConfig[order.source] || { name: order.source, color: 'bg-gray-500' };
              
              return (
                <div key={order._id} className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`${config.color} text-white px-3 py-1 rounded-full text-sm font-semibold`}>
                          {config.name}
                        </div>
                        <span className="text-sm text-gray-600">#{order.platformOrderId}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'preparing' ? 'bg-orange-100 text-orange-800' :
                          order.status === 'ready' ? 'bg-purple-100 text-purple-800' :
                          order.status === 'picked-up' ? 'bg-indigo-100 text-indigo-800' :
                          order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-bold text-gray-800">{order.customerName}</h3>
                      <p className="text-sm text-gray-600">{order.customerPhone}</p>
                      {order.deliveryAddress && (
                        <p className="text-sm text-gray-600 mt-1">📍 {order.deliveryAddress}</p>
                      )}
                      {order.estimatedDeliveryTime && (
                        <p className="text-sm text-gray-600 mt-1">
                          ⏰ Est. Delivery: {new Date(order.estimatedDeliveryTime).toLocaleString()}
                        </p>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">₹{order.totalAmount}</div>
                      {order.commission > 0 && (
                        <div className="text-sm text-red-600">-₹{order.commission} commission</div>
                      )}
                      {order.platformFee > 0 && (
                        <div className="text-sm text-red-600">-₹{order.platformFee} platform fee</div>
                      )}
                      <div className="text-sm font-semibold text-green-600">
                        Net: ₹{order.netAmount}
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Order Items:</h4>
                    <div className="space-y-1">
                      {order.items.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{item.name} x {item.quantity}</span>
                          <span>₹{item.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {order.specialInstructions && (
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                      <h4 className="font-semibold text-yellow-800 mb-1">Special Instructions:</h4>
                      <p className="text-sm text-yellow-700">{order.specialInstructions}</p>
                    </div>
                  )}

                  {/* Status Update Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => updateOrderStatus(order._id, 'confirmed')}
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                      >
                        Confirm
                      </button>
                    )}
                    {order.status === 'confirmed' && (
                      <button
                        onClick={() => updateOrderStatus(order._id, 'preparing')}
                        className="px-3 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
                      >
                        Start Preparing
                      </button>
                    )}
                    {order.status === 'preparing' && (
                      <button
                        onClick={() => updateOrderStatus(order._id, 'ready')}
                        className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600"
                      >
                        Ready for Pickup
                      </button>
                    )}
                    {order.status === 'ready' && (
                      <button
                        onClick={() => updateOrderStatus(order._id, 'picked-up')}
                        className="px-3 py-1 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600"
                      >
                        Picked Up
                      </button>
                    )}
                    {order.status === 'picked-up' && (
                      <button
                        onClick={() => updateOrderStatus(order._id, 'delivered')}
                        className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                      >
                        Delivered
                      </button>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 mt-3">
                    Order placed: {new Date(order.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            })}
            
            {thirdPartyOrders.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">📱</div>
                <div>No third-party orders yet</div>
                <div className="text-sm mt-2">Add orders from Swiggy, Zomato, and other platforms</div>
                <button
                  onClick={() => setShowThirdPartyForm(true)}
                  className="mt-4 bg-primary text-white px-6 py-2 rounded-lg hover:bg-red-600 font-semibold"
                >
                  Add First Order
                </button>
              </div>
            )}
          </div>
        )}

        {/* Staff Order Tab */}
        {activeTab === 'Staff' && isFeatureEnabled('staffOrders') && (
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">👥 Staff Order</h2>
            </div>

            {/* Order Form */}
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📝 New Order</h3>
              
              {/* Customer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Customer Name (Optional)</label>
                  <input
                    type="text"
                    value={receptionistOrder.customerName}
                    onChange={(e) => setReceptionistOrder({...receptionistOrder, customerName: e.target.value})}
                    placeholder="Enter customer name (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    value={receptionistOrder.customerPhone}
                    onChange={(e) => setReceptionistOrder({...receptionistOrder, customerPhone: e.target.value})}
                    placeholder="Enter phone number (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Order Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Order Type *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setReceptionistOrder({...receptionistOrder, orderType: 'takeaway', deliveryAddress: ''})}
                    className={`p-3 rounded-lg border-2 font-semibold text-sm ${
                      receptionistOrder.orderType === 'takeaway'
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-primary'
                    }`}
                  >
                    🥡 Takeaway/Parcel
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceptionistOrder({...receptionistOrder, orderType: 'delivery', deliveryAddress: ''})}
                    className={`p-3 rounded-lg border-2 font-semibold text-sm ${
                      receptionistOrder.orderType === 'delivery'
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-primary'
                    }`}
                  >
                    🚚 Home Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceptionistOrder({...receptionistOrder, orderType: 'dine-in', deliveryAddress: ''})}
                    className={`p-3 rounded-lg border-2 font-semibold text-sm ${
                      receptionistOrder.orderType === 'dine-in'
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-primary'
                    }`}
                  >
                    🍽️ Dine-In
                  </button>
                </div>
              </div>

              {/* Delivery Address (if delivery selected) */}
              {receptionistOrder.orderType === 'delivery' && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery Address *</label>
                  <textarea
                    value={receptionistOrder.deliveryAddress}
                    onChange={(e) => setReceptionistOrder({...receptionistOrder, deliveryAddress: e.target.value})}
                    placeholder="Enter complete delivery address"
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              )}

              {/* Table Number (if dine-in selected) */}
              {receptionistOrder.orderType === 'dine-in' && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Table Number *</label>
                  <select
                    value={receptionistOrder.tableNumber}
                    onChange={(e) => setReceptionistOrder({...receptionistOrder, tableNumber: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Select Table</option>
                    {Array.from({ length: restaurant?.tables || 0 }, (_, i) => i + 1).map((tableNum) => (
                      <option key={tableNum} value={tableNum}>Table {tableNum}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Menu Items Selection */}
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Select Menu Items</h4>
                
                {/* Search Bar */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search menu items..."
                      value={staffSearchQuery}
                      onChange={(e) => setStaffSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    {staffSearchQuery && (
                      <button
                        onClick={() => setStaffSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Category Filter */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        selectedCategory === 'all'
                          ? 'bg-primary text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      All Items
                    </button>
                    {[...new Set(restaurant?.menu?.filter(item => item.available).map(item => item.category) || [])].map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          selectedCategory === category
                            ? 'bg-primary text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Results Info */}
                {staffSearchQuery && (
                  <div className="mb-3 text-sm text-gray-600">
                    {(() => {
                      const searchResults = restaurant?.menu
                        ?.filter(item => item.available && (selectedCategory === 'all' || item.category === selectedCategory))
                        ?.filter(item =>
                          item.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                          item.description?.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(staffSearchQuery.toLowerCase())
                        ) || [];
                      
                      return searchResults.length > 0 ? (
                        <p>Found {searchResults.length} item{searchResults.length !== 1 ? 's' : ''} for "{staffSearchQuery}"</p>
                      ) : (
                        <p>No items found for "{staffSearchQuery}". Try a different search term.</p>
                      );
                    })()}
                  </div>
                )}

                {/* Menu Items Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                  {restaurant?.menu
                    ?.filter(item => item.available && (selectedCategory === 'all' || item.category === selectedCategory))
                    ?.filter(item => {
                      if (!staffSearchQuery.trim()) return true;
                      return item.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                             item.description?.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                             item.category.toLowerCase().includes(staffSearchQuery.toLowerCase());
                    })
                    ?.map((item) => (
                    <div key={item._id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-800 text-sm">{item.name}</h5>
                          <p className="text-xs text-gray-600">{item.category}</p>
                          <p className="text-sm font-bold text-primary">₹{item.price}</p>
                        </div>
                        {item.image && (
                          <img 
                            src={item.image} 
                            alt={item.name}
                            className="w-12 h-12 object-cover rounded-lg ml-2"
                          />
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateReceptionistOrderItem(item, -1)}
                            className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 flex items-center justify-center text-sm font-bold"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-semibold">
                            {receptionistOrder.items.find(orderItem => orderItem._id === item._id)?.quantity || 0}
                          </span>
                          <button
                            onClick={() => updateReceptionistOrderItem(item, 1)}
                            className="w-6 h-6 rounded-full bg-primary text-white hover:bg-red-600 flex items-center justify-center text-sm font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              {receptionistOrder.items.length > 0 && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-md font-semibold text-gray-800 mb-3">Order Summary</h4>
                  <div className="space-y-3">
                    {receptionistOrder.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                        <div className="flex-1">
                          <span className="font-medium text-gray-800">{item.name}</span>
                          <div className="text-sm text-gray-600">₹{item.price} each</div>
                        </div>
                        
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateReceptionistOrderItem(item, -1)}
                              className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 flex items-center justify-center text-sm font-bold transition-colors"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-semibold text-gray-800">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateReceptionistOrderItem(item, 1)}
                              className="w-7 h-7 rounded-full bg-primary text-white hover:bg-red-600 flex items-center justify-center text-sm font-bold transition-colors"
                            >
                              +
                            </button>
                          </div>
                          
                          {/* Delete Button */}
                          <button
                            onClick={() => {
                              setReceptionistOrder(prevOrder => ({
                                ...prevOrder,
                                items: prevOrder.items.filter((_, i) => i !== index)
                              }));
                            }}
                            className="w-7 h-7 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center text-sm font-bold transition-colors"
                            title="Remove item"
                          >
                            ×
                          </button>
                          
                          {/* Item Total */}
                          <div className="min-w-[60px] text-right">
                            <span className="font-semibold text-gray-800">₹{item.price * item.quantity}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-3 flex justify-between font-bold text-lg bg-white p-3 rounded-lg">
                      <span>Total</span>
                      <span className="text-primary">₹{receptionistOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Special Instructions */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Special Instructions (Optional)</label>
                <textarea
                  value={receptionistOrder.specialInstructions}
                  onChange={(e) => setReceptionistOrder({...receptionistOrder, specialInstructions: e.target.value})}
                  placeholder="Any special requests or cooking instructions..."
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Print Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={printStaffKOTOnly}
                  disabled={receptionistOrder.items.length === 0}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-6 rounded-lg hover:from-orange-600 hover:to-red-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  🍳 Print KOT
                </button>
                <button
                  onClick={printStaffBillOnly}
                  disabled={receptionistOrder.items.length === 0}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 px-6 rounded-lg hover:from-blue-600 hover:to-indigo-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  🖨️ Print Bill
                </button>
                <button
                  onClick={clearReceptionistOrder}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 font-semibold"
                >
                  💾 Save & Clear
                </button>
              </div>

              {/* Print Options Info */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h5 className="font-semibold text-blue-800 mb-2">🖨️ Print & Save Workflow</h5>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>🍳 Print KOT</strong> - Print kitchen ticket (unlimited prints)</li>
                  <li>• <strong>🖨️ Print Bill</strong> - Print customer receipt (unlimited prints)</li>
                  <li>• <strong>💾 Save & Clear</strong> - Save order to history and clear form</li>
                  <li>• <strong>Form Persistence</strong> - Data stays until you click Save & Clear</li>
                  <li>• <strong>Multiple Prints</strong> - Print as many times as needed before saving</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notification Settings Modal */}
      {showNotificationSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">🔔 Notification Settings</h2>
              <button
                onClick={() => setShowNotificationSettings(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Enable/Disable Notifications */}
              <div>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-gray-700 font-semibold">Order Notification Sound</span>
                    <p className="text-sm text-gray-500">Play sound when new orders arrive</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={notificationEnabled}
                      onChange={(e) => handleNotificationToggle(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-12 h-6 rounded-full transition-colors ${
                      notificationEnabled ? 'bg-primary' : 'bg-gray-300'
                    }`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                        notificationEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      } mt-0.5`}></div>
                    </div>
                  </div>
                </label>
              </div>

              {/* Volume Control */}
              {notificationEnabled && (
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Volume: {Math.round(notificationVolume * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={notificationVolume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>🔇 Quiet</span>
                    <span>🔊 Loud</span>
                  </div>
                </div>
              )}

              {/* Test Sound Button */}
              {notificationEnabled && (
                <div>
                  <button
                    onClick={testNotificationSound}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 px-4 rounded-lg hover:from-blue-600 hover:to-indigo-600 font-semibold flex items-center justify-center gap-2"
                  >
                    🔊 Test Notification Sound
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Click to test the notification sound
                  </p>
                </div>
              )}

              {/* Info Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-2">ℹ️ How it works</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Sound plays automatically when new orders arrive</li>
                  <li>• Works for both dine-in and delivery orders</li>
                  <li>• Browser must allow audio playback</li>
                  <li>• Settings are saved for this restaurant</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowNotificationSettings(false)}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-red-600 font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Third-Party Order Form */}
      {showThirdPartyForm && (
        <ThirdPartyOrderForm
          restaurant={restaurant}
          onClose={() => setShowThirdPartyForm(false)}
          onSuccess={() => {
            setShowThirdPartyForm(false);
            const restaurantId = localStorage.getItem('restaurantId');
            fetchOrders(restaurantId);
            fetchThirdPartyOrders(restaurantId);
          }}
        />
      )}
      
      {/* Edit Order Modal (for completed staff orders) */}
      {showEditOrderModal && editingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Edit size={24} />
                  Edit Order
                </h2>
                <button
                  onClick={closeEditOrderModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Order Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Order Details</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={editingOrder.customerName}
                      onChange={(e) => setEditingOrder(prev => ({ ...prev, customerName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Phone</label>
                    <input
                      type="tel"
                      value={editingOrder.customerPhone}
                      onChange={(e) => setEditingOrder(prev => ({ ...prev, customerPhone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order Type</label>
                    <select
                      value={editingOrder.orderType}
                      onChange={(e) => setEditingOrder(prev => ({ ...prev, orderType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="takeaway">Takeaway</option>
                      <option value="delivery">Delivery</option>
                      <option value="dine-in">Dine-in</option>
                    </select>
                  </div>

                  {editingOrder.orderType === 'dine-in' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Table Number</label>
                      <input
                        type="number"
                        value={editingOrder.tableNumber}
                        onChange={(e) => setEditingOrder(prev => ({ ...prev, tableNumber: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  )}

                  {editingOrder.orderType === 'delivery' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
                      <textarea
                        value={editingOrder.deliveryAddress}
                        onChange={(e) => setEditingOrder(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        rows="3"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                    <textarea
                      value={editingOrder.specialInstructions}
                      onChange={(e) => setEditingOrder(prev => ({ ...prev, specialInstructions: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      rows="3"
                    />
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Order Items</h3>
                  
                  {editingOrder.items.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {editingOrder.items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-gray-800">{item.name}</div>
                            <div className="text-sm text-gray-600">₹{item.price} each</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateEditOrderItem(index, 'quantity', Math.max(1, item.quantity - 1))}
                              className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateEditOrderItem(index, 'quantity', item.quantity + 1)}
                              className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600"
                            >
                              +
                            </button>
                            <button
                              onClick={() => removeEditOrderItem(index)}
                              className="ml-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <div className="ml-4 font-medium text-gray-800">
                            ₹{item.price * item.quantity}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      No items in order. Add items from the menu below.
                    </div>
                  )}

                  {/* Add Items from Menu */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-800 mb-3">Add Items from Menu</h4>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {restaurant.menu.map((menuItem) => (
                        <div key={menuItem._id} className="flex items-center justify-between bg-white border border-gray-200 p-2 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{menuItem.name}</div>
                            <div className="text-xs text-gray-600">₹{menuItem.price}</div>
                          </div>
                          <button
                            onClick={() => addItemToEditOrder(menuItem)}
                            className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 text-sm"
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Total */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span>₹{editingOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-6 pt-6 border-t">
                <button
                  onClick={closeEditOrderModal}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditedOrder}
                  className="flex-1 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
