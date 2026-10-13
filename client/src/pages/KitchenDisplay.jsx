/**
 * Kitchen Display System (KDS)
 *
 * Standalone page for kitchen staff. Uses existing socket infrastructure
 * (restaurant-{id} room, new-order / order-updated / kitchen-status-update events).
 * Does NOT change invoice numbers, payments, or analytics.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { getWebSocketUrl } from '../config/environment.js';
import { secureGet } from '../utils/secureStorage.js';

// ─── Constants ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'pending',   label: 'New Orders',  color: 'text-amber-600',  bg: 'bg-amber-500' },
  { key: 'preparing', label: 'Preparing',   color: 'text-blue-600',   bg: 'bg-blue-500'  },
  { key: 'ready',     label: 'Ready',       color: 'text-green-600',  bg: 'bg-green-500' },
  { key: 'completed', label: 'Completed',   color: 'text-gray-500',   bg: 'bg-gray-400'  },
];

const STATUS_NEXT = {
  pending:   { label: 'Start Preparing', next: 'preparing', color: 'bg-blue-600 hover:bg-blue-700'  },
  preparing: { label: 'Mark Ready',      next: 'ready',     color: 'bg-green-600 hover:bg-green-700' },
  ready:     { label: 'Mark Done',       next: 'completed', color: 'bg-gray-600 hover:bg-gray-700'  },
};

const ORDER_TYPE_LABELS = {
  'dine-in':  { label: 'Dine-In',  bg: 'bg-red-100 text-red-700'    },
  'room':     { label: 'Room',     bg: 'bg-orange-100 text-orange-700' },
  'takeaway': { label: 'Takeaway', bg: 'bg-yellow-100 text-yellow-700' },
  'delivery': { label: 'Delivery', bg: 'bg-blue-100 text-blue-700'   },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function elapsed(dateStr) {
  if (!dateStr) return '—';
  const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (sec < 60)  return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function isDelayed(dateStr, thresholdMin = 15) {
  if (!dateStr) return false;
  return (Date.now() - new Date(dateStr).getTime()) > thresholdMin * 60 * 1000;
}

// ─── ElapsedTimer — updates every second without re-fetching orders ──────────
function ElapsedTimer({ dateStr, thresholdMin = 15 }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const delayed = isDelayed(dateStr, thresholdMin);
  return (
    <span className={`text-xs font-mono ${delayed ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
      {elapsed(dateStr)}{delayed ? ' ⚠ Delayed' : ''}
    </span>
  );
}

// ─── OrderCard ───────────────────────────────────────────────────────────────
function OrderCard({ order, onStatusChange, changing }) {
  const next      = STATUS_NEXT[order.status];
  const typeStyle = ORDER_TYPE_LABELS[order.orderType] || ORDER_TYPE_LABELS['dine-in'];
  const slotLabel = order.orderType === 'dine-in'  ? `Table ${order.tableNumber}`
    : order.orderType === 'room'                   ? `Room ${order.roomNumber || ''}`
    : order.orderType === 'takeaway'               ? 'Takeaway'
    : 'Delivery';

  return (
    <div className={`bg-white rounded-2xl shadow-md border-2 flex flex-col overflow-hidden transition-all
      ${order.status === 'pending'   ? 'border-amber-300'  : ''}
      ${order.status === 'preparing' ? 'border-blue-400'   : ''}
      ${order.status === 'ready'     ? 'border-green-400'  : ''}
      ${order.status === 'completed' ? 'border-gray-200'   : ''}
      ${isDelayed(order.createdAt) && order.status !== 'completed' ? 'ring-2 ring-red-400' : ''}
    `}>
      {/* Card header */}
      <div className={`px-4 py-3 flex items-center justify-between
        ${order.status === 'pending'   ? 'bg-amber-50'  : ''}
        ${order.status === 'preparing' ? 'bg-blue-50'   : ''}
        ${order.status === 'ready'     ? 'bg-green-50'  : ''}
        ${order.status === 'completed' ? 'bg-gray-50'   : ''}
      `}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xl font-black text-gray-900">
            #{String(order.orderNumber || '—').padStart(3, '0')}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${typeStyle.bg}`}>
            {typeStyle.label}
          </span>
          <span className="text-sm font-semibold text-gray-700">{slotLabel}</span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-gray-500">
            {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <ElapsedTimer dateStr={order.createdAt} />
        </div>
      </div>

      {/* Customer name */}
      {order.customerName && (
        <div className="px-4 pt-2 text-sm text-gray-600 font-medium">
          👤 {order.customerName}
        </div>
      )}

      {/* Items */}
      <div className="px-4 py-3 flex-1 space-y-2">
        {(order.items || []).map((item, idx) => (
          <div key={item._id || idx}
            className="flex items-start justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-gray-900 leading-tight">{item.name}</p>
            </div>
            <span className="text-lg font-black text-gray-800 shrink-0">× {item.quantity}</span>
          </div>
        ))}

        {/* Special instructions */}
        {order.specialInstructions && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 font-medium">
            ⚠ {order.specialInstructions}
          </div>
        )}
      </div>

      {/* Action button */}
      {next && (
        <div className="px-4 pb-4">
          <button
            onClick={() => onStatusChange(order._id, next.next)}
            disabled={changing === order._id}
            className={`w-full py-3 rounded-xl text-white font-bold text-base transition-all
              ${next.color} disabled:opacity-60 disabled:cursor-not-allowed
              active:scale-95`}
          >
            {changing === order._id
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating…
                </span>
              : next.label}
          </button>
        </div>
      )}

      {/* Recall button for completed (manager view) */}
      {order.status === 'completed' && (
        <div className="px-4 pb-4">
          <button
            onClick={() => onStatusChange(order._id, 'ready')}
            disabled={changing === order._id}
            className="w-full py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold
              hover:bg-gray-50 disabled:opacity-60 active:scale-95 transition-all"
          >
            ↩ Recall to Ready
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main KitchenDisplay page ─────────────────────────────────────────────────
export default function KitchenDisplay() {
  const navigate      = useNavigate();
  const [staff, setStaff]             = useState(null);
  const [restaurantName, setRestName] = useState('Kitchen');
  const [orders, setOrders]           = useState([]);
  const [activeTab, setActiveTab]     = useState('pending');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [socketStatus, setSocketStatus] = useState('connecting'); // connecting|connected|offline
  const [changing, setChanging]       = useState(null); // orderId being updated
  const [soundOn, setSoundOn]         = useState(true);
  const [counts, setCounts]           = useState({ pending: 0, preparing: 0, ready: 0, completed: 0 });
  const [toast, setToast]             = useState(null);

  const socketRef    = useRef(null);
  const audioRef     = useRef(null);
  const axiosRef     = useRef(null);

  // ── Auth & init ────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        // Load staff data — try localStorage first, then SecureStorage
        let staffData = null;
        let token     = null;
        try {
          const raw = await secureGet('staffData');
          staffData  = raw ? JSON.parse(raw) : null;
          token      = await secureGet('staffToken');
        } catch {
          staffData = JSON.parse(localStorage.getItem('staffData') || 'null');
          token     = localStorage.getItem('staffToken');
        }

        if (!staffData || !token) {
          navigate('/staff-login');
          return;
        }

        // Kitchen or manager only
        if (staffData.role !== 'kitchen' && staffData.role !== 'manager') {
          setError('KDS requires kitchen or manager role.');
          setLoading(false);
          return;
        }

        // Configure axios auth header
        axiosRef.current = axios.create({
          headers: { Authorization: `Bearer ${token}` }
        });

        setStaff(staffData);

        // Fetch restaurant name
        try {
          const { data } = await axiosRef.current.get(`/api/restaurants/${staffData.restaurant_id}`);
          setRestName(data.name || 'Kitchen');
        } catch { /* non-fatal */ }

        // Fetch initial orders
        await fetchOrders(staffData.restaurant_id, activeTab);

        // Connect socket
        connectSocket(staffData.restaurant_id, token);

        setLoading(false);
      } catch (err) {
        console.error('KDS init error:', err);
        setError('Failed to initialize Kitchen Display. Please try again.');
        setLoading(false);
      }
    };
    init();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when tab changes
  useEffect(() => {
    if (staff) fetchOrders(staff.restaurant_id, activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Fetch orders ───────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (restaurantId, status) => {
    try {
      const ax = axiosRef.current;
      if (!ax) return;
      const { data } = await ax.get(`/api/kitchen/orders/${restaurantId}?status=${status}`);
      setOrders(data);
      // Also refresh counts for all tabs
      refreshCounts(restaurantId);
    } catch (err) {
      console.error('KDS fetchOrders error:', err);
      showToast('Failed to refresh orders', 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshCounts = useCallback(async (restaurantId) => {
    try {
      const ax = axiosRef.current;
      if (!ax) return;
      const statuses = ['pending', 'preparing', 'ready', 'completed'];
      const results  = await Promise.allSettled(
        statuses.map(s => ax.get(`/api/kitchen/orders/${restaurantId}?status=${s}`))
      );
      const newCounts = {};
      results.forEach((r, i) => {
        newCounts[statuses[i]] = r.status === 'fulfilled' ? r.value.data.length : 0;
      });
      setCounts(newCounts);
    } catch { /* non-fatal */ }
  }, []);

  // ── Socket ─────────────────────────────────────────────────────────────────
  const connectSocket = useCallback((restaurantId) => {
    const wsUrl = getWebSocketUrl();
    const sock = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = sock;

    sock.on('connect', () => {
      setSocketStatus('connected');
      sock.emit('join-restaurant', restaurantId);
      // Re-fetch on reconnect to catch missed events
      fetchOrders(restaurantId, activeTabRef.current);
    });

    sock.on('disconnect', () => setSocketStatus('offline'));
    sock.on('connect_error', () => setSocketStatus('offline'));
    sock.on('reconnect', () => setSocketStatus('connected'));

    // New order arrived from any source (POS, QR, staff, delivery)
    sock.on('new-order', (order) => {
      if (String(order.restaurantId) !== String(restaurantId)) return;
      if (order.status === 'completed' || order.status === 'cancelled') return;

      setOrders(prev => {
        if (prev.find(o => o._id === order._id)) return prev; // dedup
        return [order, ...prev];
      });
      refreshCounts(restaurantId);

      // Sound alert
      if (soundOn && audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
      showToast(`New order #${String(order.orderNumber || '').padStart(3,'0')} received!`, 'info');
    });

    // Status updated (from RestaurantDashboard or another KDS client)
    sock.on('order-updated', (order) => {
      if (!order) return;
      setOrders(prev => {
        if (order.status === 'cancelled') return prev.filter(o => o._id !== order._id);
        const idx = prev.findIndex(o => o._id === order._id);
        if (idx === -1) return prev;
        // If the updated order no longer matches the active tab, remove it from the view
        if (order.status !== activeTabRef.current) return prev.filter(o => o._id !== order._id);
        const next = [...prev];
        next[idx] = order;
        return next;
      });
      refreshCounts(restaurantId);
    });

    // KDS-specific status update (from another KDS client)
    sock.on('kitchen-status-update', ({ orderId, status }) => {
      setOrders(prev => {
        if (status === 'cancelled') return prev.filter(o => o._id !== orderId);
        const idx = prev.findIndex(o => o._id === orderId);
        if (idx === -1) return prev;
        if (status !== activeTabRef.current) return prev.filter(o => o._id !== orderId);
        const next = [...prev];
        next[idx] = { ...next[idx], status };
        return next;
      });
      refreshCounts(restaurantId);
    });

    // Order deleted/archived
    sock.on('order-deleted', ({ orderId }) => {
      setOrders(prev => prev.filter(o => o._id !== orderId));
      refreshCounts(restaurantId);
    });

    // Merged (table cleared) — remove originals
    sock.on('orders-merged', ({ orderIds }) => {
      setOrders(prev => prev.filter(o => !orderIds.includes(o._id)));
      refreshCounts(restaurantId);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundOn]);

  // Keep activeTab accessible inside socket callbacks without recreating them
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // ── Status change ──────────────────────────────────────────────────────────
  const handleStatusChange = async (orderId, newStatus) => {
    if (changing === orderId) return;
    setChanging(orderId);
    try {
      const ax = axiosRef.current;
      await ax.patch(`/api/kitchen/orders/${orderId}/status`, {
        status:       newStatus,
        restaurantId: staff.restaurant_id,
      });
      // Remove from current tab (socket will handle propagation to other clients)
      setOrders(prev => prev.filter(o => o._id !== orderId));
      refreshCounts(staff.restaurant_id);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update status', 'error');
    } finally {
      setChanging(null);
    }
  };

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg font-semibold">Loading Kitchen Display…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="bg-red-900/60 text-white rounded-2xl p-8 max-w-md text-center">
          <div className="text-5xl mb-4">🍳</div>
          <h2 className="text-xl font-bold mb-2">Kitchen Display Error</h2>
          <p className="text-red-200 mb-6">{error}</p>
          <button onClick={() => navigate('/staff-login')}
            className="px-6 py-3 bg-white text-gray-900 rounded-xl font-bold hover:bg-gray-100">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col select-none">
      {/* Hidden audio element for new order alerts */}
      <audio ref={audioRef} preload="auto">
        <source src="/notification.mp3" type="audio/mpeg" />
      </audio>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
        {/* Left: back + title */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs font-bold text-white bg-gray-700 hover:bg-gray-600 px-2.5 py-1.5 rounded-lg">
            ← Back
          </button>
          <div>
            <h1 className="text-white font-black text-lg leading-none">Kitchen Display</h1>
            <p className="text-gray-400 text-xs">{restaurantName}</p>
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
            socketStatus === 'connected' ? 'bg-green-900 text-green-300'
            : socketStatus === 'connecting' ? 'bg-yellow-900 text-yellow-300'
            : 'bg-red-900 text-red-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              socketStatus === 'connected' ? 'bg-green-400'
              : socketStatus === 'connecting' ? 'bg-yellow-400 animate-pulse'
              : 'bg-red-400'
            }`} />
            {socketStatus === 'connected' ? 'Live' : socketStatus === 'connecting' ? 'Connecting…' : 'Offline'}
          </div>

          {/* Order counts summary */}
          <div className="hidden sm:flex items-center gap-2">
            {TABS.filter(t => t.key !== 'completed').map(t => (
              <div key={t.key} className="text-center">
                <div className={`text-lg font-black ${counts[t.key] > 0 ? 'text-white' : 'text-gray-600'}`}>
                  {counts[t.key]}
                </div>
                <div className="text-gray-500 text-xs leading-none">{t.label}</div>
              </div>
            ))}
          </div>

          {/* Sound toggle */}
          <button onClick={() => setSoundOn(v => !v)}
            className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
              soundOn ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-400'
            }`}
            title={soundOn ? 'Sound ON' : 'Sound OFF'}>
            {soundOn ? '🔔' : '🔕'}
          </button>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen}
            className="text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600">
            ⛶
          </button>

          {/* Refresh */}
          <button onClick={() => fetchOrders(staff.restaurant_id, activeTab)}
            className="text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600"
            title="Refresh">
            ↻
          </button>
        </div>
      </header>

      {/* ── STATUS TABS ────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 flex gap-1 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all border-b-2 -mb-px ${
              activeTab === tab.key
                ? `border-white ${tab.color} bg-gray-800`
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className={`text-xs font-black px-1.5 py-0.5 rounded-full text-white ${tab.bg}`}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ORDER GRID ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600">
            <div className="text-6xl mb-4 opacity-30">
              {activeTab === 'pending'   ? '🆕'
               : activeTab === 'preparing' ? '🍳'
               : activeTab === 'ready'     ? '✅'
               : '📋'}
            </div>
            <p className="text-lg font-semibold">
              {activeTab === 'pending'   ? 'No new orders'
               : activeTab === 'preparing' ? 'Nothing preparing'
               : activeTab === 'ready'     ? 'Nothing ready yet'
               : 'No recent completed orders'}
            </p>
            <p className="text-sm mt-1 text-gray-700">
              {activeTab === 'pending' ? 'New orders will appear here automatically' : ''}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {orders.map(order => (
              <OrderCard
                key={order._id}
                order={order}
                onStatusChange={handleStatusChange}
                changing={changing}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── TOAST ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl text-white text-sm font-semibold flex items-center gap-2 ${
          toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-green-600'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
