/**
 * Kitchen Display System (KDS)
 * Uses the same API/socket pattern as StaffDashboard — no getWebSocketUrl dependency.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { secureGet } from '../utils/secureStorage.js';

// ─── API URL (mirrors StaffDashboard) ────────────────────────────────────────
const PRODUCTION_URL = 'https://waitnot-restaurant1.onrender.com';
const _isCapacitor = typeof window !== 'undefined' && (
  window.Capacitor?.isNativePlatform?.() ||
  window.location?.protocol === 'capacitor:'
);
const _isLocalDev = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  !_isCapacitor;
// On the testing service, point to itself
const _testingHost = typeof window !== 'undefined' && window.location.hostname === 'testing-repo-waitnot.onrender.com';
const API = _isCapacitor
  ? PRODUCTION_URL
  : _testingHost
    ? 'https://testing-repo-waitnot.onrender.com'
    : _isLocalDev
      ? 'http://localhost:5001'
      : '';

// ─── Constants ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'pending',   label: 'New Orders', color: 'text-amber-600', bg: 'bg-amber-500' },
  { key: 'preparing', label: 'Preparing',  color: 'text-blue-600',  bg: 'bg-blue-500'  },
  { key: 'ready',     label: 'Ready',      color: 'text-green-600', bg: 'bg-green-500' },
  { key: 'completed', label: 'Completed',  color: 'text-gray-500',  bg: 'bg-gray-400'  },
];

const STATUS_NEXT = {
  pending:   { label: 'Start Preparing', next: 'preparing', color: 'bg-blue-600 hover:bg-blue-700'   },
  preparing: { label: 'Mark Ready',      next: 'ready',     color: 'bg-green-600 hover:bg-green-700' },
  ready:     { label: 'Mark Done',       next: 'completed', color: 'bg-gray-600 hover:bg-gray-700'   },
};

const TYPE_STYLES = {
  'dine-in':  { label: 'Dine-In',  bg: 'bg-red-100 text-red-700'       },
  'room':     { label: 'Room',     bg: 'bg-orange-100 text-orange-700'  },
  'takeaway': { label: 'Takeaway', bg: 'bg-yellow-100 text-yellow-700'  },
  'delivery': { label: 'Delivery', bg: 'bg-blue-100 text-blue-700'      },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function elapsed(dateStr) {
  if (!dateStr) return '—';
  const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (sec < 60)   return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}
function isDelayed(dateStr, min = 15) {
  return !!dateStr && Date.now() - new Date(dateStr).getTime() > min * 60 * 1000;
}

function ElapsedTimer({ dateStr }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const delayed = isDelayed(dateStr);
  return (
    <span className={`text-xs font-mono ${delayed ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
      {elapsed(dateStr)}{delayed ? ' ⚠' : ''}
    </span>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({ order, onStatus, changing, canChange }) {
  const next   = STATUS_NEXT[order.status];
  const tStyle = TYPE_STYLES[order.orderType] || TYPE_STYLES['dine-in'];
  const slot   = order.orderType === 'dine-in'  ? `Table ${order.tableNumber}`
               : order.orderType === 'room'     ? `Room ${order.roomNumber || ''}`
               : order.orderType === 'takeaway' ? 'Takeaway'
               : 'Delivery';

  return (
    <div className={`bg-white rounded-2xl shadow border-2 flex flex-col overflow-hidden
      ${order.status === 'pending'   ? 'border-amber-300'  : ''}
      ${order.status === 'preparing' ? 'border-blue-400'   : ''}
      ${order.status === 'ready'     ? 'border-green-400'  : ''}
      ${order.status === 'completed' ? 'border-gray-200'   : ''}
      ${isDelayed(order.createdAt) && order.status !== 'completed' ? 'ring-2 ring-red-400' : ''}
    `}>
      {/* Header */}
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
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tStyle.bg}`}>
            {tStyle.label}
          </span>
          <span className="text-sm font-semibold text-gray-700">{slot}</span>
        </div>
        <div className="text-right shrink-0 ml-2">
          <div className="text-xs text-gray-400">
            {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <ElapsedTimer dateStr={order.createdAt} />
        </div>
      </div>

      {/* Customer */}
      {order.customerName && (
        <div className="px-4 pt-2 text-sm text-gray-500">👤 {order.customerName}</div>
      )}

      {/* Items */}
      <div className="px-4 py-3 flex-1 space-y-1.5">
        {(order.items || []).map((item, idx) => (
          <div key={item._id || idx} className="flex justify-between items-start border-b border-gray-50 pb-1.5 last:border-0">
            <p className="text-base font-bold text-gray-900 leading-tight">{item.name}</p>
            <span className="text-lg font-black text-gray-700 ml-2 shrink-0">×{item.quantity}</span>
          </div>
        ))}
        {order.specialInstructions && (
          <div className="mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 font-medium">
            ⚠ {order.specialInstructions}
          </div>
        )}
      </div>

      {/* Action */}
      {canChange && next && (
        <div className="px-4 pb-4">
          <button
            onClick={() => onStatus(order._id, next.next)}
            disabled={changing === order._id}
            className={`w-full py-3 rounded-xl text-white font-bold text-sm transition-all active:scale-95
              ${next.color} disabled:opacity-50`}
          >
            {changing === order._id
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  Updating…
                </span>
              : next.label}
          </button>
        </div>
      )}
      {canChange && order.status === 'completed' && (
        <div className="px-4 pb-4">
          <button
            onClick={() => onStatus(order._id, 'ready')}
            disabled={changing === order._id}
            className="w-full py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            ↩ Recall
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function KitchenDisplay() {
  const navigate = useNavigate();
  const [staff, setStaff]           = useState(null);
  const [restName, setRestName]     = useState('Kitchen');
  const [orders, setOrders]         = useState([]);
  const [tab, setTab]               = useState('pending');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [sockStatus, setSockStatus] = useState('connecting');
  const [changing, setChanging]     = useState(null);
  const [soundOn, setSoundOn]       = useState(true);
  const [counts, setCounts]         = useState({ pending:0, preparing:0, ready:0, completed:0 });
  const [toast, setToast]           = useState(null);

  const axRef    = useRef(null);
  const sockRef  = useRef(null);
  const audioRef = useRef(null);
  const tabRef   = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        // Load staff auth — try SecureStorage first, fallback to localStorage
        let staffData = null, token = null;
        try {
          const raw = await secureGet('staffData');
          staffData = raw ? JSON.parse(raw) : null;
          token     = await secureGet('staffToken');
        } catch {
          staffData = JSON.parse(localStorage.getItem('staffData') || 'null');
          token     = localStorage.getItem('staffToken');
        }

        if (!staffData || !token) { navigate('/staff-login'); return; }

        const ax = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${token}` } });
        axRef.current = ax;
        setStaff(staffData);

        // Fetch restaurant name
        try {
          const { data } = await ax.get(`/api/restaurants/${staffData.restaurant_id}`);
          setRestName(data.name || 'Kitchen');
        } catch { /* non-fatal */ }

        await fetchOrders(staffData.restaurant_id, 'pending', ax);
        connectSocket(staffData.restaurant_id);
        setLoading(false);
      } catch (err) {
        console.error('KDS init:', err);
        setError('Failed to load Kitchen Display. Please go back and try again.');
        setLoading(false);
      }
    })();
    return () => { sockRef.current?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (staff) fetchOrders(staff.restaurant_id, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (rid, status, ax) => {
    const client = ax || axRef.current;
    if (!client) return;
    try {
      const { data } = await client.get(`/api/kitchen/orders/${rid}?status=${status}`);
      setOrders(data);
      refreshCounts(rid, ax);
    } catch (err) {
      console.warn('KDS fetch:', err?.response?.status, err?.message);
    }
  }, []);

  const refreshCounts = useCallback(async (rid, ax) => {
    const client = ax || axRef.current;
    if (!client) return;
    try {
      const results = await Promise.allSettled(
        ['pending','preparing','ready','completed'].map(s =>
          client.get(`/api/kitchen/orders/${rid}?status=${s}`)
        )
      );
      const c = {};
      ['pending','preparing','ready','completed'].forEach((s,i) => {
        c[s] = results[i].status === 'fulfilled' ? results[i].value.data.length : 0;
      });
      setCounts(c);
    } catch { /* non-fatal */ }
  }, []);

  // ── Socket ────────────────────────────────────────────────────────────────
  const connectSocket = useCallback((rid) => {
    const sock = io(API || window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });
    sockRef.current = sock;

    sock.on('connect',          () => { setSockStatus('connected'); sock.emit('join-restaurant', rid); fetchOrders(rid, tabRef.current); });
    sock.on('disconnect',       () => setSockStatus('offline'));
    sock.on('connect_error',    () => setSockStatus('offline'));
    sock.on('reconnect',        () => { setSockStatus('connected'); sock.emit('join-restaurant', rid); fetchOrders(rid, tabRef.current); });

    sock.on('new-order', (o) => {
      if (String(o.restaurantId) !== String(rid)) return;
      if (o.status === 'completed' || o.status === 'cancelled') return;
      if (tabRef.current === 'pending') {
        setOrders(prev => prev.find(x => x._id === o._id) ? prev : [o, ...prev]);
      }
      refreshCounts(rid);
      if (soundOn && audioRef.current) audioRef.current.play().catch(() => {});
      showToast(`New order #${String(o.orderNumber||'').padStart(3,'0')}!`, 'info');
    });

    sock.on('order-updated', (o) => {
      if (!o) return;
      setOrders(prev => {
        if (o.status === 'cancelled') return prev.filter(x => x._id !== o._id);
        const idx = prev.findIndex(x => x._id === o._id);
        if (idx === -1) return prev;
        if (o.status !== tabRef.current) return prev.filter(x => x._id !== o._id);
        const next = [...prev]; next[idx] = o; return next;
      });
      refreshCounts(rid);
    });

    sock.on('kitchen-status-update', ({ orderId, status }) => {
      setOrders(prev => {
        const idx = prev.findIndex(x => x._id === orderId);
        if (idx === -1) return prev;
        if (status !== tabRef.current) return prev.filter(x => x._id !== orderId);
        const next = [...prev]; next[idx] = { ...next[idx], status }; return next;
      });
      refreshCounts(rid);
    });

    sock.on('order-deleted',  ({ orderId }) => { setOrders(p => p.filter(o => o._id !== orderId)); refreshCounts(rid); });
    sock.on('orders-merged',  ({ orderIds }) => { setOrders(p => p.filter(o => !orderIds.includes(o._id))); refreshCounts(rid); });
  }, [soundOn, fetchOrders, refreshCounts]);

  // ── Status change ─────────────────────────────────────────────────────────
  const handleStatus = async (orderId, newStatus) => {
    if (changing === orderId) return;
    setChanging(orderId);
    try {
      await axRef.current.patch(`/api/kitchen/orders/${orderId}/status`, {
        status: newStatus, restaurantId: staff.restaurant_id,
      });
      setOrders(prev => prev.filter(o => o._id !== orderId));
      refreshCounts(staff.restaurant_id);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update', 'error');
    } finally {
      setChanging(null);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const canChange = staff?.role === 'kitchen' || staff?.role === 'manager';

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
        <p className="text-lg font-semibold">Loading Kitchen Display…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-sm text-center shadow-xl">
        <div className="text-5xl mb-4">🍳</div>
        <h2 className="text-xl font-bold mb-2 text-gray-900">Kitchen Display Error</h2>
        <p className="text-gray-500 mb-6 text-sm">{error}</p>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-700">
          ← Go Back
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col select-none">
      <audio ref={audioRef} preload="auto">
        <source src="/new-order.wav" type="audio/wav"/>
        <source src="/notification.mp3" type="audio/mpeg"/>
      </audio>

      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs font-bold text-white bg-gray-700 hover:bg-gray-600 px-2.5 py-1.5 rounded-lg">
            ← Back
          </button>
          <div>
            <h1 className="text-white font-black text-lg leading-none">🍳 Kitchen Display</h1>
            <p className="text-gray-400 text-xs">{restName} · {staff?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection */}
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
            sockStatus === 'connected' ? 'bg-green-900 text-green-300'
            : sockStatus === 'connecting' ? 'bg-yellow-900 text-yellow-300'
            : 'bg-red-900 text-red-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              sockStatus === 'connected' ? 'bg-green-400'
              : sockStatus === 'connecting' ? 'bg-yellow-400 animate-pulse'
              : 'bg-red-400'
            }`}/>
            {sockStatus === 'connected' ? 'Live' : sockStatus === 'connecting' ? 'Connecting…' : 'Offline'}
          </span>
          {/* Counts */}
          <div className="hidden sm:flex items-center gap-3">
            {TABS.filter(t => t.key !== 'completed').map(t => (
              <div key={t.key} className="text-center">
                <div className={`text-lg font-black ${counts[t.key] > 0 ? 'text-white' : 'text-gray-600'}`}>{counts[t.key]}</div>
                <div className="text-gray-500 text-xs">{t.label}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setSoundOn(v => !v)}
            className={`text-xs font-bold px-2.5 py-1.5 rounded-lg ${soundOn ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
            {soundOn ? '🔔' : '🔕'}
          </button>
          <button onClick={() => fetchOrders(staff.restaurant_id, tab)}
            className="text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600">↻</button>
          <button onClick={() => document.documentElement.requestFullscreen?.().catch(()=>{})}
            className="text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600">⛶</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 flex gap-1 shrink-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`relative flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 -mb-px transition-all ${
              tab === t.key ? `border-white ${t.color} bg-gray-800` : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>
            {t.label}
            {counts[t.key] > 0 && (
              <span className={`text-xs font-black px-1.5 py-0.5 rounded-full text-white ${t.bg}`}>{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Orders */}
      <main className="flex-1 overflow-y-auto p-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600">
            <div className="text-6xl mb-4 opacity-20">
              {tab === 'pending' ? '🆕' : tab === 'preparing' ? '🍳' : tab === 'ready' ? '✅' : '📋'}
            </div>
            <p className="text-lg font-semibold">
              {tab === 'pending' ? 'No new orders' : tab === 'preparing' ? 'Nothing preparing' : tab === 'ready' ? 'Nothing ready' : 'No completed orders'}
            </p>
            {tab === 'pending' && <p className="text-sm mt-1 text-gray-700">New orders will appear here automatically</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map(order => (
              <OrderCard key={order._id} order={order} onStatus={handleStatus} changing={changing} canChange={canChange} />
            ))}
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl text-white text-sm font-semibold ${
          toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-green-600'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
