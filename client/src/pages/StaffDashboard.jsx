import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Minus, ShoppingCart, X, Search, UtensilsCrossed, ClipboardList, User, Printer, Trash2, Settings, RefreshCw, Wifi, WifiOff, History, TrendingUp } from 'lucide-react';
import { smartPrint } from '../utils/qzPrint.js';
import axios from '../config/axios.js';
import io from 'socket.io-client';
import SEO from '../components/SEO';
import { BluetoothSerial } from '@ascentio-it/capacitor-bluetooth-serial';

const API = '';

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('tables'); // 'tables' | 'running' | 'history' | 'sales' | 'profile' | 'settings'
  const [socket, setSocket] = useState(null);

  // Order history
  const [historyOrders, setHistoryOrders] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // Sales report
  const [salesData, setSalesData] = useState(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesPeriod, setSalesPeriod] = useState('today');

  // Order flow state
  const [selectedTable, setSelectedTable] = useState(null); // { num, type, roomNumber, orderType }
  const [orderCart, setOrderCart] = useState([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [orderPlacing, setOrderPlacing] = useState(false);
  const [orderContext, setOrderContext] = useState({ orderType: 'dine-in', tableNumber: null, roomNumber: null, customerName: '', deliveryAddress: '', packagingCharge: 0, deliveryCharge: 0 });

  // Modals
  const [confirmModal, setConfirmModal] = useState(null);
  const [clearTablePayModal, setClearTablePayModal] = useState(null);
  const [onlinePayStep, setOnlinePayStep] = useState(false);
  const [onlinePayType, setOnlinePayType] = useState('upi');
  const [utrNumber, setUtrNumber] = useState('');
  const [toast, setToast] = useState(null);

  // Printer settings for staff
  const [printerSettings, setPrinterSettings] = useState({
    btKitchenPrinter: '',
    btBillPrinter: '',
    autoPrintKitchenBill: false,
    autoPrintFinalBill: false
  });
  const [btPrinters, setBtPrinters] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    const staffData = localStorage.getItem('staffData');
    const token = localStorage.getItem('staffToken');
    if (!staffData || !token) { navigate('/staff-login'); return; }
    const s = JSON.parse(staffData);
    setStaff(s);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Restore cached restaurant data instantly to avoid blank screen
    const cached = localStorage.getItem(`restaurant_cache_${s.restaurant_id}`);
    if (cached) {
      setRestaurant(JSON.parse(cached));
      setLoading(false);
    }

    // Fetch restaurant + orders in parallel
    Promise.all([
      axios.get(`${API}/api/restaurants/${s.restaurant_id}`),
      axios.get(`${API}/api/orders/restaurant/${s.restaurant_id}?status=active`)
    ]).then(([resRes, ordersRes]) => {
      setRestaurant(resRes.data);
      localStorage.setItem(`restaurant_cache_${s.restaurant_id}`, JSON.stringify(resRes.data));
      setOrders(ordersRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));

    setIsMobile(window.Capacitor?.isNativePlatform?.());
    loadPrinterSettings(s.restaurant_id);
    if (window.Capacitor?.isNativePlatform?.()) {
      loadBluetoothPrinters();
    }

    const newSocket = io(API, { transports: ['websocket', 'polling'] });
    setSocket(newSocket);
    newSocket.emit('join-restaurant', s.restaurant_id);
    newSocket.on('order-updated', (o) => setOrders(prev => {
      const idx = prev.findIndex(x => x._id === o._id);
      if (idx !== -1) { const n = [...prev]; n[idx] = o; return n.filter(x => x.status !== 'completed'); }
      return o.status !== 'completed' ? [o, ...prev] : prev;
    }));
    newSocket.on('new-order', (o) => { if (o.status !== 'completed') setOrders(prev => [o, ...prev]); });
    return () => { newSocket.emit('leave-restaurant', s.restaurant_id); newSocket.disconnect(); };
  }, [navigate]);

  const loadPrinterSettings = (restaurantId) => {
    const saved = localStorage.getItem(`printer_settings_${restaurantId}`);
    if (saved) {
      setPrinterSettings(JSON.parse(saved));
    }
  };

  const loadBluetoothPrinters = async () => {
    try {
      // 1. Check/Request Permissions (Required for Android 12+)
      if (window.Capacitor?.isNativePlatform?.()) {
        const hasPermission = await BluetoothSerial.checkBluetoothPermissions();
        if (!hasPermission) {
          // If no permissions, the plugin usually doesn't have a direct "request"
          // but we can try to trigger an action that prompts it or tell user.
          console.warn('Bluetooth permissions not granted');
        }
      }

      const state = await BluetoothSerial.isEnabled();
      if (!state.enabled) await BluetoothSerial.enable();
      const result = await BluetoothSerial.getPairedDevices();
      setBtPrinters(result.devices || []);
    } catch (error) {
      console.error('Failed to load BT printers:', error);
    }
  };

  const savePrinterSettings = () => {
    setSavingSettings(true);
    localStorage.setItem(`printer_settings_${staff.restaurant_id}`, JSON.stringify(printerSettings));
    setTimeout(() => {
      setSavingSettings(false);
      showToast('Settings saved');
    }, 500);
  };

  const handlePrinterSettingChange = (key, value) => {
    setPrinterSettings(prev => ({ ...prev, [key]: value }));
  };

  const fetchRestaurantData = async (id) => {
    const { data } = await axios.get(`${API}/api/restaurants/${id}`);
    setRestaurant(data);
    localStorage.setItem(`restaurant_cache_${id}`, JSON.stringify(data));
  };

  const fetchOrders = async (id) => {
    const { data } = await axios.get(`${API}/api/orders/restaurant/${id}?status=active`);
    setOrders(data);
    setLoading(false);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/orders/restaurant/${staff.restaurant_id}?status=completed`);
      setHistoryOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchSales = async (period = salesPeriod) => {
    setSalesLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/orders/restaurant/${staff.restaurant_id}?status=completed`);
      const now = new Date();
      let startDate;
      if (period === 'today') startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      else if (period === 'week') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (period === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      else startDate = new Date(0);

      const filtered = data.filter(o => new Date(o.createdAt) >= startDate);

      const totalRevenue = filtered.reduce((s, o) => s + (o.totalAmount || 0), 0);
      const totalOrders = filtered.length;
      const cashOrders = filtered.filter(o => o.paymentMethod === 'cash' || !o.paymentMethod);
      const onlineOrders = filtered.filter(o => o.paymentMethod === 'online');
      const cashRevenue = cashOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
      const onlineRevenue = onlineOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);

      const itemMap = {};
      filtered.forEach(o => o.items?.forEach(i => {
        if (!itemMap[i.name]) itemMap[i.name] = { qty: 0, revenue: 0 };
        itemMap[i.name].qty += i.quantity;
        itemMap[i.name].revenue += i.price * i.quantity;
      }));
      const topItems = Object.entries(itemMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);

      const typeMap = {};
      filtered.forEach(o => {
        const t = o.orderType || 'dine-in';
        if (!typeMap[t]) typeMap[t] = { count: 0, revenue: 0 };
        typeMap[t].count++;
        typeMap[t].revenue += o.totalAmount || 0;
      });

      setSalesData({ totalRevenue, totalOrders, cashRevenue, onlineRevenue, cashCount: cashOrders.length, onlineCount: onlineOrders.length, topItems, typeMap, filtered });
    } catch (e) {
      console.error(e);
    } finally {
      setSalesLoading(false);
    }
  };

  const getTableStatus = (n) => {
    const t = orders.filter(o => o.orderType === 'dine-in' && parseInt(o.tableNumber) === n);
    return t.length > 0 ? 'occupied' : 'vacant';
  };

  const getTableOrders = (n) => orders.filter(o => o.orderType === 'dine-in' && parseInt(o.tableNumber) === n);

  const getTableTotal = (tableOrders) => tableOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);

  const openTable = (n) => {
    setOrderContext({ orderType: 'dine-in', tableNumber: n, roomNumber: null, customerName: '', deliveryAddress: '', packagingCharge: 0, deliveryCharge: 0 });
    setSelectedTable({ num: n, label: `Table ${n}` });
    setOrderCart([]);
    setMenuSearch('');
    setSelectedCategory('All');
  };

  const openRoom = (n) => {
    const label = restaurant?.features?.roomNames?.[n] || `Room ${n}`;
    setOrderContext({ orderType: 'room', tableNumber: null, roomNumber: n, customerName: '', deliveryAddress: '', packagingCharge: 0, deliveryCharge: 0 });
    setSelectedTable({ num: n, label });
    setOrderCart([]);
    setMenuSearch('');
    setSelectedCategory('All');
  };

  const openTakeaway = () => {
    setOrderContext({ orderType: 'takeaway', tableNumber: null, roomNumber: null, customerName: '', deliveryAddress: '', packagingCharge: 0, deliveryCharge: 0 });
    setSelectedTable({ num: null, label: 'Takeaway' });
    setOrderCart([]);
    setMenuSearch('');
    setSelectedCategory('All');
  };

  const openDelivery = () => {
    setOrderContext({ orderType: 'delivery', tableNumber: null, roomNumber: null, customerName: '', deliveryAddress: '', packagingCharge: 0, deliveryCharge: 0 });
    setSelectedTable({ num: null, label: 'Delivery' });
    setOrderCart([]);
    setMenuSearch('');
    setSelectedCategory('All');
  };

  const addToCart = (item) => {
    setOrderCart(prev => {
      const ex = prev.find(i => i._id === item._id);
      if (ex) return prev.map(i => i._id === item._id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) setOrderCart(prev => prev.filter(i => i._id !== id));
    else setOrderCart(prev => prev.map(i => i._id === id ? { ...i, quantity: qty } : i));
  };

  const cartSubtotal = orderCart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartTotal = cartSubtotal + (orderContext.packagingCharge || 0) + (orderContext.deliveryCharge || 0);

  const getActiveOrdersForSlot = () => {
    const { orderType, tableNumber, roomNumber } = orderContext;
    if (orderType === 'dine-in') return orders.filter(o => o.orderType === 'dine-in' && parseInt(o.tableNumber) === tableNumber);
    if (orderType === 'room') return orders.filter(o => o.orderType === 'room' && parseInt(o.roomNumber) === roomNumber);
    return [];
  };

  const placeOrder = async () => {
    if (!selectedTable || orderCart.length === 0) return;
    setOrderPlacing(true);
    try {
      const { orderType, tableNumber, roomNumber, customerName, deliveryAddress, packagingCharge, deliveryCharge } = orderContext;
      const response = await axios.post(`${API}/api/orders`, {
        restaurantId: staff.restaurant_id,
        tableNumber: orderType === 'dine-in' ? tableNumber : undefined,
        roomNumber: orderType === 'room' ? roomNumber : undefined,
        items: orderCart.map(i => ({ menuItemId: i._id, name: i.name, price: i.price, quantity: i.quantity })),
        totalAmount: cartSubtotal + (packagingCharge || 0) + (deliveryCharge || 0),
        orderType,
        customerName: customerName || `Waiter ${staff.waiter_number || staff.name}`,
        deliveryAddress: orderType === 'delivery' ? deliveryAddress : undefined,
        packagingCharge: orderType === 'takeaway' ? packagingCharge : undefined,
        deliveryCharge: orderType === 'delivery' ? deliveryCharge : undefined,
        source: 'staff', status: 'pending', paymentStatus: 'pending', paymentMethod: 'cash',
      });

      const newOrder = response.data;
      setOrderCart([]);
      showToast('Order placed!');

      const savedSettings = JSON.parse(localStorage.getItem(`printer_settings_${staff.restaurant_id}`) || '{}');
      if (savedSettings.autoPrintKitchenBill) printKOT(newOrder);

      fetchOrders(staff.restaurant_id);
    } catch (err) {
      showToast('Failed to place order', 'error');
    } finally {
      setOrderPlacing(false);
    }
  };

  const updateOrderStatus = async (id, status) => {
    await axios.patch(`${API}/api/orders/${id}/status`, { status });
    fetchOrders(staff.restaurant_id);
  };

  const cancelOrders = async (ordersToCancel, label) => {
    if (!window.confirm(`Cancel order for ${label}? It will be removed with no record in history.`)) return;
    try {
      await Promise.all(ordersToCancel.map(o =>
        axios.delete(`${API}/api/orders/${o._id}`)
      ));
      showToast(`${label} cancelled`);
      setSelectedTable(null);
      fetchOrders(staff.restaurant_id);
    } catch {
      showToast('Failed to cancel', 'error');
    }
  };

  // Print KOT
  const printKOT = (order) => {
    const d = new Date().toLocaleDateString('en-IN'), t = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const css = `@page{size:80mm auto;margin:0}*{box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;margin:0;padding:8px;width:80mm;overflow:hidden}.c{text-align:center}.b{font-weight:bold}.r{display:flex;justify-content:space-between;margin-bottom:2px}.d{border-top:1px dashed #000;margin:6px 0}@media print{body{width:80mm;overflow:hidden}html,body{height:auto!important;page-break-after:avoid;page-break-inside:avoid}}`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="c b" style="font-size:14px">${restaurant?.name?.toUpperCase()}</div><div class="c b">** KOT **</div><div class="d"></div><div class="r"><span>Order:</span><span>${order._id.slice(-6).toUpperCase()}</span></div>${order.tableNumber ? `<div class="r"><span>Table:</span><span><b>${order.tableNumber}</b></span></div>` : ''}${order.roomNumber ? `<div class="r"><span>Room:</span><span><b>${order.roomNumber}</b></span></div>` : ''}<div class="r"><span>Time:</span><span>${d} ${t}</span></div><div class="d"></div>${order.items.map(i => `<div class="r"><span>${i.name}</span><span>x${i.quantity}</span></div>`).join('')}<div class="d"></div><div class="c" style="font-size:10px">-- PREPARE WITH CARE --</div></body></html>`;
    smartPrint(html, 'kitchen');
  };

  const printBill = (tableOrders, tableNum, total) => {
    const d = new Date().toLocaleDateString('en-IN'), t = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const items = {};
    tableOrders.forEach(o => o.items.forEach(i => {
      if (items[i.name]) { items[i.name].qty += i.quantity; items[i.name].total += i.price * i.quantity; }
      else items[i.name] = { qty: i.quantity, total: i.price * i.quantity };
    }));
    const css = `@page{size:80mm auto;margin:0}*{box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;margin:0;padding:8px;width:80mm;overflow:hidden}.c{text-align:center}.b{font-weight:bold}.r{display:flex;justify-content:space-between;margin-bottom:2px}.d{border-top:1px dashed #000;margin:6px 0}@media print{body{width:80mm;overflow:hidden}html,body{height:auto!important;page-break-after:avoid;page-break-inside:avoid}}`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="c b" style="font-size:14px">${restaurant?.name?.toUpperCase()}</div><div class="c">BILL</div><div class="d"></div><div class="r"><span>Table/Ref:</span><span><b>${tableNum}</b></span></div><div class="r"><span>Date:</span><span>${d} ${t}</span></div><div class="d"></div>${Object.entries(items).map(([n, v]) => `<div class="r"><span>${n} x${v.qty}</span><span>₹${v.total}</span></div>`).join('')}<div class="d"></div><div class="r b"><span>TOTAL</span><span>₹${total}</span></div><div class="d"></div><div class="c" style="font-size:10px">Thank you! Visit Again</div></body></html>`;
    smartPrint(html, 'bill');
  };

  const clearTable = (tableOrders, tableNum) => {
    setClearTablePayModal({ tableOrders, tableNum });
    setOnlinePayStep(false);
    setUtrNumber('');
  };

  const confirmClearTable = (paymentMethod, subType, utr) => {
    const { tableOrders, tableNum } = clearTablePayModal;
    setClearTablePayModal(null);
    setOnlinePayStep(false);
    setUtrNumber('');
    setConfirmModal({
      message: `Confirm clearing Table ${tableNum}?`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          // Use batch update for better performance
          const orderIds = tableOrders.map(o => o._id);
          await axios.post(`${API}/api/orders/batch-update`, {
            orderIds,
            status: 'completed',
            paymentMethod,
            paymentSubType: subType || null,
            utrNumber: utr || null,
            paymentStatus: 'paid'
          });

          setSelectedTable(null);
          showToast('Table cleared');
          await fetchOrders(staff.restaurant_id);
        } catch (err) {
          console.error('❌ Error clearing table:', err);
          showToast('Failed to clear table', 'error');
        }
      }
    });
  };

  if (loading || !staff || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const tableCount = restaurant.tables || 10;
  const menuItems = restaurant.menu?.filter(i => i.available) || [];
  const categories = ['All', ...new Set(menuItems.map(i => i.category))];
  const filteredMenu = menuItems.filter(i => {
    const q = menuSearch.toLowerCase();
    const catMatch = selectedCategory === 'All' || i.category === selectedCategory;
    const searchMatch = !q || i.name.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q);
    return catMatch && searchMatch;
  });

  // Running orders (all active orders grouped)
  const runningTables = Object.entries(
    orders.filter(o => o.orderType === 'dine-in' && o.tableNumber)
      .reduce((acc, o) => { const t = o.tableNumber; if (!acc[t]) acc[t] = []; acc[t].push(o); return acc; }, {})
  );
  const runningRooms = Object.entries(
    orders.filter(o => o.orderType === 'room' && o.roomNumber)
      .reduce((acc, o) => { const r = o.roomNumber; if (!acc[r]) acc[r] = []; acc[r].push(o); return acc; }, {})
  );
  const runningOther = orders.filter(o => o.orderType === 'takeaway' || o.orderType === 'delivery');
  const totalRunningCount = runningTables.length + runningRooms.length + runningOther.length;

  return (
    <>
      <SEO title={`${staff.name} — ${restaurant.name}`} description="Captain App" />

      <div className="min-h-screen bg-gray-100 flex flex-col relative">

        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
          <div>
            <p className="font-bold text-gray-900 text-base leading-tight">{restaurant.name}</p>
            <p className="text-xs text-gray-500">{staff.name} · {staff.waiter_number || staff.role}</p>
          </div>
          <button onClick={() => { localStorage.removeItem('staffToken'); localStorage.removeItem('staffData'); navigate('/staff-login'); }} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg">
            <LogOut size={18} />
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden md:min-h-0" style={{ height: 'calc(100vh - 57px)' }}>

          {/* Sidebar nav — desktop — REMOVED, using bottom nav instead */}


          {/* Content area */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* TABLE FLOOR VIEW */}
          {activeView === 'tables' && !selectedTable && (
            <div className="overflow-y-auto flex-1 pb-20 bg-gray-50">

              {/* Dine-In Tables */}
              <div className="px-4 sm:px-6 pt-4 pb-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Dine-In Tables</h2>
                  <div className="flex gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-400 inline-block"></span>Free</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-400 inline-block"></span>Occupied</span>
                  </div>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                  {Array.from({ length: tableCount }, (_, i) => i + 1).map(n => {
                    const tOrders = getTableOrders(n);
                    const isOccupied = tOrders.length > 0;
                    const tTotal = getTableTotal(tOrders);
                    return (
                      <button key={n} onClick={() => openTable(n)}
                        className={`relative rounded-xl py-3 px-1 border-2 flex flex-col items-center gap-0.5 transition-all hover:scale-105 active:scale-95 ${isOccupied ? 'bg-red-50 border-red-300 hover:border-red-500' : 'bg-green-50 border-green-300 hover:border-green-500'}`}>
                        <span className={`text-lg font-bold leading-none ${isOccupied ? 'text-red-700' : 'text-green-700'}`}>{n}</span>
                        {isOccupied ? <span className="text-xs font-medium text-red-600 leading-none">₹{tTotal}</span> : <span className="text-xs text-green-500 leading-none">Free</span>}
                        {isOccupied && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rooms */}
              {(restaurant?.rooms || 0) > 0 && (
                <div className="px-4 sm:px-6 pt-4 pb-2">
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Rooms</h2>
                  <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                    {Array.from({ length: restaurant.rooms }, (_, i) => i + 1).map(n => {
                      const label = restaurant?.features?.roomNames?.[n] || `Room ${n}`;
                      const rOrders = orders.filter(o => o.orderType === 'room' && parseInt(o.roomNumber) === n);
                      const isOccupied = rOrders.length > 0;
                      const rTotal = getTableTotal(rOrders);
                      return (
                        <button key={n} onClick={() => openRoom(n)}
                          className={`relative rounded-xl py-3 px-1 border-2 flex flex-col items-center gap-0.5 transition-all hover:scale-105 active:scale-95 ${isOccupied ? 'bg-orange-50 border-orange-300 hover:border-orange-500' : 'bg-blue-50 border-blue-200 hover:border-blue-400'}`}>
                          <span className="text-base leading-none">🛏</span>
                          <span className={`text-xs font-bold leading-none text-center ${isOccupied ? 'text-orange-700' : 'text-blue-600'}`}>{label}</span>
                          {isOccupied ? <span className="text-xs font-medium text-orange-600 leading-none">₹{rTotal}</span> : <span className="text-xs text-blue-400 leading-none">Free</span>}
                          {isOccupied && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Orders */}
              <div className="px-4 sm:px-6 pt-4 pb-4">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Quick Order</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button onClick={openTakeaway}
                    className="rounded-xl py-4 px-3 border-2 border-orange-300 hover:border-orange-500 bg-orange-50 flex flex-col items-center gap-1 transition-all hover:scale-105 active:scale-95">
                    <span className="text-2xl">🥡</span>
                    <span className="text-sm font-bold text-orange-600">Takeaway</span>
                  </button>
                  <button onClick={openDelivery}
                    className="rounded-xl py-4 px-3 border-2 border-blue-300 hover:border-blue-500 bg-blue-50 flex flex-col items-center gap-1 transition-all hover:scale-105 active:scale-95">
                    <span className="text-2xl">🛵</span>
                    <span className="text-sm font-bold text-blue-600">Delivery</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TABLE DETAIL / ORDER TAKING */}
          {activeView === 'tables' && selectedTable && (
            <div className="flex h-full w-full overflow-hidden">

              {/* LEFT: Category sidebar + Menu */}
              <div className="flex h-full w-full lg:w-[58%] border-r border-gray-200 overflow-hidden bg-gray-50">

                {/* Category sidebar */}
                <div className="w-28 shrink-0 bg-white border-r border-gray-100 overflow-y-auto flex flex-col">
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)}
                      className={`px-2 py-3 text-xs font-semibold text-center border-b border-gray-100 transition-all ${
                        selectedCategory === cat ? 'bg-red-500 text-white' : 'text-gray-600 hover:bg-gray-50'
                      }`}>
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Menu area */}
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Top bar */}
                  <div className="bg-white border-b border-gray-100 px-3 py-2 flex flex-wrap gap-2 items-center shrink-0">
                    <button onClick={() => setSelectedTable(null)} className="text-xs text-red-500 font-semibold">← Back</button>
                    {orderContext.orderType === 'dine-in' && <span className="text-xs font-bold text-white bg-red-500 px-3 py-1 rounded-lg">Dine-In · T{orderContext.tableNumber}</span>}
                    {orderContext.orderType === 'room' && <span className="text-xs font-bold text-white bg-orange-500 px-3 py-1 rounded-lg">🛏 {selectedTable?.label}</span>}
                    {orderContext.orderType === 'takeaway' && <span className="text-xs font-bold text-white bg-orange-500 px-3 py-1 rounded-lg">🥡 Takeaway</span>}
                    {orderContext.orderType === 'delivery' && <span className="text-xs font-bold text-white bg-blue-500 px-3 py-1 rounded-lg">🛵 Delivery</span>}
                    <input type="text" value={orderContext.customerName}
                      onChange={e => setOrderContext(prev => ({ ...prev, customerName: e.target.value }))}
                      placeholder="Customer name"
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none min-w-[100px]" />
                    {orderContext.orderType === 'delivery' && (
                      <input type="text" value={orderContext.deliveryAddress}
                        onChange={e => setOrderContext(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                        placeholder="Delivery address"
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none flex-1 min-w-[140px]" />
                    )}
                  </div>

                  {/* Search */}
                  <div className="px-3 py-2 shrink-0 bg-white border-b border-gray-100">
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                      <Search size={13} className="text-gray-400 shrink-0" />
                      <input value={menuSearch} onChange={e => setMenuSearch(e.target.value)} placeholder="Search..."
                        className="flex-1 text-xs outline-none bg-transparent text-gray-700 placeholder-gray-400" />
                      {menuSearch && <button onClick={() => setMenuSearch('')}><X size={13} className="text-gray-400" /></button>}
                    </div>
                  </div>

                  {/* Menu grid */}
                  <div className="flex-1 overflow-y-auto p-2 pb-24 lg:pb-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {filteredMenu.length === 0 && <p className="col-span-full text-center text-gray-400 py-8 text-xs">No items found</p>}
                      {filteredMenu.map(item => {
                        const inCart = orderCart.find(c => c._id === item._id);
                        return (
                          <div key={item._id}
                            className={`relative bg-white rounded-xl border-2 p-2 cursor-pointer transition-all select-none ${inCart ? 'border-red-400 bg-red-50/30' : 'border-gray-200 hover:border-red-300'}`}
                            onClick={() => { if (!inCart) addToCart(item); }}
                          >
                            <span className={`absolute top-2 left-2 w-2 h-2 rounded-sm border ${item.isVeg ? 'border-green-600 bg-green-500' : 'border-red-600 bg-red-500'}`}></span>
                            <div className="pt-4 pb-1 px-0.5 min-h-[3.5rem]">
                              <p className="text-xs font-semibold text-gray-800 leading-tight">{item.name}</p>
                            </div>
                            {inCart ? (
                              <div className="flex items-center justify-between mt-1 gap-1">
                                <button onClick={e => { e.stopPropagation(); updateQty(item._id, inCart.quantity - 1); }} className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-700">−</button>
                                <span className="text-sm font-bold text-red-600">{inCart.quantity}</span>
                                <button onClick={e => { e.stopPropagation(); updateQty(item._id, inCart.quantity + 1); }} className="w-7 h-7 rounded bg-red-500 text-white flex items-center justify-center text-sm font-bold">+</button>
                              </div>
                            ) : (
                              <div className="flex justify-end mt-1">
                                <span className="w-7 h-7 rounded bg-red-50 flex items-center justify-center text-red-500 font-bold text-lg leading-none">+</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: Cart panel — desktop only */}
              <div className="hidden lg:flex lg:flex-col lg:w-[42%] bg-white h-full overflow-hidden">
                {/* Header */}
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{selectedTable?.label}</h3>
                    <p className="text-xs text-gray-400">
                      {getActiveOrdersForSlot().length > 0
                        ? `Running: ₹${getTableTotal(getActiveOrdersForSlot())}`
                        : 'No running orders'}
                    </p>
                  </div>
                  {orderCart.length > 0 && (
                    <button onClick={() => setOrderCart([])} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
                  )}
                </div>

                {/* Running order summary (existing orders) */}
                {getActiveOrdersForSlot().length > 0 && (
                  <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 shrink-0">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Running Order</p>
                    {(() => {
                      const items = {};
                      getActiveOrdersForSlot().forEach(o => o.items.forEach(i => {
                        if (items[i.name]) items[i.name].qty += i.quantity;
                        else items[i.name] = { qty: i.quantity, price: i.price };
                      }));
                      return Object.entries(items).map(([name, d]) => (
                        <div key={name} className="flex justify-between text-xs text-gray-600">
                          <span>{name} × {d.qty}</span><span>₹{d.price * d.qty}</span>
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {/* Cart items */}
                <div className="overflow-y-auto px-3 py-1 min-h-0" style={{ maxHeight: '40vh' }}>
                  {orderCart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-300">
                      <ShoppingCart size={32} className="mb-1 opacity-30" />
                      <p className="text-xs">Add items from menu</p>
                    </div>
                  ) : (
                    orderCart.map(item => (
                      <div key={item._id} className="flex items-center gap-2 py-1.5 border-b border-gray-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">₹{item.price}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => updateQty(item._id, item.quantity - 1)} className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">−</button>
                          <span className="w-4 text-center text-xs font-bold">{item.quantity}</span>
                          <button onClick={() => updateQty(item._id, item.quantity + 1)} className="w-5 h-5 rounded bg-red-50 flex items-center justify-center text-xs font-bold text-red-500">+</button>
                        </div>
                        <p className="text-xs font-semibold text-gray-700 w-10 text-right shrink-0">₹{item.price * item.quantity}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Bottom actions */}
                {orderCart.length > 0 && (
                  <div className="shrink-0 border-t border-gray-100 px-3 py-2">
                    {orderContext.orderType === 'takeaway' && (
                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-xs text-gray-500 shrink-0">Packaging ₹</label>
                        <input type="number" min="0" value={orderContext.packagingCharge || ''}
                          onChange={e => setOrderContext(prev => ({ ...prev, packagingCharge: parseFloat(e.target.value) || 0 }))}
                          placeholder="0" className="text-xs border border-gray-200 rounded px-2 py-1 w-20 focus:outline-none" />
                      </div>
                    )}
                    {orderContext.orderType === 'delivery' && (
                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-xs text-gray-500 shrink-0">Delivery ₹</label>
                        <input type="number" min="0" value={orderContext.deliveryCharge || ''}
                          onChange={e => setOrderContext(prev => ({ ...prev, deliveryCharge: parseFloat(e.target.value) || 0 }))}
                          placeholder="0" className="text-xs border border-gray-200 rounded px-2 py-1 w-20 focus:outline-none" />
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                      <span>{orderCart.reduce((s, i) => s + i.quantity, 0)} items</span>
                      <span className="text-base font-bold text-gray-900">₹{cartTotal}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button onClick={() => getActiveOrdersForSlot().forEach(o => printKOT(o))} className="bg-orange-500 text-white py-2 rounded-lg text-xs font-bold hover:bg-orange-600">KOT</button>
                      <button onClick={() => { const t = getActiveOrdersForSlot(); printBill(t, selectedTable?.label, getTableTotal(t)); }} className="bg-blue-500 text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-600">Bill</button>
                      <button onClick={placeOrder} disabled={orderPlacing} className="bg-red-500 text-white py-2 rounded-lg text-xs font-bold hover:bg-red-600 disabled:opacity-50">
                        {orderPlacing ? '...' : 'Place'}
                      </button>
                    </div>
                    {getActiveOrdersForSlot().length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                        <button onClick={() => clearTable(getActiveOrdersForSlot(), selectedTable?.label)}
                          className="bg-gray-100 text-gray-600 py-2 rounded-lg text-xs font-bold hover:bg-gray-200">
                          Clear / Pay
                        </button>
                        <button onClick={() => cancelOrders(getActiveOrdersForSlot(), selectedTable?.label)}
                          className="bg-gray-100 text-gray-500 py-2 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-500">
                          Cancel Order
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {/* Show KOT/Bill/Clear even when cart is empty if slot has orders */}
                {orderCart.length === 0 && getActiveOrdersForSlot().length > 0 && (
                  <div className="shrink-0 border-t border-gray-100 px-3 py-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      <button onClick={() => getActiveOrdersForSlot().forEach(o => printKOT(o))} className="bg-orange-500 text-white py-2 rounded-lg text-xs font-bold hover:bg-orange-600">KOT</button>
                      <button onClick={() => { const t = getActiveOrdersForSlot(); printBill(t, selectedTable?.label, getTableTotal(t)); }} className="bg-blue-500 text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-600">Bill</button>
                      <button onClick={() => clearTable(getActiveOrdersForSlot(), selectedTable?.label)} className="bg-red-500 text-white py-2 rounded-lg text-xs font-bold hover:bg-red-600">Clear</button>
                    </div>
                    <div className="mt-1.5">
                      <button onClick={() => cancelOrders(getActiveOrdersForSlot(), selectedTable?.label)} className="w-full bg-gray-100 text-gray-500 py-2 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-500">Cancel Order</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile bottom bar */}
              {orderCart.length > 0 && (
                <div className="lg:hidden fixed bottom-14 left-0 right-0 bg-white border-t border-gray-200 px-3 py-2 flex items-center gap-2 z-20">
                  <span className="flex-1 font-bold text-sm">₹{cartTotal}</span>
                  <button onClick={() => getActiveOrdersForSlot().forEach(o => printKOT(o))} className="bg-orange-500 text-white px-3 py-2 rounded-lg text-xs font-bold">KOT</button>
                  <button onClick={() => { const t = getActiveOrdersForSlot(); printBill(t, selectedTable?.label, getTableTotal(t)); }} className="bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-bold">Bill</button>
                  <button onClick={placeOrder} disabled={orderPlacing} className="bg-red-500 text-white px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50">
                    {orderPlacing ? '...' : 'Place'}
                  </button>
                </div>
              )}
              {orderCart.length === 0 && getActiveOrdersForSlot().length > 0 && (
                <div className="lg:hidden fixed bottom-14 left-0 right-0 bg-white border-t border-gray-200 px-3 py-2 flex items-center gap-2 z-20">
                  <span className="flex-1 font-bold text-sm">{selectedTable?.label}</span>
                  <button onClick={() => getActiveOrdersForSlot().forEach(o => printKOT(o))} className="bg-orange-500 text-white px-3 py-2 rounded-lg text-xs font-bold">KOT</button>
                  <button onClick={() => { const t = getActiveOrdersForSlot(); printBill(t, selectedTable?.label, getTableTotal(t)); }} className="bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-bold">Bill</button>
                  <button onClick={() => clearTable(getActiveOrdersForSlot(), selectedTable?.label)} className="bg-red-500 text-white px-3 py-2 rounded-lg text-xs font-bold">Clear</button>
                </div>
              )}
            </div>
          )}

          {/* RUNNING ORDERS */}
          {activeView === 'running' && (
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 pb-20">
              <h2 className="font-bold text-gray-800 text-lg mb-4">Running Orders</h2>
              {totalRunningCount === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No active orders</p>
                </div>
              )}

              {/* Dine-In Tables */}
              {runningTables.length > 0 && (
                <>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Dine-In Tables</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    {runningTables.map(([tableNum, tableOrders]) => {
                      const total = getTableTotal(tableOrders);
                      const items = {};
                      tableOrders.forEach(o => o.items.forEach(i => {
                        if (items[i.name]) items[i.name].qty += i.quantity;
                        else items[i.name] = { qty: i.quantity, price: i.price };
                      }));
                      return (
                        <div key={tableNum} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">{tableNum}</div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm">Table {tableNum}</p>
                                <p className="text-xs text-gray-400">{tableOrders.length} order(s)</p>
                              </div>
                            </div>
                            <p className="font-bold text-red-500 text-lg">₹{total}</p>
                          </div>
                          <div className="px-4 py-2 space-y-1">
                            {Object.entries(items).map(([name, d]) => (
                              <div key={name} className="flex justify-between text-sm text-gray-600">
                                <span>{name} × {d.qty}</span><span>₹{d.price * d.qty}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex border-t border-gray-100">
                            <button onClick={() => tableOrders.forEach(o => printKOT(o))} className="flex-1 py-2.5 text-xs font-semibold text-orange-600 hover:bg-orange-50 flex items-center justify-center gap-1"><Printer size={14} /> KOT</button>
                            <button onClick={() => printBill(tableOrders, tableNum, total)} className="flex-1 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 border-x border-gray-100 flex items-center justify-center gap-1"><Printer size={14} /> Bill</button>
                            <button onClick={() => cancelOrders(tableOrders, `Table ${tableNum}`)} className="flex-1 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 border-r border-gray-100 flex items-center justify-center gap-1"><X size={14} /> Cancel</button>
                            <button onClick={() => clearTable(tableOrders, parseInt(tableNum))} className="flex-1 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 flex items-center justify-center gap-1"><Trash2 size={14} /> Clear</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Rooms */}
              {runningRooms.length > 0 && (
                <>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Rooms</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    {runningRooms.map(([roomNum, roomOrders]) => {
                      const label = restaurant?.features?.roomNames?.[roomNum] || `Room ${roomNum}`;
                      const total = getTableTotal(roomOrders);
                      const items = {};
                      roomOrders.forEach(o => o.items.forEach(i => {
                        if (items[i.name]) items[i.name].qty += i.quantity;
                        else items[i.name] = { qty: i.quantity, price: i.price };
                      }));
                      return (
                        <div key={roomNum} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">🛏</div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm">{label}</p>
                                <p className="text-xs text-gray-400">{roomOrders.length} order(s)</p>
                              </div>
                            </div>
                            <p className="font-bold text-orange-500 text-lg">₹{total}</p>
                          </div>
                          <div className="px-4 py-2 space-y-1">
                            {Object.entries(items).map(([name, d]) => (
                              <div key={name} className="flex justify-between text-sm text-gray-600">
                                <span>{name} × {d.qty}</span><span>₹{d.price * d.qty}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex border-t border-gray-100">
                            <button onClick={() => roomOrders.forEach(o => printKOT(o))} className="flex-1 py-2.5 text-xs font-semibold text-orange-600 hover:bg-orange-50 flex items-center justify-center gap-1"><Printer size={14} /> KOT</button>
                            <button onClick={() => printBill(roomOrders, label, total)} className="flex-1 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 border-x border-gray-100 flex items-center justify-center gap-1"><Printer size={14} /> Bill</button>
                            <button onClick={() => cancelOrders(roomOrders, label)} className="flex-1 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 border-r border-gray-100 flex items-center justify-center gap-1"><X size={14} /> Cancel</button>
                            <button onClick={() => clearTable(roomOrders, parseInt(roomNum))} className="flex-1 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 flex items-center justify-center gap-1"><Trash2 size={14} /> Clear</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Takeaway & Delivery */}
              {runningOther.length > 0 && (
                <>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Takeaway & Delivery</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    {runningOther.map(order => {
                      const isTakeaway = order.orderType === 'takeaway';
                      return (
                        <div key={order._id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm ${isTakeaway ? 'bg-orange-400' : 'bg-blue-500'}`}>{isTakeaway ? '🥡' : '🛵'}</div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm">{isTakeaway ? 'Takeaway' : 'Delivery'}</p>
                                <p className="text-xs text-gray-400">{order.customerName || 'Guest'}</p>
                              </div>
                            </div>
                            <p className={`font-bold text-lg ${isTakeaway ? 'text-orange-500' : 'text-blue-500'}`}>₹{order.totalAmount}</p>
                          </div>
                          <div className="px-4 py-2 space-y-1">
                            {order.items.map((item, i) => (
                              <div key={i} className="flex justify-between text-sm text-gray-600">
                                <span>{item.name} × {item.quantity}</span><span>₹{item.price * item.quantity}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex border-t border-gray-100">
                            <button onClick={() => printKOT(order)} className="flex-1 py-2.5 text-xs font-semibold text-orange-600 hover:bg-orange-50 flex items-center justify-center gap-1"><Printer size={14} /> KOT</button>
                            <button onClick={() => printBill([order], order.customerName || 'Guest', order.totalAmount)} className="flex-1 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 border-x border-gray-100 flex items-center justify-center gap-1"><Printer size={14} /> Bill</button>
                            <button onClick={() => cancelOrders([order], order.customerName || 'Guest')} className="flex-1 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 border-r border-gray-100 flex items-center justify-center gap-1"><X size={14} /> Cancel</button>
                            <button onClick={() => clearTable([order], order.customerName || 'Guest')} className="flex-1 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 flex items-center justify-center gap-1"><Trash2 size={14} /> Clear</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* PROFILE */}
          {activeView === 'profile' && (
            <div className="p-4 sm:p-6 max-w-lg overflow-y-auto flex-1 pb-20">
              <div className="bg-white rounded-2xl shadow-sm p-6 text-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User size={28} className="text-red-500" />
                </div>
                <h2 className="font-bold text-gray-900 text-xl">{staff.name}</h2>
                <p className="text-gray-500 text-sm">{staff.email}</p>
                {staff.waiter_number && <p className="text-red-500 font-bold mt-1">{staff.waiter_number}</p>}
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                {[
                  { label: 'Role', value: staff.role?.charAt(0).toUpperCase() + staff.role?.slice(1) },
                  { label: 'Phone', value: staff.phone || 'Not provided' },
                  { label: 'Restaurant', value: restaurant.name },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm border-b border-gray-50 pb-2">
                    <span className="text-gray-500">{row.label}</span>
                    <span className="font-medium text-gray-800">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {activeView === 'settings' && (
            <div className="p-4 sm:p-6 max-w-lg overflow-y-auto flex-1 pb-20">
              <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Printer size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Printer Settings</h2>
                    <p className="text-gray-500 text-sm">Configure Bluetooth printers</p>
                  </div>
                </div>

                {!isMobile ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-yellow-800 text-sm">
                    ⚠️ Bluetooth printing is only available in the mobile app.
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">Kitchen Printer</label>
                        <button onClick={loadBluetoothPrinters} className="text-blue-500 text-xs font-semibold flex items-center gap-1">
                          <RefreshCw size={12} /> Scan
                        </button>
                      </div>
                      <select
                        value={printerSettings.btKitchenPrinter}
                        onChange={e => handlePrinterSettingChange('btKitchenPrinter', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">— Select device —</option>
                        {btPrinters.map(p => <option key={p.address} value={p.address}>{p.name} ({p.address})</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Bill Printer</label>
                      <select
                        value={printerSettings.btBillPrinter}
                        onChange={e => handlePrinterSettingChange('btBillPrinter', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">— Select device —</option>
                        {btPrinters.map(p => <option key={p.address} value={p.address}>{p.name} ({p.address})</option>)}
                      </select>
                    </div>

                    <div className="space-y-4 pt-2">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-10 h-5 rounded-full transition-colors ${printerSettings.autoPrintKitchenBill ? 'bg-green-500' : 'bg-gray-300'}`}
                          onClick={() => handlePrinterSettingChange('autoPrintKitchenBill', !printerSettings.autoPrintKitchenBill)}>
                          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${printerSettings.autoPrintKitchenBill ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Auto-print KOT on order</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-10 h-5 rounded-full transition-colors ${printerSettings.autoPrintFinalBill ? 'bg-green-500' : 'bg-gray-300'}`}
                          onClick={() => handlePrinterSettingChange('autoPrintFinalBill', !printerSettings.autoPrintFinalBill)}>
                          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${printerSettings.autoPrintFinalBill ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Auto-print Bill on clear</span>
                      </label>
                    </div>

                    <button
                      onClick={savePrinterSettings}
                      disabled={savingSettings}
                      className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 mt-4"
                    >
                      {savingSettings ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ORDER HISTORY */}
          {activeView === 'history' && (
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 pb-20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800 text-lg">Order History</h2>
                <button onClick={fetchHistory} className="text-xs text-red-500 font-semibold flex items-center gap-1">
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 mb-4">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Search by table, item..." className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400" />
                {historySearch && <button onClick={() => setHistorySearch('')}><X size={14} className="text-gray-400" /></button>}
              </div>

              {historyLoading ? (
                <div className="flex justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
                </div>
              ) : historyOrders.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <History size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No completed orders yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {historyOrders
                    .filter(o => {
                      const q = historySearch.toLowerCase();
                      if (!q) return true;
                      return (
                        o.tableNumber?.toString().includes(q) ||
                        o.items?.some(i => i.name.toLowerCase().includes(q)) ||
                        o.customerName?.toLowerCase().includes(q) ||
                        o.orderType?.toLowerCase().includes(q)
                      );
                    })
                    .map(order => (
                      <div key={order._id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 font-bold text-sm">
                              {order.orderType === 'dine-in' ? order.tableNumber : order.orderType === 'room' ? '🛏' : order.orderType === 'takeaway' ? '🥡' : '🛵'}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm">
                                {order.orderType === 'dine-in' ? `Table ${order.tableNumber}` : order.orderType === 'room' ? (restaurant?.features?.roomNames?.[order.roomNumber] || `Room ${order.roomNumber}`) : order.orderType === 'takeaway' ? 'Takeaway' : 'Delivery'}
                              </p>
                              <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">₹{order.totalAmount}</p>
                            {order.paymentMethod && <p className="text-xs text-green-600 capitalize">{order.paymentMethod}</p>}
                          </div>
                        </div>
                        <div className="px-4 py-2 space-y-0.5">
                          {order.items?.map((item, i) => (
                            <div key={i} className="flex justify-between text-xs text-gray-600">
                              <span>{item.name} × {item.quantity}</span>
                              <span>₹{item.price * item.quantity}</span>
                            </div>
                          ))}
                        </div>
                        {order.customerName && (
                          <div className="px-4 pb-2">
                            <p className="text-xs text-gray-400">{order.customerName}</p>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* SALES REPORT */}
          {activeView === 'sales' && (
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 pb-20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2"><TrendingUp size={20} className="text-red-500" /> Sales Report</h2>
                <div className="flex items-center gap-2">
                  <select value={salesPeriod} onChange={e => { setSalesPeriod(e.target.value); fetchSales(e.target.value); }}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white">
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">This Month</option>
                    <option value="all">All Time</option>
                  </select>
                  <button onClick={() => fetchSales(salesPeriod)} className="text-xs text-red-500 font-semibold flex items-center gap-1">
                    <RefreshCw size={13} /> Refresh
                  </button>
                </div>
              </div>

              {salesLoading ? (
                <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div></div>
              ) : !salesData ? (
                <div className="text-center py-16 text-gray-400">
                  <TrendingUp size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Tap refresh to load sales</p>
                </div>
              ) : (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <div className="bg-red-500 text-white rounded-2xl p-4">
                      <p className="text-xs text-red-100">Total Revenue</p>
                      <p className="text-2xl font-bold">₹{salesData.totalRevenue.toLocaleString()}</p>
                      <p className="text-xs text-red-200 mt-0.5">{salesData.totalOrders} orders</p>
                    </div>
                    <div className="bg-green-500 text-white rounded-2xl p-4">
                      <p className="text-xs text-green-100">Cash</p>
                      <p className="text-2xl font-bold">₹{salesData.cashRevenue.toLocaleString()}</p>
                      <p className="text-xs text-green-200 mt-0.5">{salesData.cashCount} orders</p>
                    </div>
                    <div className="bg-blue-500 text-white rounded-2xl p-4">
                      <p className="text-xs text-blue-100">Online</p>
                      <p className="text-2xl font-bold">₹{salesData.onlineRevenue.toLocaleString()}</p>
                      <p className="text-xs text-blue-200 mt-0.5">{salesData.onlineCount} orders</p>
                    </div>
                    <div className="bg-purple-500 text-white rounded-2xl p-4">
                      <p className="text-xs text-purple-100">Avg Order</p>
                      <p className="text-2xl font-bold">₹{salesData.totalOrders > 0 ? Math.round(salesData.totalRevenue / salesData.totalOrders) : 0}</p>
                      <p className="text-xs text-purple-200 mt-0.5">per order</p>
                    </div>
                  </div>

                  {/* Order type breakdown */}
                  <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">By Order Type</p>
                    <div className="space-y-2">
                      {Object.entries(salesData.typeMap).map(([type, d]) => (
                        <div key={type} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{type === 'dine-in' ? '🍽' : type === 'room' ? '🛏' : type === 'takeaway' ? '🥡' : '🛵'}</span>
                            <span className="text-sm font-medium text-gray-700 capitalize">{type}</span>
                            <span className="text-xs text-gray-400">{d.count} orders</span>
                          </div>
                          <span className="font-bold text-gray-900">₹{d.revenue.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top items */}
                  <div className="bg-white rounded-2xl shadow-sm p-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Top Selling Items</p>
                    <div className="space-y-2">
                      {salesData.topItems.map(([name, d], i) => (
                        <div key={name} className="flex items-center gap-3">
                          <span className="w-5 text-xs font-bold text-gray-400 text-right">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between mb-0.5">
                              <span className="text-sm font-medium text-gray-800">{name}</span>
                              <span className="text-xs font-semibold text-gray-600">×{d.qty} · ₹{d.revenue}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(100, (d.qty / salesData.topItems[0][1].qty) * 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                      {salesData.topItems.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data for this period</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </div>{/* end content area */}
        </div>{/* end md:flex + main content */}

        {/* Bottom navigation — all screens */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-30">
          {[
            { id: 'tables', label: 'Tables', icon: UtensilsCrossed },
            { id: 'running', label: 'Orders', icon: ClipboardList, badge: totalRunningCount },
            { id: 'history', label: 'History', icon: History },
            { id: 'sales', label: 'Sales', icon: TrendingUp },
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeView === tab.id;
            return (
              <button key={tab.id} onClick={() => {
                setActiveView(tab.id);
                setSelectedTable(null);
                if (tab.id === 'history') fetchHistory();
                if (tab.id === 'sales') fetchSales(salesPeriod);
              }}
                className={`flex-1 py-3 flex flex-col items-center gap-0.5 relative ${active ? 'text-red-500' : 'text-gray-400'}`}>
                <div className="relative">
                  <Icon size={22} />
                  {tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">{tab.badge}</span>
                  )}
                </div>
                <span className="text-xs font-medium">{tab.label}</span>
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-red-500 rounded-full"></span>}
              </button>
            );
          })}
        </div>

        {/* Toast */}
        {toast && (
          <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-500' : 'bg-gray-900'}`}>
            {toast.type === 'error'
              ? <X size={14} />
              : <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            }
            {toast.msg}
          </div>
        )}

        {/* Clear Table Payment Modal */}
        {clearTablePayModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50">
            <div className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-sm p-6 pb-8 md:pb-6">
              {!onlinePayStep ? (
                <>
                  <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5"></div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Clear Table {clearTablePayModal.tableNum}</h3>
                  <p className="text-gray-500 text-sm mb-5">Select how the bill was paid</p>
                  <div className="space-y-3 mb-4">
                    <button onClick={() => { setOnlinePayStep(true); setOnlinePayType('upi'); }}
                      className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 text-left">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-lg">📱</div>
                      <div><p className="font-semibold text-gray-800">Online Payment</p><p className="text-xs text-gray-500">UPI / Net Banking</p></div>
                    </button>
                    <button onClick={() => confirmClearTable('cash', null, null)}
                      className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 text-left">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-lg">💵</div>
                      <div><p className="font-semibold text-gray-800">Cash</p><p className="text-xs text-gray-500">Paid at table</p></div>
                    </button>
                  </div>
                  <button onClick={() => setClearTablePayModal(null)} className="w-full py-2 text-sm text-gray-400">Cancel</button>
                </>
              ) : (
                <>
                  <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5"></div>
                  <button onClick={() => setOnlinePayStep(false)} className="text-sm text-gray-500 mb-4 flex items-center gap-1">← Back</button>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Online Payment</h3>
                  <div className="flex gap-2 mb-4">
                    {['upi', 'netbanking'].map(t => (
                      <button key={t} onClick={() => setOnlinePayType(t)}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 ${onlinePayType === t ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500'}`}>
                        {t === 'upi' ? 'UPI' : 'Net Banking'}
                      </button>
                    ))}
                  </div>
                  <input type="text" value={utrNumber} onChange={e => setUtrNumber(e.target.value)}
                    placeholder="UTR / Reference (optional)"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-red-400" />
                  <button onClick={() => confirmClearTable('online', onlinePayType, utrNumber)}
                    className="w-full bg-red-500 text-white py-3.5 rounded-xl font-bold hover:bg-red-600">
                    Confirm Payment
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Confirm Modal */}
        {confirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6">
              <h3 className="font-bold text-gray-900 text-lg mb-2">Confirm</h3>
              <p className="text-gray-500 text-sm mb-6">{confirmModal.message}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-gray-600">Cancel</button>
                <button onClick={confirmModal.onConfirm} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
