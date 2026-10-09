import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Trash2, Search, X } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

const Analytics = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('week');
  const [analytics, setAnalytics] = useState({});
  const [showOrdersTable, setShowOrdersTable] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm }
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveOrders, setArchiveOrders] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      if (!restaurantId) return;

      const [ordersRes, restaurantRes] = await Promise.all([
        axios.get(`/api/orders/restaurant/${restaurantId}`),
        axios.get(`/api/restaurants/${restaurantId}`)
      ]);

      setOrders(ordersRes.data);
      setRestaurant(restaurantRes.data);
      
      // Try to get analytics from API, fallback to local calculation
      try {
        const analyticsRes = await axios.get(`/api/analytics/restaurant/${restaurantId}?period=${dateRange}`);
        const analyticsData = analyticsRes.data;
        console.log('Analytics data received from API:', analyticsData);
        
        setAnalytics({
          totalOrders: analyticsData.metrics?.totalOrders || 0,
          totalRevenue: analyticsData.metrics?.totalRevenue || 0,
          avgOrderValue: analyticsData.metrics?.avgOrderValue || 0,
          completionRate: analyticsData.metrics?.completionRate || 0,
          revenueGrowth: analyticsData.metrics?.revenueGrowth || 0,
          statusBreakdown: analyticsData.breakdowns?.status || [],
          paymentBreakdown: analyticsData.breakdowns?.payment || [],
          typeBreakdown: analyticsData.breakdowns?.type || [],
          dailyRevenue: analyticsData.trends?.dailyRevenue || [],
          popularItems: analyticsData.insights?.popularItems || [],
          hourlyData: analyticsData.trends?.hourlyData || [],
          peakHourRange: analyticsData.trends?.peakHourRange || 'N/A',
          repeatCustomerRate: analyticsData.insights?.repeatCustomerRate || 0,
          totalCustomers: analyticsData.insights?.totalCustomers || 0
        });
      } catch (apiError) {
        console.log('Analytics API not available, calculating locally:', apiError.message);
        // Fallback to local calculation
        calculateAnalytics(ordersRes.data);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const calculateAnalytics = (ordersData = orders) => {
    console.log('Calculating analytics locally with', ordersData.length, 'orders');
    
    const now = new Date();
    let startDate;

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      default:
        startDate = new Date(0);
    }

    const filteredOrders = ordersData.filter(order => 
      new Date(order.createdAt) >= startDate
    );

    console.log('Filtered orders:', filteredOrders.length, 'for period:', dateRange);

    // Basic metrics
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const completedOrders = filteredOrders.filter(order => order.status === 'completed').length;
    const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    console.log('Basic metrics:', { totalOrders, totalRevenue, avgOrderValue, completionRate });

    // Order status breakdown
    const statusBreakdown = filteredOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    // Payment method breakdown
    const paymentBreakdown = filteredOrders.reduce((acc, order) => {
      const method = order.paymentMethod || 'cash';
      if (!acc[method]) acc[method] = { count: 0, revenue: 0 };
      acc[method].count += 1;
      acc[method].revenue += parseFloat(order.totalAmount || order.total || 0);
      return acc;
    }, {});

    // Order type breakdown
    const typeBreakdown = filteredOrders.reduce((acc, order) => {
      const type = order.orderType || order.type || 'dine-in';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Daily revenue (last 30 days)
    const dailyRevenue = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayOrders = ordersData.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate.toDateString() === date.toDateString();
      });
      const revenue = dayOrders.reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0);
      dailyRevenue.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue,
        orders: dayOrders.length
      });
    }

    // Popular items
    const itemCounts = {};
    filteredOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.quantity || 1);
        });
      }
    });

    const popularItems = Object.entries(itemCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, quantity]) => ({ name, quantity }));

    // Hourly distribution
    const hourlyOrders = Array(24).fill(0);
    filteredOrders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      hourlyOrders[hour]++;
    });

    const hourlyData = hourlyOrders.map((count, hour) => ({
      hour: `${hour}:00`,
      orders: count
    }));

    // Peak hours
    const peakHour = hourlyOrders.indexOf(Math.max(...hourlyOrders));
    const peakHourRange = `${peakHour}:00 - ${peakHour + 1}:00`;

    // Customer insights
    const customerOrders = {};
    filteredOrders.forEach(order => {
      if (order.customerPhone) {
        customerOrders[order.customerPhone] = (customerOrders[order.customerPhone] || 0) + 1;
      }
    });

    const repeatCustomers = Object.values(customerOrders).filter(count => count > 1).length;
    const totalCustomers = Object.keys(customerOrders).length;
    const repeatCustomerRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

    console.log('Setting analytics:', {
      totalOrders,
      totalRevenue,
      avgOrderValue,
      completionRate,
      popularItems: popularItems.slice(0, 3),
      repeatCustomerRate,
      totalCustomers
    });

    setAnalytics({
      totalOrders,
      totalRevenue,
      avgOrderValue,
      completionRate,
      revenueGrowth: 0, // Can't calculate without previous period data
      statusBreakdown: Object.entries(statusBreakdown).map(([status, count]) => ({ status, count })),
      paymentBreakdown: Object.entries(paymentBreakdown).map(([method, data]) => ({ method, count: data.count, revenue: Math.round(data.revenue) })),
      typeBreakdown: Object.entries(typeBreakdown).map(([type, count]) => ({ type, count })),
      dailyRevenue,
      popularItems,
      hourlyData,
      peakHourRange,
      repeatCustomerRate,
      totalCustomers
    });
  };

  const deleteOrder = (orderId) => {
    setConfirmModal({
      message: 'Delete this order permanently? This cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(null);
        setDeletingId(orderId);
        try {
          await axios.delete(`/api/orders/${orderId}`);
          setOrders(prev => prev.filter(o => o._id !== orderId));
        } catch (e) {
          alert('Failed to delete order.');
        } finally {
          setDeletingId(null);
        }
      }
    });
  };

  const downloadReport = (type) => {
    const restaurantId = localStorage.getItem('restaurantId');
    setConfirmModal({
      message: `Download ${type} report? Click "Also Clear" to also clear completed order history after download.`,
      cancelLabel: 'Just Download',
      confirmLabel: 'Download + Clear History',
      onCancel: async () => {
        setConfirmModal(null);
        await doDownload(type, restaurantId, false);
      },
      onConfirm: async () => {
        setConfirmModal(null);
        await doDownload(type, restaurantId, true);
      }
    });
  };

  const doDownload = async (type, restaurantId, clearHistory) => {
    try {
      try {
        const response = await axios.get(`/api/analytics/restaurant/${restaurantId}/report?type=${type}&format=csv&clearHistory=${clearHistory}`, { responseType: 'blob' });
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${restaurant?.name || 'Restaurant'}_${type}_Report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        if (clearHistory) await fetchData();
      } catch {
        const reportData = generateReportData(type);
        const csvContent = convertToCSV(reportData);
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${restaurant?.name || 'Restaurant'}_${type}_Report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        if (clearHistory) {
          try { await axios.delete(`/api/analytics/restaurant/${restaurantId}/history?type=completed`); await fetchData(); } catch {}
        }
      }
    } catch (error) {
      console.error('Error downloading report:', error);
    }
  };

  const clearOrderHistory = () => {
    const count = orders.filter(o => o.status === 'completed').length;
    setConfirmModal({
      message: `Clear all ${count} completed orders from history? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const restaurantId = localStorage.getItem('restaurantId');
          await axios.delete(`/api/analytics/restaurant/${restaurantId}/history?type=completed`);
          await fetchData();
        } catch (error) {
          console.error('Error clearing order history:', error);
        }
      }
    });
  };

  const generateReportData = (type) => {
    const now = new Date();
    let startDate, endDate = now;
    switch (type) {
      case 'today': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case 'weekly': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'monthly': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'yearly': startDate = new Date(now.getFullYear(), 0, 1); break;
      default: startDate = new Date(0);
    }
    return orders.filter(o => new Date(o.createdAt) >= startDate && new Date(o.createdAt) <= endDate).map((order, idx) => {
      const subtotal   = (order.items || []).reduce((s, i) => s + (parseFloat(i.price)||0) * (parseInt(i.quantity)||1), 0);
      const discount   = parseFloat(order.discountAmount || 0);
      const taxableVal = Math.max(0, subtotal - discount);
      const cgst       = parseFloat(((taxableVal * 2.5) / 100).toFixed(2));
      const sgst       = cgst;
      const totalInv   = parseFloat((taxableVal + cgst + sgst).toFixed(2));

      const orderTypeLabel = order.orderType === 'dine-in'  ? 'Dine-in'
        : order.orderType === 'takeaway' ? 'Takeaway'
        : order.orderType === 'delivery' ? 'Delivery'
        : order.orderType === 'room'     ? 'Room'
        : 'Online';

      const payMode = (order.paymentMethod || 'cash') === 'cash'   ? 'Cash'
        : (order.paymentMethod || '') === 'online' ? 'UPI'
        : (order.paymentMethod || '') === 'card'   ? 'Card'
        : 'Other';

      const channel = order.source === 'staff' ? 'Direct' : order.source === 'qr' ? 'Waitnot' : 'Other';

      return {
        'Invoice Number':       `INV-${String(order.orderNumber || idx+1).padStart(3,'0')}`,
        'Invoice Date':          new Date(order.updatedAt || order.createdAt).toLocaleDateString('en-IN'),
        'Order ID':              order._id || '',
        'Outlet ID':             order.restaurantId || '',
        'Customer Type':         'B2C',
        'Customer Name':         order.customerName || '',
        'Customer GSTIN':        '',
        'Customer State':        '',
        'Place of Supply':       '',
        'State Code':            '',
        'Order Type':            orderTypeLabel,
        'Sales Channel':         channel,
        'Payment Mode':          payMode,
        'Subtotal':              subtotal.toFixed(2),
        'Discount':              discount.toFixed(2),
        'Taxable Value':         taxableVal.toFixed(2),
        'CGST':                  cgst.toFixed(2),
        'SGST':                  sgst.toFixed(2),
        'IGST':                  '0.00',
        'CESS':                  '0.00',
        'Total Invoice Value':   totalInv.toFixed(2),
        'GST Rate':              '5%',
        'SAC/HSN':               '996331',
        'Invoice Status':        order.status === 'completed' ? 'Completed' : order.status === 'cancelled' ? 'Cancelled' : 'Completed',
        'Credit Note':           '',
        'Debit Note':            '',
      };
    });
  };

  const convertToCSV = (data) => {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);
    const escape  = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const csvRows = [
      headers.map(escape).join(','),
      ...data.map(row => headers.map(h => escape(row[h])).join(','))
    ];
    return '\uFEFF' + csvRows.join('\r\n'); // UTF-8 BOM for Excel
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/restaurant-dashboard')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Back to Dashboard</span>
              </button>
              <div className="border-l border-gray-300 pl-4">
                <h1 className="text-3xl font-bold text-gray-800">Analytics Dashboard</h1>
                <p className="text-gray-600 mt-1">{restaurant?.name} - Business Intelligence</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
                <option value="all">All Time</option>
              </select>
              
              <div className="flex gap-2">
                <button
                  onClick={() => downloadReport('today')}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"
                >
                  Today Report
                </button>
                <button
                  onClick={() => downloadReport('weekly')}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
                >
                  Weekly Report
                </button>
                <button
                  onClick={() => downloadReport('monthly')}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                >
                  Monthly Report
                </button>
                <button
                  onClick={() => downloadReport('yearly')}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
                >
                  Yearly Report
                </button>
                <button
                  onClick={clearOrderHistory}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
                >
                  Clear History
                </button>
                <button
                  onClick={() => setShowOrdersTable(v => !v)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2"
                >
                  {showOrdersTable ? 'Hide Orders' : 'Edit Report'}
                </button>
                <button
                  onClick={async () => {
                    const restaurantId = localStorage.getItem('restaurantId');
                    setArchiveLoading(true);
                    try {
                      // Fetch both active orders + archived orders, merge and sort by date
                      const [activeRes, archiveRes] = await Promise.all([
                        axios.get(`/api/orders/restaurant/${restaurantId}`),
                        axios.get(`/api/orders/restaurant/${restaurantId}/archives`).catch(() => ({ data: [] }))
                      ]);
                      // Normalise archived rows into same shape as active orders
                      const archived = (archiveRes.data || []).map(a => ({
                        ...(a.order_data || {}),
                        _archived: true,
                        _archiveReason: a.archive_reason,
                        _archivedAt: a.archived_at,
                        invoiceNumber: a.invoice_number,
                        _id: a.original_order_id,
                      }));
                      const active = (activeRes.data || []).map(o => ({ ...o, _archived: false }));
                      // Merge and sort by createdAt DESC
                      const all = [...active, ...archived].sort(
                        (a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)
                      );
                      setArchiveOrders(all);
                      setShowArchiveModal(true);
                    } catch (e) {
                      alert('Failed to load orders: ' + (e.message || 'Unknown error'));
                    } finally {
                      setArchiveLoading(false);
                    }
                  }}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 flex items-center gap-2"
                >
                  {archiveLoading ? '...' : '📋 All Orders'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
            <p className="text-blue-100">Total Orders</p>
            <p className="text-3xl font-bold">{analytics.totalOrders || 0}</p>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
            <p className="text-green-100">Total Revenue</p>
            <p className="text-3xl font-bold">₹{analytics.totalRevenue?.toLocaleString() || 0}</p>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
            <p className="text-purple-100">Avg Order Value</p>
            <p className="text-3xl font-bold">₹{Math.round(analytics.avgOrderValue || 0)}</p>
          </div>

          {(() => {
            const breakdown = analytics.paymentBreakdown || [];
            const cash = breakdown.find(b => b.method === 'cash') || { count: 0, revenue: 0 };
            const online = breakdown.find(b => b.method === 'online') || { count: 0, revenue: 0 };
            return (
              <>
                <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
                  <p className="text-green-100">Cash Payment</p>
                  <p className="text-3xl font-bold">₹{(cash.revenue || 0).toLocaleString()}</p>
                  <p className="text-green-200 text-xs mt-1">{cash.count} order{cash.count !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
                  <p className="text-blue-100">Online Payment</p>
                  <p className="text-3xl font-bold">₹{(online.revenue || 0).toLocaleString()}</p>
                  <p className="text-blue-200 text-xs mt-1">{online.count} order{online.count !== 1 ? 's' : ''}</p>
                </div>
              </>
            );
          })()}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Daily Revenue Chart */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Daily Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analytics.dailyRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [`₹${value}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Order Status Breakdown */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Order Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.statusBreakdown || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, count }) => `${status}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="status"
                >
                  {(analytics.statusBreakdown || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Popular Items */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Top Selling Items</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.popularItems || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantity" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Hourly Orders */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Hourly Order Distribution</h3>
            <p className="text-sm text-gray-600 mb-3">Peak Hour: {analytics.peakHourRange}</p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.hourlyData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="#ff7300" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment & Order Type Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Payment Methods */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Payment Methods</h3>

            {/* Summary cards */}
            <div className="space-y-3 mb-4">
              {(analytics.paymentBreakdown || []).map((entry, index) => {
                const isOnline = entry.method === 'online';
                const isCash = entry.method === 'cash';
                const icon = isOnline ? '📱' : isCash ? '💵' : '💳';
                const color = isOnline ? 'blue' : isCash ? 'green' : 'purple';
                const colorMap = {
                  blue: 'bg-blue-50 border-blue-200 text-blue-700',
                  green: 'bg-green-50 border-green-200 text-green-700',
                  purple: 'bg-purple-50 border-purple-200 text-purple-700',
                };
                return (
                  <div key={entry.method} className={`flex items-center justify-between p-4 rounded-xl border ${colorMap[color]}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{icon}</span>
                      <div>
                        <div className="font-semibold capitalize">{entry.method === 'online' ? 'Online Payment' : entry.method === 'cash' ? 'Cash Payment' : entry.method}</div>
                        <div className="text-sm opacity-75">{entry.count} order{entry.count !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">₹{(entry.revenue || 0).toLocaleString()}</div>
                      <div className="text-xs opacity-75">collected</div>
                    </div>
                  </div>
                );
              })}
              {(!analytics.paymentBreakdown || analytics.paymentBreakdown.length === 0) && (
                <div className="text-center text-gray-400 py-8">No payment data yet</div>
              )}
            </div>

            {/* Pie chart */}
            {analytics.paymentBreakdown && analytics.paymentBreakdown.length > 0 && (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={analytics.paymentBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="revenue"
                    nameKey="method"
                  >
                    {analytics.paymentBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                  <Legend formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Order Types */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Order Types</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.typeBreakdown || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Additional Insights */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Business Insights & Growth</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800">Performance</h4>
              <p className="text-sm text-blue-600 mt-1">
                Your completion rate is {Math.round(analytics.completionRate || 0)}%. 
                {analytics.completionRate > 90 ? ' Excellent!' : analytics.completionRate > 75 ? ' Good performance!' : ' Room for improvement.'}
              </p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800">Revenue Growth</h4>
              <p className="text-sm text-green-600 mt-1">
                {analytics.revenueGrowth > 0 ? `📈 +${Math.round(analytics.revenueGrowth)}%` : 
                 analytics.revenueGrowth < 0 ? `📉 ${Math.round(analytics.revenueGrowth)}%` : '➡️ 0%'} vs last month
              </p>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-800">Peak Time</h4>
              <p className="text-sm text-purple-600 mt-1">
                Busiest hour: {analytics.peakHourRange}. Plan staffing accordingly for optimal service.
              </p>
            </div>

            <div className="bg-pink-50 p-4 rounded-lg">
              <h4 className="font-semibold text-pink-800">Customer Base</h4>
              <p className="text-sm text-pink-600 mt-1">
                {analytics.totalCustomers || 0} total customers, {Math.round(analytics.repeatCustomerRate || 0)}% are repeat customers.
              </p>
            </div>
          </div>
        </div>

        {/* Edit Report — Orders Table */}
        {showOrdersTable && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Orders — Edit / Delete</h3>
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 w-64">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  placeholder="Search by table, customer, type..."
                  className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
                />
                {orderSearch && <button onClick={() => setOrderSearch('')}><X size={14} className="text-gray-400" /></button>}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-3 pr-4">Date / Time</th>
                    <th className="pb-3 pr-4">Type</th>
                    <th className="pb-3 pr-4">Table / Room</th>
                    <th className="pb-3 pr-4">Customer</th>
                    <th className="pb-3 pr-4">Items</th>
                    <th className="pb-3 pr-4">Payment</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 text-right">Total</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders
                    .filter(o => {
                      const q = orderSearch.toLowerCase();
                      if (!q) return true;
                      return (
                        o.tableNumber?.toString().includes(q) ||
                        o.roomNumber?.toString().includes(q) ||
                        o.customerName?.toLowerCase().includes(q) ||
                        o.orderType?.toLowerCase().includes(q) ||
                        o.status?.toLowerCase().includes(q) ||
                        o.items?.some(i => i.name.toLowerCase().includes(q))
                      );
                    })
                    .map(order => (
                      <tr key={order._id} className="border-b border-gray-50 hover:bg-gray-50 group">
                        <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
                          <span className="text-xs">{new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            order.orderType === 'dine-in' ? 'bg-red-100 text-red-700' :
                            order.orderType === 'room' ? 'bg-orange-100 text-orange-700' :
                            order.orderType === 'takeaway' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {order.orderType === 'dine-in' ? '🍽 Dine-In' :
                             order.orderType === 'room' ? '🛏 Room' :
                             order.orderType === 'takeaway' ? '🥡 Takeaway' : '🛵 Delivery'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-700">
                          {order.tableNumber ? `T${order.tableNumber}` : order.roomNumber ? `R${order.roomNumber}` : '—'}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-700 max-w-[120px] truncate">{order.customerName || '—'}</td>
                        <td className="py-2.5 pr-4 text-gray-600 max-w-[180px]">
                          <span className="truncate block">{order.items?.map(i => `${i.name} ×${i.quantity}`).join(', ')}</span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={`text-xs font-medium capitalize ${order.paymentMethod === 'online' ? 'text-blue-600' : 'text-green-600'}`}>
                            {order.paymentMethod || 'cash'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            order.status === 'completed' ? 'bg-green-100 text-green-700' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-semibold text-gray-800">₹{order.totalAmount}</td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => deleteOrder(order._id)}
                            disabled={deletingId === order._id}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {orders.filter(o => {
                const q = orderSearch.toLowerCase();
                if (!q) return true;
                return o.tableNumber?.toString().includes(q) || o.customerName?.toLowerCase().includes(q) || o.orderType?.toLowerCase().includes(q) || o.items?.some(i => i.name.toLowerCase().includes(q));
              }).length === 0 && (
                <p className="text-center text-gray-400 py-8 text-sm">No orders found</p>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-3">{orders.length} total orders · Hover a row to reveal the delete button</p>
          </div>
        )}

        {/* Actionable Recommendations */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4">🎯 Actionable Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white bg-opacity-20 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">🍽️ Menu Optimization</h4>
              <p className="text-sm opacity-90">
                {analytics.popularItems && analytics.popularItems.length > 0 
                  ? `Your top item "${analytics.popularItems[0]?.name}" is performing well. Consider promoting similar items.`
                  : 'Track popular items to optimize your menu offerings.'
                }
              </p>
            </div>
            
            <div className="bg-white bg-opacity-20 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Staffing Strategy</h4>
              <p className="text-sm opacity-90">
                Peak hours: {analytics.peakHourRange}. Ensure adequate staff during busy periods to maintain service quality.
              </p>
            </div>
            
            <div className="bg-white bg-opacity-20 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Payment Insights</h4>
              <p className="text-sm opacity-90">
                {analytics.paymentBreakdown && analytics.paymentBreakdown.length > 0
                  ? `Most used payment: ${analytics.paymentBreakdown[0]?.method}. Consider optimizing checkout flow.`
                  : 'Monitor payment preferences to improve customer experience.'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Custom confirm modal */}
    {confirmModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
          <p className="text-gray-800 font-semibold text-base mb-6 text-center">{confirmModal.message}</p>
          <div className="flex gap-3">
            <button
              onClick={() => { confirmModal.onCancel ? confirmModal.onCancel() : setConfirmModal(null); }}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50"
            >
              {confirmModal.cancelLabel || 'Cancel'}
            </button>
            <button
              onClick={confirmModal.onConfirm}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600"
            >
              {confirmModal.confirmLabel || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── All Orders Modal (active + archived, merged date-wise) ──────── */}
    {showArchiveModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-900">📋 All Orders</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {archiveOrders.length} order{archiveOrders.length !== 1 ? 's' : ''} total
                {' · '}{archiveOrders.filter(o => o._archived).length} deleted
                {' · '}{archiveOrders.filter(o => !o._archived).length} active
              </p>
            </div>
            <div className="flex items-center gap-3">
              {archiveOrders.length > 0 && (
                <button
                  onClick={() => {
                    const headers = [
                      'Invoice Number','Order Date','Status','Customer','Order Type',
                      'Payment Mode','Items','Subtotal','Total Amount','Deleted','Delete Reason','Deleted At'
                    ];
                    const rows = archiveOrders.map(o => {
                      const items = (o.items||[]).map(i=>`${i.name} x${i.quantity}`).join('; ');
                      const subtotal = (o.items||[]).reduce((s,i)=>s+(parseFloat(i.price)||0)*(parseInt(i.quantity)||1),0);
                      const invLabel = o.invoiceNumber ? `INV-${String(o.invoiceNumber).padStart(3,'0')}` : '—';
                      const deleteReason = o._archived
                        ? (o._archiveReason === 'history_cleared' ? 'History Cleared' : 'Manually Deleted')
                        : '';
                      return [
                        invLabel,
                        new Date(o.createdAt || o.created_at || 0).toLocaleString('en-IN'),
                        o._archived ? 'Deleted' : (o.status || 'active'),
                        o.customerName || 'Guest',
                        o.orderType || '—',
                        o.paymentMethod || 'cash',
                        items,
                        subtotal.toFixed(2),
                        o.totalAmount || 0,
                        o._archived ? 'Yes' : 'No',
                        deleteReason,
                        o._archived && o._archivedAt
                          ? new Date(o._archivedAt).toLocaleString('en-IN')
                          : '',
                      ];
                    });
                    const csv = [headers, ...rows]
                      .map(r => r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))
                      .join('\r\n');
                    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `all-orders-${new Date().toISOString().slice(0,10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700"
                >
                  ⬇ Export CSV
                </button>
              )}
              <button onClick={() => { setShowArchiveModal(false); setArchiveSearch(''); }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light">×</button>
            </div>
          </div>

          {/* Date / search filter */}
          <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 flex-1 max-w-xs">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                value={archiveSearch}
                onChange={e => setArchiveSearch(e.target.value)}
                placeholder="Search date (e.g. Jan 2026), customer, type…"
                className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
              />
              {archiveSearch && (
                <button onClick={() => setArchiveSearch('')}><X size={14} className="text-gray-400" /></button>
              )}
            </div>
            <span className="text-xs text-gray-400">
              Showing {archiveOrders.filter(o => {
                const q = archiveSearch.toLowerCase();
                if (!q) return true;
                const dateStr = new Date(o.createdAt || o.created_at || 0).toLocaleString('en-IN').toLowerCase();
                return (
                  dateStr.includes(q) ||
                  (o.customerName||'').toLowerCase().includes(q) ||
                  (o.orderType||'').toLowerCase().includes(q) ||
                  (o.items||[]).some(i => i.name.toLowerCase().includes(q))
                );
              }).length} of {archiveOrders.length}
            </span>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {archiveOrders.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">📭</p>
                <p className="font-medium">No orders found</p>
                <p className="text-sm mt-1">Orders will appear here once created</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[750px]">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-3 py-2 rounded-l">Invoice</th>
                      <th className="px-3 py-2">Order Date</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Items</th>
                      <th className="px-3 py-2">Payment</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right rounded-r">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {archiveOrders
                      .filter(o => {
                        const q = archiveSearch.toLowerCase();
                        if (!q) return true;
                        const dateStr = new Date(o.createdAt || o.created_at || 0).toLocaleString('en-IN').toLowerCase();
                        return (
                          dateStr.includes(q) ||
                          (o.customerName||'').toLowerCase().includes(q) ||
                          (o.orderType||'').toLowerCase().includes(q) ||
                          (o.items||[]).some(i => i.name.toLowerCase().includes(q))
                        );
                      })
                      .map((o, i) => {
                        const invLabel = o.invoiceNumber
                          ? `INV-${String(o.invoiceNumber).padStart(3,'0')}`
                          : '—';
                        const orderDate = o.createdAt || o.created_at;
                        const items = (o.items||[]).map(it=>`${it.name}×${it.quantity}`).join(', ');
                        const orderType = (o.orderType||'').charAt(0).toUpperCase()+(o.orderType||'').slice(1);
                        const deleteReason = o._archiveReason === 'history_cleared' ? 'History Clear' : 'Deleted';
                        return (
                          <tr key={`${o._id||i}-${i}`} className={`hover:bg-gray-50 ${o._archived ? 'opacity-75' : ''}`}>
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{invLabel}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                              {orderDate
                                ? new Date(orderDate).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})
                                : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-gray-700">{o.customerName||'Guest'}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-500">{orderType||'—'}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[200px] truncate">{items||'—'}</td>
                            <td className="px-3 py-2.5 text-xs capitalize text-gray-500">{o.paymentMethod||'cash'}</td>
                            <td className="px-3 py-2.5">
                              {o._archived ? (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                                  {deleteReason}
                                </span>
                              ) : (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  o.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  o.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {o.status || 'active'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-xs font-semibold text-gray-800 text-right">
                              ₹{o.totalAmount || 0}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default Analytics;