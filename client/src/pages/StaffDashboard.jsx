import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Minus, ShoppingCart, X, Search, UtensilsCrossed, ClipboardList, User, Printer, Trash2 } from 'lucide-react';
import axios from 'axios';
import io from 'socket.io-client';
import SEO from '../components/SEO';

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('tables'); // 'tables' | 'running' | 'profile'
  const [socket, setSocket] = useState(null);

  // Order flow state
  const [selectedTable, setSelectedTable] = useState(null); // { num, orders, total }
  const [orderCart, setOrderCart] = useState([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [orderPlacing, setOrderPlacing] = useState(false);

  // Modals
  const [confirmModal, setConfirmModal] = useState(null);
  const [clearTablePayModal, setClearTablePayModal] = useState(null);
  const [onlinePayStep, setOnlinePayStep] = useState(false);
  const [onlinePayType, setOnlinePayType] = useState('upi');
  const [utrNumber, setUtrNumber] = useState('');
  const [toast, setToast] = useState(null);

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
    fetchRestaurantData(s.restaurant_id);
    fetchOrders(s.restaurant_id);
    const newSocket = io(axios.defaults.baseURL || 'http://localhost:5001', { transports: ['websocket', 'polling'] });
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

  const fetchRestaurantData = async (id) => {
    const { data } = await axios.get(`/api/restaurants/${id}`);
    setRestaurant(data);
  };

  const fetchOrders = async (id) => {
    const { data } = await axios.get(`/api/orders/restaurant/${id}`);
    setOrders(data.filter(o => o.status !== 'completed'));
    setLoading(false);
  };

  const getTableStatus = (n) => {
    const t = orders.filter(o => o.orderType === 'dine-in' && parseInt(o.tableNumber) === n);
    return t.length > 0 ? 'occupied' : 'vacant';
  };

  const getTableOrders = (n) => orders.filter(o => o.orderType === 'dine-in' && parseInt(o.tableNumber) === n);

  const getTableTotal = (tableOrders) => tableOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);

  const openTable = (n) => {
    const tableOrders = getTableOrders(n);
    setSelectedTable({ num: n, orders: tableOrders, total: getTableTotal(tableOrders) });
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

  const cartTotal = orderCart.reduce((s, i) => s + i.price * i.quantity, 0);

  const placeOrder = async () => {
    if (!selectedTable || orderCart.length === 0) return;
    setOrderPlacing(true);
    try {
      await axios.post('/api/orders', {
        restaurantId: staff.restaurant_id,
        tableNumber: selectedTable.num,
        items: orderCart.map(i => ({ menuItemId: i._id, name: i.name, price: i.price, quantity: i.quantity })),
        totalAmount: cartTotal,
        orderType: 'dine-in',
        customerName: `Waiter ${staff.waiter_number || staff.name}`,
        source: 'staff', status: 'pending', paymentStatus: 'pending', paymentMethod: 'cash',
      });
      setOrderCart([]);
      showToast('Order placed!');
      await fetchOrders(staff.restaurant_id);
      const updated = getTableOrders(selectedTable.num);
      setSelectedTable(prev => ({ ...prev, orders: updated, total: getTableTotal(updated) }));
    } catch (err) {
      showToast('Failed to place order', 'error');
    } finally {
      setOrderPlacing(false);
    }
  };

  const updateOrderStatus = async (id, status) => {
    await axios.patch(`/api/orders/${id}/status`, { status });
    fetchOrders(staff.restaurant_id);
  };

  // Print KOT
  const printKOT = (order) => {
    const d = new Date().toLocaleDateString('en-IN'), t = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const html = `<!DOCTYPE html><html><head><style>body{font-family:'Courier New',monospace;font-size:12px;margin:0;padding:10px;max-width:300px}.c{text-align:center}.b{font-weight:bold}.r{display:flex;justify-content:space-between;margin-bottom:3px}.d{border-top:1px dashed #000;margin:8px 0}</style></head><body><div class="c b" style="font-size:15px">${restaurant?.name?.toUpperCase()}</div><div class="c b">KOT</div><div class="d"></div><div class="r"><span>Order:</span><span>${order._id.slice(-6).toUpperCase()}</span></div>${order.tableNumber ? `<div class="r"><span>Table:</span><span><b>${order.tableNumber}</b></span></div>` : ''}<div class="r"><span>Time:</span><span>${d} ${t}</span></div><div class="d"></div>${order.items.map(i => `<div class="r"><span>${i.name}</span><span>x${i.quantity}</span></div>`).join('')}<div class="d"></div><div class="c" style="font-size:10px">PREPARE WITH CARE</div></body></html>`;
    const w = window.open('', '_blank', 'width=400,height=500');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => { w.print(); setTimeout(() => w.close(), 250); }, 400); }
  };

  const printBill = (tableOrders, tableNum, total) => {
    const d = new Date().toLocaleDateString('en-IN'), t = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const items = {};
    tableOrders.forEach(o => o.items.forEach(i => {
      if (items[i.name]) { items[i.name].qty += i.quantity; items[i.name].total += i.price * i.quantity; }
      else items[i.name] = { qty: i.quantity, total: i.price * i.quantity };
    }));
    const html = `<!DOCTYPE html><html><head><style>body{font-family:'Courier New',monospace;font-size:12px;margin:0;padding:10px;max-width:300px}.c{text-align:center}.b{font-weight:bold}.r{display:flex;justify-content:space-between;margin-bottom:3px}.d{border-top:1px dashed #000;margin:8px 0}</style></head><body><div class="c b" style="font-size:15px">${restaurant?.name?.toUpperCase()}</div><div class="c">TABLE BILL</div><div class="d"></div><div class="r"><span>Table:</span><span><b>${tableNum}</b></span></div><div class="r"><span>Date:</span><span>${d} ${t}</span></div><div class="d"></div>${Object.entries(items).map(([n, d]) => `<div class="r"><span>${n} x${d.qty}</span><span>₹${d.total}</span></div>`).join('')}<div class="d"></div><div class="r b"><span>TOTAL</span><span>₹${total}</span></div><div class="d"></div><div class="c" style="font-size:10px;margin-top:8px">Thank you!</div></body></html>`;
    const w = window.open('', '_blank', 'width=400,height=500');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => { w.print(); setTimeout(() => w.close(), 250); }, 400); }
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
          for (const o of tableOrders) {
            await axios.patch(`/api/orders/${o._id}/payment`, { paymentMethod, paymentSubType: subType || null, utrNumber: utr || null });
            if (o.status !== 'completed') await updateOrderStatus(o._id, 'completed');
          }
          setSelectedTable(null);
          showToast('Table cleared');
          await fetchOrders(staff.restaurant_id);
        } catch (err) {
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

  // Running orders (waiter's table orders for Orders view)
  const runningTables = Object.entries(
    orders.filter(o => o.orderType === 'dine-in' && o.tableNumber)
      .reduce((acc, o) => { const t = o.tableNumber; if (!acc[t]) acc[t] = []; acc[t].push(o); return acc; }, {})
  );

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
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0 md:flex md:min-h-0">

          {/* Sidebar nav — desktop */}
          <div className="hidden md:flex md:flex-col md:w-56 md:shrink-0 bg-white border-r border-gray-200 sticky top-[57px] h-[calc(100vh-57px)]">
            {[
              { id: 'tables', label: 'Tables', icon: UtensilsCrossed },
              { id: 'running', label: 'Orders', icon: ClipboardList, badge: runningTables.length },
              { id: 'profile', label: 'Profile', icon: User },
            ].map(tab => {
              const Icon = tab.icon;
              const active = activeView === tab.id;
              return (
                <button key={tab.id} onClick={() => { setActiveView(tab.id); setSelectedTable(null); }}
                  className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-colors text-left relative ${active ? 'bg-red-50 text-red-600 border-r-2 border-red-500' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <div className="relative">
                    <Icon size={20} />
                    {tab.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">{tab.badge}</span>
                    )}
                  </div>
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content area */}
          <div className="flex-1 min-w-0 flex flex-col">

          {/* TABLE FLOOR VIEW */}
          {activeView === 'tables' && !selectedTable && (
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800 text-lg">Floor Plan</h2>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-400 inline-block"></span>Vacant</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-400 inline-block"></span>Occupied</span>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {Array.from({ length: tableCount }, (_, i) => i + 1).map(n => {
                  const status = getTableStatus(n);
                  const tOrders = getTableOrders(n);
                  const tTotal = getTableTotal(tOrders);
                  const isOccupied = status === 'occupied';
                  return (
                    <button
                      key={n}
                      onClick={() => openTable(n)}
                      className={`relative rounded-2xl p-4 border-2 flex flex-col items-center transition-all active:scale-95 ${
                        isOccupied
                          ? 'bg-red-50 border-red-300 shadow-sm'
                          : 'bg-green-50 border-green-300'
                      }`}
                    >
                      <UtensilsCrossed size={20} className={isOccupied ? 'text-red-400 mb-1' : 'text-green-400 mb-1'} />
                      <span className={`text-xl font-bold ${isOccupied ? 'text-red-700' : 'text-green-700'}`}>{n}</span>
                      <span className={`text-xs mt-0.5 ${isOccupied ? 'text-red-500' : 'text-green-500'}`}>
                        {isOccupied ? 'Occupied' : 'Vacant'}
                      </span>
                      {isOccupied && (
                        <span className="text-xs font-semibold text-red-600 mt-1">₹{tTotal}</span>
                      )}
                      {isOccupied && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TABLE DETAIL / ORDER TAKING */}
          {activeView === 'tables' && selectedTable && (
            <div className="flex flex-col h-full">
              {/* Table header */}
              <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
                <button onClick={() => setSelectedTable(null)} className="text-gray-500 hover:text-gray-700 p-1">
                  <X size={20} />
                </button>
                <div className="flex-1">
                  <h2 className="font-bold text-gray-900">Table {selectedTable.num}</h2>
                  <p className="text-xs text-gray-500">{selectedTable.orders.length} order(s) · ₹{getTableTotal(getTableOrders(selectedTable.num))}</p>
                </div>
                {/* Action buttons for occupied tables */}
                {getTableOrders(selectedTable.num).length > 0 && (
                  <div className="flex gap-2">
                    <button onClick={() => getTableOrders(selectedTable.num).forEach(o => printKOT(o))} className="p-2 bg-orange-100 text-orange-600 rounded-lg text-xs font-medium">KOT</button>
                    <button onClick={() => { const t = getTableOrders(selectedTable.num); printBill(t, selectedTable.num, getTableTotal(t)); }} className="p-2 bg-blue-100 text-blue-600 rounded-lg text-xs font-medium">Bill</button>
                    <button onClick={() => clearTable(getTableOrders(selectedTable.num), selectedTable.num)} className="p-2 bg-red-100 text-red-600 rounded-lg text-xs font-medium">Clear</button>
                  </div>
                )}
              </div>

              {/* Current orders for this table */}
              {getTableOrders(selectedTable.num).length > 0 && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-700 mb-2">Running Order</p>
                  {(() => {
                    const items = {};
                    getTableOrders(selectedTable.num).forEach(o => o.items.forEach(i => {
                      if (items[i.name]) items[i.name].qty += i.quantity;
                      else items[i.name] = { qty: i.quantity, price: i.price };
                    }));
                    return Object.entries(items).map(([name, d]) => (
                      <div key={name} className="flex justify-between text-sm text-gray-700">
                        <span>{name} × {d.qty}</span><span>₹{d.price * d.qty}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* Category tabs */}
              <div className="bg-white border-b border-gray-100 px-3 py-2 flex gap-2 overflow-x-auto hide-scrollbar sticky top-0 z-10">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="bg-white px-3 py-2 border-b border-gray-100">
                <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <input value={menuSearch} onChange={e => setMenuSearch(e.target.value)} placeholder="Search menu..." className="bg-transparent text-sm flex-1 outline-none text-gray-700 placeholder-gray-400" />
                  {menuSearch && <button onClick={() => setMenuSearch('')}><X size={14} className="text-gray-400" /></button>}
                </div>
              </div>

              {/* Menu list */}
              <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pb-48 md:pb-24 content-start">
                {filteredMenu.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No items found</p>}
                {filteredMenu.map(item => {
                  const inCart = orderCart.find(c => c._id === item._id);
                  return (
                    <div key={item._id} className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.category} · {item.isVeg ? '🟢' : '🔴'}</p>
                        <p className="text-red-500 font-bold text-sm mt-0.5">₹{item.price}</p>
                      </div>
                      {inCart ? (
                        <div className="flex items-center gap-2 bg-red-50 rounded-xl px-2 py-1">
                          <button onClick={() => updateQty(item._id, inCart.quantity - 1)} className="w-7 h-7 bg-red-500 text-white rounded-lg flex items-center justify-center"><Minus size={12} /></button>
                          <span className="text-sm font-bold text-red-700 w-5 text-center">{inCart.quantity}</span>
                          <button onClick={() => updateQty(item._id, inCart.quantity + 1)} className="w-7 h-7 bg-red-500 text-white rounded-lg flex items-center justify-center"><Plus size={12} /></button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(item)} className="bg-red-500 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-red-600 flex items-center gap-1">
                          <Plus size={14} /> Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Place Order bar */}
              {orderCart.length > 0 && (
                <div className="sticky bottom-0 md:relative px-4 py-3 bg-white border-t border-gray-200 z-20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">{orderCart.reduce((s, i) => s + i.quantity, 0)} item(s)</span>
                    <span className="font-bold text-gray-900">₹{cartTotal}</span>
                  </div>
                  <button onClick={placeOrder} disabled={orderPlacing}
                    className="w-full bg-red-500 text-white py-3 rounded-xl font-bold text-base hover:bg-red-600 disabled:opacity-50 transition-colors">
                    {orderPlacing ? 'Placing Order...' : `Place Order · ₹${cartTotal}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* RUNNING ORDERS */}
          {activeView === 'running' && (
            <div className="p-4 sm:p-6">
              <h2 className="font-bold text-gray-800 text-lg mb-4">Running Orders</h2>
              {runningTables.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No active orders</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      <button onClick={() => tableOrders.forEach(o => printKOT(o))} className="flex-1 py-2.5 text-xs font-semibold text-orange-600 hover:bg-orange-50 flex items-center justify-center gap-1">
                        <Printer size={14} /> KOT
                      </button>
                      <button onClick={() => printBill(tableOrders, tableNum, total)} className="flex-1 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 border-x border-gray-100 flex items-center justify-center gap-1">
                        <Printer size={14} /> Bill
                      </button>
                      <button onClick={() => clearTable(tableOrders, parseInt(tableNum))} className="flex-1 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 flex items-center justify-center gap-1">
                        <Trash2 size={14} /> Clear
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* PROFILE */}
          {activeView === 'profile' && (
            <div className="p-4 sm:p-6 max-w-lg">
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
        </div>{/* end content area */}
        </div>{/* end md:flex + main content */}

        {/* Bottom navigation — mobile only */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-30">
          {[
            { id: 'tables', label: 'Tables', icon: UtensilsCrossed },
            { id: 'running', label: 'Orders', icon: ClipboardList, badge: runningTables.length },
            { id: 'profile', label: 'Profile', icon: User },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeView === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveView(tab.id); setSelectedTable(null); }}
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
