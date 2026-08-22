import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, LogOut, X, Settings, Printer, BarChart3, User, Search, GripVertical, ShoppingCart, Upload } from 'lucide-react';
import axios from 'axios';
import io from 'socket.io-client';
import FeatureGuard from '../components/FeatureGuard';
import { useFeatures } from '../context/FeatureContext';
import { trackRestaurantEvent } from '../utils/analytics';
import notificationSound from '../utils/notificationSound';
import { getWebSocketUrl, getEnvironmentInfo, getFrontendUrl } from '../config/environment.js';
import { printCustomBill, getPrinterSettings, loadPrinterSettingsFromAPI } from '../utils/customBillGenerator.js';
import DiscountManager from '../components/DiscountManager';
import StaffManagement from '../components/StaffManagement';

function FloorPlanView({ restaurant, activeDineInOrders, printStaffKOT, printStaffCustomerBill, printKitchenOrder, printReceipt, clearTableAndSaveToHistory, openEditOrderModal }) {
  const [selectedFloorTable, setSelectedFloorTable] = useState(null);

  const getTableOrders = (n) => activeDineInOrders.filter(o => parseInt(o.tableNumber) === n);
  const getTableTotal = (t) => t.reduce((s, o) => s + (o.totalAmount || 0), 0);

  const selectedOrders = selectedFloorTable ? getTableOrders(selectedFloorTable) : [];
  const selectedTotal = getTableTotal(selectedOrders);
  const isStaffOrder = selectedOrders.some(o => o.source === 'staff');
  const firstOrder = selectedOrders[0];
  const combinedItems = {};
  selectedOrders.forEach(o => o.items.forEach(i => {
    if (combinedItems[i.name]) { combinedItems[i.name].quantity += i.quantity; combinedItems[i.name].total += i.price * i.quantity; }
    else combinedItems[i.name] = { name: i.name, price: i.price, quantity: i.quantity, total: i.price * i.quantity };
  }));

  const tableCount = restaurant?.tables || 10;

  return (
    <div className="flex gap-6 min-h-[400px]">
      {/* Floor Plan — always visible, fixed width */}
      <div className="w-full sm:w-80 shrink-0">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Floor Plan</h2>
            <div className="flex gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-200 border border-green-400 inline-block"></span>Free</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-200 border border-red-400 inline-block"></span>Busy</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: tableCount }, (_, i) => i + 1).map(n => {
              const tOrders = getTableOrders(n);
              const tTotal = getTableTotal(tOrders);
              const isOccupied = tOrders.length > 0;
              const isSelected = selectedFloorTable === n;
              return (
                <button
                  key={n}
                  onClick={() => setSelectedFloorTable(isSelected ? null : n)}
                  className={`relative rounded-xl py-3 px-1 border-2 flex flex-col items-center gap-0.5 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary shadow-lg scale-105'
                      : isOccupied
                      ? 'bg-red-50 border-red-300 hover:border-red-500'
                      : 'bg-green-50 border-green-300 hover:border-green-500'
                  }`}
                >
                  <span className={`text-base font-bold leading-none ${isSelected ? 'text-white' : isOccupied ? 'text-red-700' : 'text-green-700'}`}>{n}</span>
                  {isOccupied && !isSelected && (
                    <span className="text-xs font-medium text-red-600 leading-none">₹{tTotal}</span>
                  )}
                  {!isOccupied && (
                    <span className={`text-xs leading-none ${isSelected ? 'text-white/70' : 'text-green-500'}`}>Free</span>
                  )}
                  {isOccupied && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>}
                </button>
              );
            })}
          </div>
          {activeDineInOrders.length === 0 && (
            <p className="text-center text-gray-400 text-xs mt-4">No active orders</p>
          )}
        </div>
      </div>

      {/* Table Detail — shows when table is selected */}
      <div className="flex-1 min-w-0">
        {!selectedFloorTable ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M10 3v18M14 3v18" />
              </svg>
              <p className="text-sm">Select a table to view details</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{isStaffOrder ? 'Staff · ' : ''}Table {selectedFloorTable}</h3>
                <p className="text-sm text-gray-400 mt-0.5">{selectedOrders.length > 0 ? `${selectedOrders.length} order(s) · ${firstOrder?.customerName || ''}` : 'No orders'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Total</p>
                <p className="text-3xl font-bold text-primary">₹{selectedTotal}</p>
              </div>
            </div>

            {/* Items */}
            {Object.values(combinedItems).length > 0 ? (
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Items</p>
                <div className="space-y-2">
                  {Object.values(combinedItems).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                      <div>
                        <span className="text-sm font-medium text-gray-800">{item.name}</span>
                        <span className="text-xs text-gray-400 ml-2">× {item.quantity}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">₹{item.total}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-gray-200">
                  <span className="font-bold text-gray-800">Total</span>
                  <span className="text-xl font-bold text-primary">₹{selectedTotal}</span>
                </div>
              </div>
            ) : (
              <div className="px-5 py-6 border-b border-gray-100 text-center text-gray-400 text-sm">No orders for this table</div>
            )}

            {/* Status badges */}
            {selectedOrders.length > 0 && (
              <div className="px-5 py-3 border-b border-gray-100 flex gap-2 flex-wrap">
                {selectedOrders.map(o => (
                  <span key={o._id} className={`text-xs px-3 py-1 rounded-full font-semibold ${
                    o.status === 'pending' ? 'bg-yellow-100 text-yellow-700'
                    : o.status === 'preparing' ? 'bg-blue-100 text-blue-700'
                    : o.status === 'ready' ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                  }`}>{o.status}</span>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="px-5 py-4 flex flex-wrap gap-3">
              <button
                onClick={() => isStaffOrder ? printStaffKOT(firstOrder) : printKitchenOrder(selectedFloorTable, selectedOrders)}
                className="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
              >Print KOT</button>
              <button
                onClick={() => isStaffOrder ? printStaffCustomerBill(firstOrder) : printReceipt(selectedFloorTable, selectedOrders, selectedTotal)}
                className="px-5 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
              >Print Bill</button>
              <button
                onClick={() => clearTableAndSaveToHistory(selectedFloorTable, selectedOrders, selectedTotal)}
                className="px-5 py-2.5 bg-purple-500 text-white rounded-lg text-sm font-semibold hover:bg-purple-600 transition-colors"
              >Clear Table</button>
              {firstOrder && (firstOrder.status === 'completed' || firstOrder.status === 'pending') && (
                <button
                  onClick={() => openEditOrderModal(firstOrder)}
                  className="px-5 py-2.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors"
                >Edit Order</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RestaurantDashboard() {
  const navigate = useNavigate();
  const { isFeatureEnabled } = useFeatures();
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    // Set default tab based on available features - Staff Order comes first
    if (isFeatureEnabled('staffOrders')) return 'Staff';
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
      if (isFeatureEnabled('deliveryOrders')) {
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
    if (activeTab === 'delivery' && !isFeatureEnabled('deliveryOrders')) {
      setActiveTab('Staff');
    }
    if (activeTab === 'feedback' && !isFeatureEnabled('customerFeedback')) {
      setActiveTab('Staff');
    }
  }, [activeTab, isFeatureEnabled]);
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [importingMenu, setImportingMenu] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [historySearch, setHistorySearch] = useState('');
  const [clearTableModal, setClearTableModal] = useState(null); // { tableNumber, tableOrders, totalAmount }
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm }
  const [toast, setToast] = useState(null); // { message, type: 'success'|'error' }
  const [onlinePayStep, setOnlinePayStep] = useState(false); // show online sub-screen
  const [onlinePayType, setOnlinePayType] = useState('upi'); // 'upi' | 'netbanking'
  const [utrNumber, setUtrNumber] = useState('');
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
    specialInstructions: '',
    waiterId: '',
    waiterNumber: ''
  });
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [editOrderSearchQuery, setEditOrderSearchQuery] = useState('');
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [arrangeMode, setArrangeMode] = useState(false);
  const [orderedCategories, setOrderedCategories] = useState([]);
  const [orderedMenu, setOrderedMenu] = useState([]);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const dragType = useRef(null); // 'category' | 'item'
  const dragItemCategory = useRef(null);  const menuSearchInputRef = useRef(null);
  const [availableWaiters, setAvailableWaiters] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  
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
    fetchWaiters(restaurantId);
    
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

  // Keyboard shortcuts for menu search
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Focus search when pressing "/" and we're on the menu tab
      if (e.key === '/' && activeTab === 'menu' && menuSearchInputRef.current) {
        e.preventDefault();
        menuSearchInputRef.current.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

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

  const fetchWaiters = async (id) => {
    try {
      const { data } = await axios.get(`/api/staff/restaurant/${id}`);
      const waiters = data.filter(staff => staff.role === 'waiter' && staff.is_active);
      setAvailableWaiters(waiters);
    } catch (error) {
      console.error('Error fetching waiters:', error);
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
      
      showToast('Response sent successfully');
    } catch (error) {
      console.error('Error sending feedback response:', error);
      showToast('Failed to send response', 'error');
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
      showToast('Failed to update feedback status', 'error');
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
      showToast('Test sound played successfully');
    } else {
      showToast('Failed to play test sound — check browser settings', 'error');
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

  const handleImportMenu = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      setImportingMenu(true);
      const text = await file.text();
      const data = JSON.parse(text);
      const items = data.menuItems || data.menu || [];
      if (!items.length) { alert('No menu items found in file.'); return; }
      const restaurantId = localStorage.getItem('restaurantId');

      // Fetch current menu to skip already-imported items (resume support)
      const { data: currentRestaurant } = await axios.get(`/api/restaurants/${restaurantId}`);
      const existingNames = new Set(
        (currentRestaurant.menu || []).map(m => m.name.trim().toLowerCase())
      );

      const pending = items.filter(item => !existingNames.has((item.name || '').trim().toLowerCase()));
      const skipped = items.length - pending.length;

      if (!pending.length) {
        alert('All items already imported. Nothing to do.');
        return;
      }

      setImportProgress({ current: 0, total: pending.length });
      for (let i = 0; i < pending.length; i++) {
        const item = pending[i];
        await axios.post(`/api/restaurants/${restaurantId}/menu`, {
          name: item.name,
          price: item.price,
          category: item.category || '',
          description: item.description || '',
          isVeg: item.isVeg !== undefined ? item.isVeg : true,
          image: item.image || null,
          available: item.available !== undefined ? item.available : true,
          displayOrder: item.displayOrder || null
        });
        setImportProgress({ current: i + 1, total: pending.length });
      }
      await fetchRestaurant(restaurantId);
      const msg = skipped > 0
        ? `✅ Imported ${pending.length} items. Skipped ${skipped} already existing items.`
        : `✅ Imported ${pending.length} menu items successfully!`;
      alert(msg);
    } catch (err) {
      console.error('Import error:', err);
      alert('Import failed. Re-import the same file to resume from where it stopped.');
    } finally {
      setImportingMenu(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const saveArrangeOrder = async () => {
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      // Build order: categories first, then items within each category
      const items = [];
      let displayOrder = 1;
      orderedCategories.forEach(cat => {
        orderedMenu.filter(i => i.category === cat).forEach(item => {
          items.push({ id: item._id, displayOrder: displayOrder++ });
        });
      });
      await axios.put(`/api/restaurants/${restaurantId}/menu-reorder`, { items });
      fetchRestaurant(restaurantId);
    } catch (error) {
      console.error('Error saving order:', error);
      showToast('Failed to save order', 'error');
    }
  };

  const deleteMenuItem = async (menuId) => {
    setConfirmModal({
      message: 'Delete this menu item? Items in order history will be marked unavailable instead.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const restaurantId = localStorage.getItem('restaurantId');
          const response = await axios.delete(`/api/restaurants/${restaurantId}/menu/${menuId}`);
          if (response.data.message) {
            if (response.data.message.includes('marked unavailable') || response.data.message.includes('order history')) {
              showToast('Menu item removed from availability (exists in order history)', 'error');
            } else {
              showToast('Menu item deleted successfully');
            }
          }
          fetchRestaurant(restaurantId);
        } catch (error) {
          console.error('Error deleting menu item:', error);
          if (error.response?.data?.type === 'constraint_violation') {
            showToast('Item marked unavailable — exists in order history', 'error');
          } else {
            showToast('Failed to delete menu item', 'error');
          }
          const restaurantId = localStorage.getItem('restaurantId');
          fetchRestaurant(restaurantId);
        }
      }
    });
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check if it's an image file
      if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
      }
      
      // Check file size (max 2MB for images)
      if (file.size > 2 * 1024 * 1024) {
        showToast('Image too large — max 2MB', 'error');
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

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const addTable = () => {
    const newTableCount = (restaurant.tables || 0) + 1;
    setConfirmModal({
      message: `Add Table ${newTableCount}? A new QR code will be generated for this table.`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const restaurantId = localStorage.getItem('restaurantId');
          await axios.patch(`/api/restaurants/${restaurantId}/tables`, { tables: newTableCount });
          await fetchRestaurant(restaurantId);
          showToast(`Table ${newTableCount} added successfully`);
        } catch (error) {
          console.error('Error adding table:', error);
          const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
          showToast(`Failed to add table: ${errorMsg}`, 'error');
        }
      }
    });
  };

  const deleteTable = async (tableNum) => {
    setConfirmModal({
      message: `Delete Table ${tableNum}? This will remove the last table and its QR code.`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const restaurantId = localStorage.getItem('restaurantId');
          const newTableCount = Math.max(0, (restaurant.tables || 0) - 1);
          await axios.patch(`/api/restaurants/${restaurantId}/tables`, { tables: newTableCount });
          await fetchRestaurant(restaurantId);
          showToast('Table deleted successfully');
        } catch (error) {
          console.error('Error deleting table:', error);
          const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
          showToast(`Failed to delete table: ${errorMsg}`, 'error');
        }
      }
    });
  };

  const downloadQRCode = async (tableNum, qrUrl) => {
    try {
      // Get the QR code image
      const imgElement = document.querySelector(`#qr-table-${tableNum} img`);
      if (!imgElement) {
        showToast('QR code not found', 'error');
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
        showToast('Failed to load QR code', 'error');
      };
      
      // Use the API URL to generate QR code
      qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrUrl)}&margin=20`;
      
    } catch (error) {
      console.error('Error downloading QR code:', error);
      showToast('Failed to download QR code', 'error');
    }
  };

  const clearTableAndSaveToHistory = async (tableNumber, tableOrders, totalAmount) => {
    setClearTableModal({ tableNumber, tableOrders, totalAmount });
    setOnlinePayStep(false);
  };

  const confirmClearTable = (paymentMethod, paymentSubType, utr) => {
    const { tableNumber, tableOrders, isIndividual, individualOrder } = clearTableModal;
    setClearTableModal(null);

    // Individual delivery/takeaway order
    if (isIndividual && individualOrder) {
      (async () => {
        try {
          await axios.patch(`/api/orders/${individualOrder._id}/payment`, {
            paymentMethod,
            paymentSubType: paymentSubType || null,
            utr: utr || null,
            paymentStatus: 'paid'
          });
          if (individualOrder.status !== 'completed') {
            await updateOrderStatus(individualOrder._id, 'completed');
          }
          showToast('Order cleared and saved to history');
          const restaurantId = localStorage.getItem('restaurantId');
          await fetchOrders(restaurantId);
        } catch (error) {
          showToast(`Failed to clear order: ${error.response?.data?.error || error.message}`, 'error');
        }
      })();
      return;
    }
    setOnlinePayStep(false);
    setUtrNumber('');
    setConfirmModal({
      message: `Confirm clearing Table ${tableNumber}? All orders will be marked as completed.`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          for (const order of tableOrders) {
            await axios.patch(`/api/orders/${order._id}/payment`, {
              paymentMethod,
              paymentSubType: paymentSubType || null,
              utrNumber: utr || null
            });
            if (order.status !== 'completed') {
              await updateOrderStatus(order._id, 'completed');
            }
          }
          const sessionKey = `table_session_${restaurant._id}_${tableNumber}`;
          localStorage.removeItem(sessionKey);
          const restaurantId = localStorage.getItem('restaurantId');
          await fetchOrders(restaurantId);
        } catch (error) {
          console.error('❌ Error clearing table:', error);
          showToast(`Failed to clear table: ${error.response?.data?.error || error.message}`, 'error');
        }
      }
    });
  };

  const clearIndividualOrder = async (order) => {
    console.log('Clear Individual Order clicked:', { orderId: order._id, customer: order.customerName, total: order.totalAmount });

    // For delivery/takeaway orders, show payment modal
    if (order.orderType === 'delivery' || order.orderType === 'takeaway') {
      setClearTableModal({
        tableNumber: order.orderType === 'delivery' ? `Delivery - ${order.customerName || ''}` : `Takeaway - ${order.customerName || ''}`,
        tableOrders: [order],
        totalAmount: order.totalAmount,
        isIndividual: true,
        individualOrder: order
      });
      setOnlinePayStep(false);
      return;
    }

    const orderTypeText = order.orderType === 'takeaway' ? 'Takeaway' : 'Order';

    setConfirmModal({
      message: `Clear ${orderTypeText} for ${order.customerName} (₹${order.totalAmount})? This will save it to order history and mark it as completed.`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          if (order.status !== 'completed') await updateOrderStatus(order._id, 'completed');
          showToast('Order cleared and saved to history');
          const restaurantId = localStorage.getItem('restaurantId');
          await fetchOrders(restaurantId);
        } catch (error) {
          console.error('❌ Error clearing individual order:', error);
          showToast(`Failed to clear order: ${error.response?.data?.error || error.message}`, 'error');
        }
      }
    });
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
    const orderId = firstOrder.orderNumber
      ? `#${String(firstOrder.orderNumber).padStart(3, '0')}`
      : `ORD-${Date.now().toString().slice(-6)}`;
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
      showToast('Please allow popups to print', 'error');
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
    const orderId = order.orderNumber
      ? `#${String(order.orderNumber).padStart(3, '0')}`
      : `ORD-${order._id.slice(-6).toUpperCase()}`;
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
      showToast('Please allow popups to print', 'error');
    }
  };

  const printKitchenOrder = (tableNumber, tableOrders) => {
    const settings = getPrinterSettings();
    
    if (!settings.enableKitchenPrinting) {
      showToast('Kitchen printing is disabled in settings', 'error');
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
      showToast('No new items to print to kitchen', 'error');
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
      showToast('Please allow popups to print', 'error');
    }
  };

  const printKitchenOrderIndividual = (order) => {
    const settings = getPrinterSettings();
    
    if (!settings.enableKitchenPrinting) {
      showToast('Kitchen printing is disabled in settings', 'error');
      return;
    }

    // Check if order has unprinted items
    const unprintedItems = order.items.filter(item => !item.printed_to_kitchen);
    
    if (unprintedItems.length === 0) {
      showToast('No new items to print to kitchen', 'error');
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
      showToast('Please allow popups to print', 'error');
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
      showToast('Please select at least one item', 'error');
      return;
    }

    if (receptionistOrder.orderType === 'delivery' && !receptionistOrder.deliveryAddress) {
      showToast('Please enter a delivery address', 'error');
      return;
    }

    if (receptionistOrder.orderType === 'dine-in' && !receptionistOrder.tableNumber) {
      showToast('Please select a table number', 'error');
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
      showToast('Please select at least one item', 'error');
      return;
    }

    if (receptionistOrder.orderType === 'delivery' && !receptionistOrder.deliveryAddress) {
      showToast('Please enter a delivery address', 'error');
      return;
    }

    if (receptionistOrder.orderType === 'dine-in' && !receptionistOrder.tableNumber) {
      showToast('Please select a table number', 'error');
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
      try {
        const restaurantId = localStorage.getItem('restaurantId');
        console.log('🔄 Saving Staff order...', { restaurantId, receptionistOrder });
        
        // Validate required fields before saving
        if (receptionistOrder.orderType === 'delivery' && !receptionistOrder.deliveryAddress) {
          setSuccessMessage('⚠️ Please enter delivery address before saving delivery orders.');
          setTimeout(() => setSuccessMessage(''), 3000);
          return;
        }

        if (receptionistOrder.orderType === 'dine-in' && !receptionistOrder.tableNumber) {
          setSuccessMessage('⚠️ Please select a table number before saving dine-in orders.');
          setTimeout(() => setSuccessMessage(''), 3000);
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
          waiterId: receptionistOrder.waiterId || null,
          waiterNumber: receptionistOrder.waiterNumber || null,
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

        // Show success immediately
        setSuccessMessage(`✅ Order #${createdOrder.orderNumber ? String(createdOrder.orderNumber).padStart(3,'0') : createdOrder._id?.slice(-6).toUpperCase()} saved! Total: ₹${totalAmount}`);
        setTimeout(() => setSuccessMessage(''), 5000);

        // Clear form instantly — don't wait for refresh
        setReceptionistOrder({
          customerName: '',
          customerPhone: '',
          orderType: 'takeaway',
          deliveryAddress: '',
          tableNumber: '',
          items: [],
          specialInstructions: '',
          waiterId: '',
          waiterNumber: ''
        });
        setSelectedCategory('all');
        setStaffSearchQuery('');

        // Refresh orders in background (non-blocking)
        fetchOrders(restaurantId);
        return; // skip the form clear at the bottom — already done above

        } catch (error) {
          console.error('❌ Error saving Staff order:', error);
          console.error('Error details:', error.response?.data);
          setSuccessMessage(`❌ Failed to save order: ${error.response?.data?.error || error.message}`);
          setTimeout(() => setSuccessMessage(''), 5000);
          return; // Don't clear the form if save failed
        }
      }

    // Clear the form
    console.log('Clearing Staff order form');
    setReceptionistOrder({
      customerName: '',
      customerPhone: '',
      orderType: 'takeaway',
      deliveryAddress: '',
      tableNumber: '',
      items: [],
      specialInstructions: '',
      waiterId: '',
      waiterNumber: ''
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
            Staff ORDER
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
          <div style="margin-bottom: 5px;">PREPARE WITH CARE </div>
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
      showToast('Please allow popups to print', 'error');
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
            Staff Order Receipt
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
      showToast('Please allow popups to print', 'error');
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
    setEditOrderSearchQuery(''); // Reset search query when closing modal
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
        showToast('Order must have at least one item', 'error');
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
      
      showToast('Order updated successfully');
      closeEditOrderModal();
      
    } catch (error) {
      console.error('❌ Error updating order:', error);
      showToast(`Failed to update order: ${error.response?.data?.error || error.message}`, 'error');
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
      {/* Success Message Banner */}
      {successMessage && (
        <div className={`fixed top-0 left-0 right-0 z-50 ${
          successMessage.startsWith('✅') ? 'bg-green-500' : 
          successMessage.startsWith('⚠️') ? 'bg-yellow-500' : 
          'bg-red-500'
        } text-white px-4 py-3 shadow-lg`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span className="font-medium">{successMessage}</span>
            <button 
              onClick={() => setSuccessMessage('')}
              className="text-white hover:text-gray-200 font-bold text-xl"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
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
                <span className="hidden sm:inline">Settings</span>
              </button>
            </FeatureGuard>
            <button 
              onClick={() => setShowNotificationSettings(true)}
              className="flex items-center gap-1 sm:gap-2 text-gray-700 hover:text-primary text-sm sm:text-base"
              title="Notification sound settings"
            >
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
              <span className="hidden sm:inline">Staff Order</span>
              <span className="sm:hidden">Staff</span>
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
          
          <FeatureGuard feature="staffManagement">
            <button
              onClick={() => setActiveTab('staff-management')}
              className={`relative px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'staff-management' ? 'bg-primary text-white' : 'bg-white text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">Staff</span>
              <span className="sm:hidden">Staff</span>
            </button>
          </FeatureGuard>
          
          <button
            onClick={() => setActiveTab('discounts')}
            className={`relative px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'discounts' ? 'bg-primary text-white' : 'bg-white text-gray-700'
            }`}
          >
            <span className="hidden sm:inline">Discounts</span>
            <span className="sm:hidden">Discounts</span>
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
                        order.orderType === 'takeaway' ? 'Staff - Takeaway' : 
                        order.orderType === 'delivery' ? 'Staff - Delivery' : 
                        'Staff Order'
                      ) : (
                        'Delivery Order'
                      )}
                    </h3>
                    <p className="text-sm text-gray-600">{order.customerName} • {order.customerPhone}</p>
                    {order.waiterNumber && (
                      <p className="text-sm font-semibold text-blue-600 mt-1">Waiter: {order.waiterNumber}</p>
                    )}
                    {order.deliveryAddress && (
                      <p className="text-sm text-gray-600 mt-1">{order.deliveryAddress}</p>
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
                        Print KOT
                      </button>
                      <button
                        onClick={() => printStaffCustomerBill(order)}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 rounded-lg hover:from-blue-600 hover:to-indigo-600 font-semibold flex items-center justify-center gap-2"
                      >
                        Print Bill
                      </button>
                      {/* Clear Order Button for Staff Orders */}
                      <button
                        onClick={() => clearIndividualOrder(order)}
                        className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 rounded-lg hover:from-purple-600 hover:to-pink-600 font-semibold flex items-center justify-center gap-2"
                      >
                        Clear Order
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
                          Print Bill (Kitchen)
                        </button>
                      )}
                      
                      {/* Cash Counter Print Receipt Button */}
                      <button
                        onClick={() => printIndividualReceipt(order)}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 rounded-lg hover:from-blue-600 hover:to-indigo-600 font-semibold flex items-center justify-center gap-2"
                      >
                        Print Receipt
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
          <FloorPlanView
            restaurant={restaurant}
            activeDineInOrders={activeDineInOrders}
            printStaffKOT={printStaffKOT}
            printStaffCustomerBill={printStaffCustomerBill}
            printKitchenOrder={printKitchenOrder}
            printReceipt={printReceipt}
            clearTableAndSaveToHistory={clearTableAndSaveToHistory}
            openEditOrderModal={openEditOrderModal}
          />
        )}

        {activeTab === 'menu' && (
          <div>
            {/* Header with Add Button, Search, and Arrange toggle */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4 sm:mb-6">
              <div className="flex gap-2">
                <FeatureGuard feature="menuManagement">
                  <button
                    onClick={() => setShowMenuForm(true)}
                    className="bg-primary text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-red-600 flex items-center gap-2 text-sm sm:text-base"
                  >
                    <Plus size={18} />
                    Add Menu Item
                  </button>
                </FeatureGuard>
                <FeatureGuard feature="menuManagement">
                  <label className={`px-4 py-2 sm:py-3 rounded-lg text-sm font-medium flex items-center gap-2 border transition-colors cursor-pointer ${importingMenu ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-green-600 border-green-400 hover:bg-green-50'}`}>
                    <Upload size={16} />
                    {importingMenu
                      ? `Importing ${importProgress.current}/${importProgress.total}...`
                      : 'Import Menu'}
                    <input type="file" accept=".json" className="hidden" onChange={handleImportMenu} disabled={importingMenu} />
                  </label>
                  {importingMenu && importProgress.total > 0 && (
                    <div className="w-full mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1 text-center">
                        {Math.round((importProgress.current / importProgress.total) * 100)}% — {importProgress.current} of {importProgress.total} items
                      </p>
                    </div>
                  )}
                </FeatureGuard>
                <button
                  onClick={async () => {
                    if (!arrangeMode) {
                      const cats = [...new Set(restaurant.menu.map(i => i.category).filter(Boolean))];
                      setOrderedCategories(cats);
                      setOrderedMenu([...restaurant.menu]);
                      setArrangeMode(true);
                    } else {
                      await saveArrangeOrder();
                      setArrangeMode(false);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border transition-colors ${
                    arrangeMode
                      ? 'bg-green-500 text-white border-green-500 hover:bg-green-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <GripVertical size={16} />
                  {arrangeMode ? 'Save Order' : 'Arrange'}
                </button>
                {arrangeMode && (
                  <button
                    onClick={() => setArrangeMode(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Search Input */}
              {!arrangeMode && (
                <div className="w-full sm:w-auto sm:max-w-md flex-1 sm:flex-initial">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      ref={menuSearchInputRef}
                      type="text"
                      placeholder="Search menu items... (Press / to focus)"
                      value={menuSearchQuery}
                      onChange={(e) => setMenuSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      onKeyDown={(e) => { if (e.key === 'Escape') setMenuSearchQuery(''); }}
                    />
                    {menuSearchQuery && (
                      <button onClick={() => setMenuSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Search Results Count */}
            {menuSearchQuery && !arrangeMode && (
              <div className="mb-4 text-sm text-gray-600">
                {restaurant.menu.filter(item =>
                  item.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
                  item.category?.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
                  item.description?.toLowerCase().includes(menuSearchQuery.toLowerCase())
                ).length} items found for "{menuSearchQuery}"
                <span className="ml-2 text-gray-400">• Press Escape to clear</span>
              </div>
            )}

            {/* ARRANGE MODE */}
            {arrangeMode ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Drag categories to reorder them, and drag items within a category to reorder items.</p>
                {orderedCategories.map((category, catIndex) => (
                  <div
                    key={category}
                    draggable
                    onDragStart={() => { dragItem.current = catIndex; dragType.current = 'category'; }}
                    onDragEnter={() => { dragOverItem.current = catIndex; }}
                    onDragEnd={() => {
                      if (dragType.current !== 'category') return;
                      const cats = [...orderedCategories];
                      const [moved] = cats.splice(dragItem.current, 1);
                      cats.splice(dragOverItem.current, 0, moved);
                      setOrderedCategories(cats);
                      dragItem.current = null;
                      dragOverItem.current = null;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    className="bg-white rounded-xl border-2 border-dashed border-gray-200 hover:border-primary transition-colors cursor-grab active:cursor-grabbing"
                  >
                    {/* Category header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                      <GripVertical size={18} className="text-gray-400 shrink-0" />
                      <span className="font-bold text-gray-800">{category}</span>
                      <span className="text-sm text-gray-400">({orderedMenu.filter(i => i.category === category).length})</span>
                    </div>

                    {/* Items within category */}
                    <div className="p-3 space-y-2">
                      {orderedMenu.filter(i => i.category === category).map((item, itemIndex) => {
                        const globalIndex = orderedMenu.findIndex(i => i._id === item._id);
                        return (
                          <div
                            key={item._id}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              dragItem.current = globalIndex;
                              dragType.current = 'item';
                              dragItemCategory.current = category;
                            }}
                            onDragEnter={(e) => {
                              e.stopPropagation();
                              dragOverItem.current = globalIndex;
                            }}
                            onDragEnd={(e) => {
                              e.stopPropagation();
                              if (dragType.current !== 'item') return;
                              if (dragItemCategory.current !== category) return;
                              const menu = [...orderedMenu];
                              const [moved] = menu.splice(dragItem.current, 1);
                              menu.splice(dragOverItem.current, 0, moved);
                              setOrderedMenu(menu);
                              dragItem.current = null;
                              dragOverItem.current = null;
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors"
                          >
                            <GripVertical size={16} className="text-gray-400 shrink-0" />
                            {item.image && (
                              <img src={item.image} alt={item.name} className="w-10 h-10 rounded object-cover shrink-0"
                                onError={(e) => { e.target.style.display = 'none'; }} />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 text-sm truncate">{item.name}</p>
                              <p className="text-xs text-gray-500">₹{item.price} · {item.isVeg ? 'Veg' : 'Non-Veg'}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* NORMAL VIEW */
              <>
                <div className="space-y-8">
                  {(() => {
                    const filtered = restaurant.menu.filter(item =>
                      !menuSearchQuery ||
                      item.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
                      item.category?.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
                      item.description?.toLowerCase().includes(menuSearchQuery.toLowerCase())
                    );
                    const categories = [...new Set(filtered.map(item => item.category).filter(Boolean))];
                    return categories.map(category => (
                      <div key={category}>
                        <h3 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-200 flex items-center gap-2">
                          <span>{category}</span>
                          <span className="text-sm font-normal text-gray-400">({filtered.filter(i => i.category === category).length})</span>
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                          {filtered.filter(item => item.category === category).map((item) => (
                            <div key={item._id} className={`bg-white rounded-lg shadow-md overflow-hidden ${!item.available ? 'opacity-60 border-2 border-red-200' : ''}`}>
                              {!item.available && (
                                <div className="bg-red-500 text-white text-xs px-2 py-1 text-center">UNAVAILABLE - Removed from menu</div>
                              )}
                              {item.image && (
                                <div className="h-32 bg-gray-100">
                                  <img src={item.image} alt={item.name}
                                    className={`w-full h-full object-cover ${!item.available ? 'grayscale' : ''}`}
                                    onError={(e) => { e.target.style.display = 'none'; }} />
                                </div>
                              )}
                              <div className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <h3 className={`font-bold ${!item.available ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                    {menuSearchQuery ? (
                                      <span dangerouslySetInnerHTML={{ __html: item.name.replace(new RegExp(`(${menuSearchQuery})`, 'gi'), '<mark class="bg-yellow-200 px-1 rounded">$1</mark>') }} />
                                    ) : item.name}
                                  </h3>
                                  <div className="flex gap-2">
                                    <FeatureGuard feature="menuManagement">
                                      <button onClick={() => { setEditingItem(item); setMenuForm(item); setShowMenuForm(true); }} className="text-blue-500 hover:text-blue-700" title="Edit item">
                                        <Edit size={18} />
                                      </button>
                                    </FeatureGuard>
                                    <FeatureGuard feature="menuManagement">
                                      <button onClick={() => deleteMenuItem(item._id)} className="text-red-500 hover:text-red-700" title="Delete item">
                                        <Trash2 size={18} />
                                      </button>
                                    </FeatureGuard>
                                  </div>
                                </div>
                                <p className={`text-sm mb-2 ${!item.available ? 'text-gray-400' : 'text-gray-600'}`}>{item.description}</p>
                                <div className="flex justify-between items-center">
                                  <span className={`text-lg font-bold ${!item.available ? 'text-gray-400 line-through' : 'text-primary'}`}>₹{item.price}</span>
                                  <div>
                                    {item.isVeg ? (
                                      <span className={`text-sm ${!item.available ? 'text-gray-400' : 'text-green-600'}`}>Veg</span>
                                    ) : (
                                      <span className={`text-sm ${!item.available ? 'text-gray-400' : 'text-red-600'}`}>Non-Veg</span>
                                    )}
                                  </div>
                                </div>
                                {!item.available && <div className="mt-1 text-xs text-red-500 font-medium text-right">In Order History</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {menuSearchQuery && restaurant.menu.filter(item =>
                  item.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
                  item.category?.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
                  item.description?.toLowerCase().includes(menuSearchQuery.toLowerCase())
                ).length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-4"></div>
                    <div className="text-lg font-medium">No menu items found</div>
                    <div className="text-sm mt-2">Try searching with different keywords or check your spelling</div>
                    <button onClick={() => setMenuSearchQuery('')} className="mt-4 text-primary hover:text-red-600 font-medium">Clear search</button>
                  </div>
                )}
              </>
            )}

            {showMenuForm && (              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
                          <span className="text-green-600">Vegetarian</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={!menuForm.isVeg}
                            onChange={() => setMenuForm({...menuForm, isVeg: false})}
                            className="w-4 h-4"
                          />
                          <span className="text-red-600">Non-Vegetarian</span>
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
                    showToast(`ID: ${localStorage.getItem('restaurantId')} | Tables: ${restaurant.tables}`);
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
                  // Force production domain for QR codes
                  const qrUrl = `https://waitnot-restaurant.onrender.com/qr/${restaurant._id}/${tableNum}`;
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
          <div>
            {/* Header row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Order History</h2>
                <p className="text-xs text-gray-500 mt-0.5">Completed orders: {orders.filter(o => o.status === 'completed').length}</p>
              </div>
              {/* Search bar */}
              <div className="relative w-full sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by #001, table, customer, item..."
                  value={historySearch || ''}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            {orders.filter(o => o.status === 'completed').length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-white rounded-xl">
                <p className="text-sm">No completed orders yet</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="col-span-1">#</div>
                  <div className="col-span-2">Order</div>
                  <div className="col-span-2">Customer</div>
                  <div className="col-span-3">Items</div>
                  <div className="col-span-2 text-right">Amount</div>
                  <div className="col-span-1 text-center">Pay</div>
                  <div className="col-span-1 text-right">Print</div>
                </div>

                {/* Rows */}
                {(() => {
                  const completedOrders = orders.filter(o => o.status === 'completed');
                  const groupedOrders = [];
                  const processedIds = new Set();

                  completedOrders.forEach(order => {
                    if (processedIds.has(order._id)) return;
                    if (order.orderType === 'dine-in') {
                      const related = completedOrders.filter(o =>
                        o.orderType === 'dine-in' &&
                        o.tableNumber === order.tableNumber &&
                        Math.abs(new Date(o.updatedAt) - new Date(order.updatedAt)) < 60000
                      );
                      related.forEach(o => processedIds.add(o._id));
                      groupedOrders.push(related);
                    } else {
                      processedIds.add(order._id);
                      groupedOrders.push([order]);
                    }
                  });

                  return groupedOrders.map((orderGroup, idx) => {
                    const first = orderGroup[0];
                    const isDineIn = first.orderType === 'dine-in';
                    const combinedItems = {};
                    let total = 0;
                    orderGroup.forEach(o => {
                      total += o.totalAmount;
                      o.items.forEach(i => {
                        if (combinedItems[i.name]) { combinedItems[i.name].qty += i.quantity; combinedItems[i.name].amt += i.price * i.quantity; }
                        else combinedItems[i.name] = { qty: i.quantity, amt: i.price * i.quantity };
                      });
                    });
                    const itemList = Object.entries(combinedItems);
                    const label = isDineIn
                      ? `${first.source === 'staff' ? 'Staff · ' : ''}Table ${first.tableNumber}`
                      : first.orderType === 'takeaway' ? 'Takeaway'
                      : first.orderType === 'delivery' ? 'Delivery'
                      : 'Order';

                    // Filter by search
                    if (historySearch) {
                      const q = historySearch.toLowerCase().replace(/^#/, '');
                      const matchesLabel = label.toLowerCase().includes(q);
                      const matchesCustomer = (first.customerName || '').toLowerCase().includes(q);
                      const matchesItem = Object.keys(combinedItems).some(n => n.toLowerCase().includes(q));
                      const matchesOrderNum = first.orderNumber
                        ? String(first.orderNumber).padStart(3, '0').includes(q)
                        : false;
                      if (!matchesLabel && !matchesCustomer && !matchesItem && !matchesOrderNum) return null;
                    }

                    const orderNum = idx + 1;

                    return (
                      <div key={idx} className={`grid grid-cols-12 gap-2 px-4 py-3 items-start border-b border-gray-50 hover:bg-gray-50 transition-colors text-sm ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                        {/* # */}
                        <div className="col-span-1">
                          <p className="font-bold text-gray-700 text-sm">#{String(first.orderNumber || orderNum).padStart(3, '0')}</p>
                        </div>
                        {/* Order */}
                        <div className="col-span-2">
                          <p className="font-semibold text-gray-800">{label}</p>
                          <p className="text-xs text-gray-400">{new Date(first.updatedAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
                          {first.paymentMethod && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${first.paymentMethod === 'online' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                              {first.paymentMethod}
                            </span>
                          )}
                        </div>
                        {/* Customer */}
                        <div className="col-span-2">
                          <p className="text-gray-700 truncate">{first.customerName || '—'}</p>
                          {first.customerPhone && <p className="text-xs text-gray-400">{first.customerPhone}</p>}
                        </div>
                        {/* Items */}
                        <div className="col-span-3 space-y-0.5">
                          {itemList.slice(0, 3).map(([name, d]) => (
                            <p key={name} className="text-gray-600 text-xs truncate">{name} ×{d.qty}</p>
                          ))}
                          {itemList.length > 3 && <p className="text-xs text-gray-400">+{itemList.length - 3} more</p>}
                        </div>
                        {/* Amount */}
                        <div className="col-span-2 text-right">
                          <p className="font-bold text-primary">₹{total}</p>
                        </div>
                        {/* Pay status */}
                        <div className="col-span-1 text-center">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${first.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {first.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                          </span>
                        </div>
                        {/* Print */}
                        <div className="col-span-1 text-right">
                          <button
                            onClick={() => orderGroup.length === 1 ? printIndividualReceipt(first) : printReceipt(isDineIn ? first.tableNumber : 'Order', orderGroup, total)}
                            className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors"
                            title="Print receipt"
                          >
                            <Printer size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
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
                        {item.customerPhone && `${item.customerPhone}`}
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

        {/* Staff Management Tab */}
        {activeTab === 'staff-management' && isFeatureEnabled('staffManagement') && (
          <StaffManagement restaurantId={restaurant?._id} />
        )}

        {/* Discounts Tab */}
        {activeTab === 'discounts' && (
          <DiscountManager restaurant={restaurant} />
        )}

        {/* Staff Order Tab */}
        {/* Staff Order Tab */}
        {activeTab === 'Staff' && isFeatureEnabled('staffOrders') && (
          <div className="flex gap-0 h-[calc(100vh-140px)] -m-3 sm:-m-4 overflow-hidden">
            {/* LEFT: Menu Panel */}
            <div className="flex flex-col w-full lg:w-[58%] bg-gray-50 border-r border-gray-200 overflow-hidden">
              {/* Order config bar */}
              <div className="bg-white border-b border-gray-100 px-4 py-3 flex flex-wrap gap-2 items-center shrink-0">
                {/* Order type */}
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                  {[{id:'takeaway',label:'Takeaway'},{id:'delivery',label:'Delivery'},{id:'dine-in',label:'Dine-In'}].map(t => (
                    <button key={t.id} onClick={() => setReceptionistOrder({...receptionistOrder, orderType: t.id, deliveryAddress: ''})}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${receptionistOrder.orderType === t.id ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {/* Table select for dine-in */}
                {receptionistOrder.orderType === 'dine-in' && (
                  <select value={receptionistOrder.tableNumber} onChange={e => setReceptionistOrder({...receptionistOrder, tableNumber: e.target.value})}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary bg-white">
                    <option value="">Table #</option>
                    {Array.from({ length: restaurant?.tables || 0 }, (_, i) => i + 1).map(n => <option key={n} value={n}>Table {n}</option>)}
                  </select>
                )}
                {/* Delivery address */}
                {receptionistOrder.orderType === 'delivery' && (
                  <input type="text" value={receptionistOrder.deliveryAddress} onChange={e => setReceptionistOrder({...receptionistOrder, deliveryAddress: e.target.value})}
                    placeholder="Delivery address" className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary flex-1 min-w-[160px]" />
                )}
                {/* Waiter */}
                <select value={receptionistOrder.waiterId} onChange={e => { const w = availableWaiters.find(x => x.id === parseInt(e.target.value)); setReceptionistOrder({...receptionistOrder, waiterId: e.target.value, waiterNumber: w?.waiter_number||''}); }}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary bg-white">
                  <option value="">Waiter</option>
                  {availableWaiters.map(w => <option key={w.id} value={w.id}>{w.waiter_number} {w.name}</option>)}
                </select>
                {/* Customer name */}
                <input type="text" value={receptionistOrder.customerName} onChange={e => setReceptionistOrder({...receptionistOrder, customerName: e.target.value})}
                  placeholder="Customer name" className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary min-w-[120px]" />
              </div>

              {/* Search */}
              <div className="px-3 pt-3 pb-2 shrink-0">
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <input value={staffSearchQuery} onChange={e => setStaffSearchQuery(e.target.value)} placeholder="Search items..."
                    className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent" />
                  {staffSearchQuery && <button onClick={() => setStaffSearchQuery('')}><X size={14} className="text-gray-400" /></button>}
                </div>
              </div>

              {/* Category tabs */}
              <div className="px-3 pb-2 shrink-0 flex gap-2 overflow-x-auto hide-scrollbar">
                {['all', ...[...new Set(restaurant?.menu?.filter(i => i.available).map(i => i.category) || [])]].map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${selectedCategory === cat ? 'bg-primary text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-primary'}`}>
                    {cat === 'all' ? 'All' : cat}
                  </button>
                ))}
              </div>

              {/* Menu grid */}
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {restaurant?.menu?.filter(i => i.available)
                    .filter(i => selectedCategory === 'all' || i.category === selectedCategory)
                    .filter(i => !staffSearchQuery.trim() || i.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) || i.category?.toLowerCase().includes(staffSearchQuery.toLowerCase()))
                    .map(item => {
                      const inOrder = receptionistOrder.items.find(x => x._id === item._id);
                      return (
                        <div key={item._id} onClick={() => updateReceptionistOrderItem(item, 1)}
                          className="bg-white rounded-xl border border-gray-100 p-3 cursor-pointer hover:border-primary hover:shadow-md transition-all active:scale-95 relative">
                          {item.image && <img src={item.image} alt={item.name} className="w-full h-20 object-cover rounded-lg mb-2" onError={e => e.target.style.display='none'} />}
                          <p className="font-semibold text-gray-800 text-sm leading-tight">{item.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{item.category} · {item.isVeg ? '🟢' : '🔴'}</p>
                          <p className="text-primary font-bold text-sm mt-1">₹{item.price}</p>
                          {inOrder && (
                            <span className="absolute top-2 right-2 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{inOrder.quantity}</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* RIGHT: Cart / Order Summary */}
            <div className="hidden lg:flex lg:flex-col lg:w-[42%] bg-white overflow-hidden">
              {/* Cart header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Current Order</h3>
                  <p className="text-xs text-gray-400 capitalize">{receptionistOrder.orderType}{receptionistOrder.tableNumber ? ` · Table ${receptionistOrder.tableNumber}` : ''}{receptionistOrder.customerName ? ` · ${receptionistOrder.customerName}` : ''}</p>
                </div>
                {receptionistOrder.items.length > 0 && (
                  <button onClick={clearReceptionistOrder} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Clear</button>
                )}
              </div>

              {/* Cart items */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {receptionistOrder.items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-300">
                    <ShoppingCart size={48} className="mb-3 opacity-30" />
                    <p className="text-sm">Add items from the menu</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {receptionistOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2 border-b border-gray-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">₹{item.price} each</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => updateReceptionistOrderItem(item, -1)} className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">-</button>
                          <span className="w-6 text-center text-sm font-bold text-gray-800">{item.quantity}</span>
                          <button onClick={() => updateReceptionistOrderItem(item, 1)} className="w-6 h-6 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">+</button>
                        </div>
                        <p className="text-sm font-semibold text-gray-700 w-14 text-right shrink-0">₹{item.price * item.quantity}</p>
                        <button onClick={() => setReceptionistOrder(prev => ({...prev, items: prev.items.filter((_,i) => i !== idx)}))} className="text-gray-300 hover:text-red-400 shrink-0"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="px-4 py-2 shrink-0">
                <input type="text" value={receptionistOrder.specialInstructions} onChange={e => setReceptionistOrder({...receptionistOrder, specialInstructions: e.target.value})}
                  placeholder="Special instructions..." className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>

              {/* Total & Actions */}
              {receptionistOrder.items.length > 0 && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100 shrink-0">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-500 text-sm">{receptionistOrder.items.reduce((s,i) => s + i.quantity, 0)} items</span>
                    <span className="text-2xl font-bold text-gray-900">₹{receptionistOrder.items.reduce((s,i) => s + i.price * i.quantity, 0)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={printStaffKOTOnly} className="bg-orange-500 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-orange-600 transition-colors">KOT</button>
                    <button onClick={printStaffBillOnly} className="bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-blue-600 transition-colors">Bill</button>
                    <button onClick={clearReceptionistOrder} className="bg-green-500 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-green-600 transition-colors">Save</button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile: Cart button + bottom sheet handled via successMessage */}
            {receptionistOrder.items.length > 0 && (
              <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 z-20">
                <div className="flex-1">
                  <p className="text-xs text-gray-500">{receptionistOrder.items.reduce((s,i) => s + i.quantity,0)} items</p>
                  <p className="font-bold text-gray-900">₹{receptionistOrder.items.reduce((s,i) => s + i.price * i.quantity,0)}</p>
                </div>
                <button onClick={printStaffKOTOnly} className="bg-orange-500 text-white px-3 py-2 rounded-lg text-xs font-bold">KOT</button>
                <button onClick={printStaffBillOnly} className="bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-bold">Bill</button>
                <button onClick={clearReceptionistOrder} className="bg-green-500 text-white px-3 py-2 rounded-lg text-xs font-bold">Save</button>
              </div>
            )}
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
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-800">Add Items from Menu</h4>
                      {editOrderSearchQuery && (
                        <span className="text-xs text-gray-500">
                          {restaurant.menu
                            .filter(menuItem => 
                              menuItem.available && 
                              (menuItem.name.toLowerCase().includes(editOrderSearchQuery.toLowerCase()) ||
                               menuItem.category?.toLowerCase().includes(editOrderSearchQuery.toLowerCase()) ||
                               menuItem.description?.toLowerCase().includes(editOrderSearchQuery.toLowerCase()))
                            ).length} items found
                        </span>
                      )}
                    </div>
                    
                    {/* Search Input */}
                    <div className="mb-3 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search by name, category, or description..."
                        value={editOrderSearchQuery}
                        onChange={(e) => setEditOrderSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        autoFocus
                      />
                      {editOrderSearchQuery && (
                        <button
                          onClick={() => setEditOrderSearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        </button>
                      )}
                    </div>
                    
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {restaurant.menu
                        .filter(menuItem => 
                          menuItem.available && 
                          (menuItem.name.toLowerCase().includes(editOrderSearchQuery.toLowerCase()) ||
                           menuItem.category?.toLowerCase().includes(editOrderSearchQuery.toLowerCase()) ||
                           menuItem.description?.toLowerCase().includes(editOrderSearchQuery.toLowerCase()))
                        )
                        .map((menuItem) => (
                        <div key={menuItem._id} className="flex items-center justify-between bg-white border border-gray-200 p-2 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{menuItem.name}</div>
                            <div className="text-xs text-gray-500">{menuItem.category}</div>
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
                      
                      {/* No results message */}
                      {restaurant.menu
                        .filter(menuItem => 
                          menuItem.available && 
                          (menuItem.name.toLowerCase().includes(editOrderSearchQuery.toLowerCase()) ||
                           menuItem.category?.toLowerCase().includes(editOrderSearchQuery.toLowerCase()) ||
                           menuItem.description?.toLowerCase().includes(editOrderSearchQuery.toLowerCase()))
                        ).length === 0 && editOrderSearchQuery && (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          No menu items found for "{editOrderSearchQuery}"
                        </div>
                      )}
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

      {/* Clear Table Payment Modal */}
      {clearTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">

            {!onlinePayStep ? (
              <>
                <h2 className="text-xl font-bold text-gray-800 mb-1">Clear Table {clearTableModal.tableNumber}</h2>
                <p className="text-gray-500 text-sm mb-5">Select payment method to complete and clear this table.</p>

                {/* Bill summary */}
                <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm space-y-1">
                  {(() => {
                    const allItems = {};
                    clearTableModal.tableOrders.forEach(order => {
                      order.items.forEach(item => {
                        if (allItems[item.name]) {
                          allItems[item.name].quantity += item.quantity;
                          allItems[item.name].total += item.price * item.quantity;
                        } else {
                          allItems[item.name] = { quantity: item.quantity, total: item.price * item.quantity };
                        }
                      });
                    });
                    return Object.entries(allItems).map(([name, d]) => (
                      <div key={name} className="flex justify-between text-gray-600">
                        <span>{name} × {d.quantity}</span>
                        <span>₹{d.total}</span>
                      </div>
                    ));
                  })()}
                  <div className="border-t pt-2 flex justify-between font-bold text-gray-800 text-base">
                    <span>Total</span>
                    <span className="text-primary">₹{clearTableModal.totalAmount}</span>
                  </div>
                </div>

                <div className="space-y-3 mb-5">
                  <button
                    onClick={() => { setOnlinePayStep(true); setOnlinePayType('upi'); setUtrNumber(''); }}
                    className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                  >
                    <div>
                      <div className="font-semibold text-gray-800">Online Payment</div>
                      <div className="text-xs text-gray-500">UPI, Net Banking</div>
                    </div>
                  </button>
                  <button
                    onClick={() => confirmClearTable('cash', null, null)}
                    className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all text-left"
                  >
                    <div>
                      <div className="font-semibold text-gray-800">Cash Payment</div>
                      <div className="text-xs text-gray-500">Paid at table</div>
                    </div>
                  </button>
                </div>

                <button
                  onClick={() => { setClearTableModal(null); setOnlinePayStep(false); }}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setOnlinePayStep(false)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
                >
                  ← Back
                </button>
                <h2 className="text-xl font-bold text-gray-800 mb-1">Online Payment</h2>
                <p className="text-gray-500 text-sm mb-5">Table {clearTableModal.tableNumber} · ₹{clearTableModal.totalAmount}</p>

                {/* UPI / Net Banking toggle */}
                <div className="flex gap-2 mb-5">
                  {['upi', 'netbanking'].map(type => (
                    <button
                      key={type}
                      onClick={() => setOnlinePayType(type)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                        onlinePayType === type
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {type === 'upi' ? 'UPI' : 'Net Banking'}
                    </button>
                  ))}
                </div>

                {/* UTR Number (optional) */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    UTR / Reference Number <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={utrNumber}
                    onChange={e => setUtrNumber(e.target.value)}
                    placeholder="Enter UTR or transaction ID"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                  />
                </div>

                <button
                  onClick={() => confirmClearTable('online', onlinePayType, utrNumber)}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-xl font-bold hover:from-blue-600 hover:to-blue-700 transition-all mb-3"
                >
                  Confirm {onlinePayType === 'upi' ? 'UPI' : 'Net Banking'} Payment
                </button>
                <button
                  onClick={() => { setClearTableModal(null); setOnlinePayStep(false); }}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 transition-all animate-fade-in ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-gray-900'
        }`}>
          {toast.type === 'error' ? (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-4 h-4 shrink-0 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          )}
          {toast.message}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Confirm Action</h3>
            <p className="text-gray-600 text-sm mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-red-600 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
