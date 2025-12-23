import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
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
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
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
      acc[method] = (acc[method] || 0) + 1;
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
      paymentBreakdown: Object.entries(paymentBreakdown).map(([method, count]) => ({ method, count })),
      typeBreakdown: Object.entries(typeBreakdown).map(([type, count]) => ({ type, count })),
      dailyRevenue,
      popularItems,
      hourlyData,
      peakHourRange,
      repeatCustomerRate,
      totalCustomers
    });
  };

  const downloadReport = async (type) => {
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      
      // Try API first
      try {
        const response = await axios.get(`/api/analytics/restaurant/${restaurantId}/report?type=${type}&format=csv`, {
          responseType: 'blob'
        });
        
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${restaurant?.name || 'Restaurant'}_${type}_Report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (apiError) {
        console.log('API not available, generating report locally');
        // Fallback to local generation
        const reportData = generateReportData(type);
        const csvContent = convertToCSV(reportData);
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${restaurant?.name || 'Restaurant'}_${type}_Report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report. Please try again.');
    }
  };

  const generateReportData = (type) => {
    const now = new Date();
    let startDate, endDate = now;

    switch (type) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });

    return filteredOrders.map(order => ({
      'Order ID': order._id,
      'Date': new Date(order.createdAt).toLocaleDateString(),
      'Time': new Date(order.createdAt).toLocaleTimeString(),
      'Customer': order.customerName || 'N/A',
      'Phone': order.customerPhone || 'N/A',
      'Type': order.orderType || order.type || 'dine-in',
      'Table': order.tableNumber || 'N/A',
      'Status': order.status,
      'Payment Method': order.paymentMethod || 'cash',
      'Payment Status': order.paymentStatus || 'pending',
      'Items': order.items ? order.items.map(item => `${item.name} x${item.quantity}`).join('; ') : '',
      'Total Amount': order.totalAmount || order.total || 0,
      'Delivery Address': order.deliveryAddress || 'N/A'
    }));
  };

  const convertToCSV = (data) => {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',')
      )
    ];
    
    return csvRows.join('\n');
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
                <h1 className="text-3xl font-bold text-gray-800">📊 Analytics Dashboard</h1>
                <p className="text-gray-600 mt-1">{restaurant?.name} - Business Intelligence</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="week">Last 7 Days</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
                <option value="all">All Time</option>
              </select>
              
              <div className="flex gap-2">
                <button
                  onClick={() => downloadReport('weekly')}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
                >
                  📄 Weekly Report
                </button>
                <button
                  onClick={() => downloadReport('monthly')}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                >
                  📊 Monthly Report
                </button>
                <button
                  onClick={() => downloadReport('yearly')}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
                >
                  📈 Yearly Report
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total Orders</p>
                <p className="text-3xl font-bold">{analytics.totalOrders || 0}</p>
              </div>
              <div className="text-4xl opacity-80">🛒</div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100">Total Revenue</p>
                <p className="text-3xl font-bold">₹{analytics.totalRevenue?.toLocaleString() || 0}</p>
              </div>
              <div className="text-4xl opacity-80">💰</div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">Avg Order Value</p>
                <p className="text-3xl font-bold">₹{Math.round(analytics.avgOrderValue || 0)}</p>
              </div>
              <div className="text-4xl opacity-80">📊</div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100">Completion Rate</p>
                <p className="text-3xl font-bold">{Math.round(analytics.completionRate || 0)}%</p>
              </div>
              <div className="text-4xl opacity-80">✅</div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-pink-100">Repeat Customers</p>
                <p className="text-3xl font-bold">{Math.round(analytics.repeatCustomerRate || 0)}%</p>
              </div>
              <div className="text-4xl opacity-80">👥</div>
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Daily Revenue Chart */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📈 Daily Revenue Trend</h3>
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
            <h3 className="text-xl font-bold text-gray-800 mb-4">📋 Order Status Distribution</h3>
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
            <h3 className="text-xl font-bold text-gray-800 mb-4">🍽️ Top Selling Items</h3>
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
            <h3 className="text-xl font-bold text-gray-800 mb-4">⏰ Hourly Order Distribution</h3>
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
            <h3 className="text-xl font-bold text-gray-800 mb-4">💳 Payment Methods</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.paymentBreakdown || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ method, count }) => `${method}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="method"
                >
                  {(analytics.paymentBreakdown || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Order Types */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-4">🏪 Order Types</h3>
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
          <h3 className="text-xl font-bold text-gray-800 mb-4">💡 Business Insights & Growth</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800">📊 Performance</h4>
              <p className="text-sm text-blue-600 mt-1">
                Your completion rate is {Math.round(analytics.completionRate || 0)}%. 
                {analytics.completionRate > 90 ? ' Excellent!' : analytics.completionRate > 75 ? ' Good performance!' : ' Room for improvement.'}
              </p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800">💰 Revenue Growth</h4>
              <p className="text-sm text-green-600 mt-1">
                {analytics.revenueGrowth > 0 ? `📈 +${Math.round(analytics.revenueGrowth)}%` : 
                 analytics.revenueGrowth < 0 ? `📉 ${Math.round(analytics.revenueGrowth)}%` : '➡️ 0%'} vs last month
              </p>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-800">⏰ Peak Time</h4>
              <p className="text-sm text-purple-600 mt-1">
                Busiest hour: {analytics.peakHourRange}. Plan staffing accordingly for optimal service.
              </p>
            </div>

            <div className="bg-pink-50 p-4 rounded-lg">
              <h4 className="font-semibold text-pink-800">👥 Customer Base</h4>
              <p className="text-sm text-pink-600 mt-1">
                {analytics.totalCustomers || 0} total customers, {Math.round(analytics.repeatCustomerRate || 0)}% are repeat customers.
              </p>
            </div>
          </div>
        </div>

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
              <h4 className="font-semibold mb-2">⏰ Staffing Strategy</h4>
              <p className="text-sm opacity-90">
                Peak hours: {analytics.peakHourRange}. Ensure adequate staff during busy periods to maintain service quality.
              </p>
            </div>
            
            <div className="bg-white bg-opacity-20 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">💳 Payment Insights</h4>
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
  );
};

export default Analytics;