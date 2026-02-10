import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { 
  Shield, 
  Plus, 
  Users, 
  Store, 
  BarChart3, 
  Settings, 
  LogOut,
  Edit,
  Eye,
  Search,
  Filter,
  Bell,
  Clock
} from 'lucide-react';
import { trackAdminEvent, trackAuthEvent } from '../utils/analytics';
import { getWebSocketUrl } from '../config/environment.js';
import notificationSound from '../utils/notificationSound';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [restaurants, setRestaurants] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Real-time orders state
  const [recentOrders, setRecentOrders] = useState([]);
  const [newOrdersCount, setNewOrdersCount] = useState(0);

  useEffect(() => {
    // Check admin authentication
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      navigate('/admin-login');
      return;
    }

    loadDashboardData();
    
    // Setup WebSocket connection for real-time updates
    const socketUrl = getWebSocketUrl();
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    // Join admin room for real-time updates
    socket.emit('join-admin');

    socket.on('connect', () => {
      console.log('Admin connected to WebSocket');
      socket.emit('join-admin');
    });

    socket.on('disconnect', () => {
      console.log('Admin disconnected from WebSocket');
    });

    // Listen for new orders from all restaurants
    socket.on('new-order', (order) => {
      console.log('🔔 New order received in admin:', order);
      
      // Add to recent orders
      setRecentOrders(prev => [order, ...prev.slice(0, 9)]); // Keep only 10 recent orders
      
      // Increment new orders count
      setNewOrdersCount(prev => prev + 1);
      
      // Play notification sound
      notificationSound.play();
      
      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        const restaurantName = restaurants.find(r => r._id === order.restaurantId)?.name || 'Restaurant';
        new Notification('New Order Received!', {
          body: `New order from ${restaurantName} - Table ${order.tableNumber || 'N/A'}`,
          icon: '/logo.png'
        });
      }
    });

    // Listen for order updates
    socket.on('order-updated', (updatedOrder) => {
      console.log('📝 Order updated in admin:', updatedOrder);
      
      // Update the order in recent orders if it exists
      setRecentOrders(prev => 
        prev.map(order => 
          order._id === updatedOrder._id ? updatedOrder : order
        )
      );
    });

    return () => socket.disconnect();
  }, [restaurants]);

  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      
      // Load restaurants
      const restaurantsResponse = await fetch('/api/admin/restaurants', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (restaurantsResponse.ok) {
        const restaurantsData = await restaurantsResponse.json();
        console.log('Admin restaurants data:', restaurantsData);
        console.log('First restaurant features:', restaurantsData[0]?.features);
        setRestaurants(restaurantsData);
      }

      // Load stats
      const statsResponse = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Load recent orders from all restaurants
      const ordersResponse = await fetch('/api/admin/recent-orders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        setRecentOrders(ordersData.slice(0, 10)); // Keep only 10 recent orders
      }

      // Request notification permission
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleQROrdering = async (restaurantId, currentStatus) => {
    try {
      // Track admin action
      trackAdminEvent('toggle_qr_ordering', 'QR_Ordering_Control', {
        restaurant_id: restaurantId,
        action: currentStatus ? 'disable' : 'enable',
        previous_status: currentStatus
      });
      
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/restaurants/${restaurantId}/qr-ordering`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: !currentStatus })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('QR ordering toggled:', result.message);
        
        // Track successful toggle
        trackAdminEvent('qr_ordering_toggle_success', 'QR_Ordering_Control', {
          restaurant_id: restaurantId,
          new_status: !currentStatus
        });
        
        // Update the restaurant in the local state
        setRestaurants(restaurants.map(restaurant => 
          restaurant._id === restaurantId 
            ? { 
                ...restaurant, 
                features: { 
                  ...restaurant.features, 
                  qrOrderingEnabled: !currentStatus 
                }
              }
            : restaurant
        ));
        
        alert(result.message);
      } else {
        const error = await response.json();
        
        // Track failed toggle
        trackAdminEvent('qr_ordering_toggle_failed', 'QR_Ordering_Control', {
          restaurant_id: restaurantId,
          error: error.error
        });
        
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error toggling QR ordering:', error);
      
      // Track error
      trackAdminEvent('qr_ordering_toggle_error', 'QR_Ordering_Control', {
        restaurant_id: restaurantId,
        error: error.message
      });
      alert('Failed to toggle QR ordering');
    }
  };

  const logout = () => {
    trackAuthEvent('logout', 'admin');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    navigate('/admin-login');
  };

  const filteredRestaurants = restaurants.filter(restaurant =>
    restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    restaurant.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {JSON.parse(localStorage.getItem('adminData') || '{}').fullName || 'Admin'}
              </span>
              <button
                onClick={logout}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-5 h-5 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === 'overview'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('restaurants')}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === 'restaurants'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Store className="w-4 h-4 mr-2" />
              Restaurants
            </button>
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Store className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Restaurants</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalRestaurants || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Restaurants</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.activeRestaurants || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Settings className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Inactive Restaurants</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.inactiveRestaurants || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Bell className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">New Orders</p>
                    <p className="text-2xl font-semibold text-gray-900">{newOrdersCount}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Orders - Real-time */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-blue-600" />
                    Recent Orders (Live)
                  </h3>
                  {newOrdersCount > 0 && (
                    <button
                      onClick={() => setNewOrdersCount(0)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Mark as seen
                    </button>
                  )}
                </div>
                <div className="p-6">
                  {recentOrders.length > 0 ? (
                    <div className="space-y-3">
                      {recentOrders.map((order) => (
                        <div key={order._id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <Store className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">
                                {order.restaurantName || 'Unknown Restaurant'}
                              </p>
                              <p className="text-sm text-gray-500">
                                Table {order.tableNumber || 'N/A'} • {order.customerName || 'Guest'}
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(order.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">₹{order.totalAmount}</p>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                              order.status === 'preparing' ? 'bg-orange-100 text-orange-800' :
                              order.status === 'ready' ? 'bg-purple-100 text-purple-800' :
                              order.status === 'completed' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No recent orders</p>
                      <p className="text-sm">Orders will appear here in real-time</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Restaurants */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Recent Restaurants</h3>
                </div>
                <div className="p-6">
                  {restaurants.slice(0, 5).map((restaurant) => (
                    <div key={restaurant._id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <Store className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{restaurant.name}</p>
                          <p className="text-sm text-gray-500">{restaurant.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          restaurant.isDeliveryAvailable 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {restaurant.isDeliveryAvailable ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Restaurants Tab */}
        {activeTab === 'restaurants' && (
          <div className="space-y-6">
            {/* Header with Search and Create Button */}
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search restaurants..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <button
                onClick={() => navigate('/admin/create-restaurant')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Restaurant
              </button>
            </div>

            {/* Restaurants Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Restaurant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tables
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      QR Ordering
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRestaurants.map((restaurant) => (
                    <tr key={restaurant._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <Store className="w-5 h-5 text-gray-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{restaurant.name}</div>
                            <div className="text-sm text-gray-500">{restaurant.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{restaurant.email}</div>
                        <div className="text-sm text-gray-500">{restaurant.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          restaurant.isDeliveryAvailable 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {restaurant.isDeliveryAvailable ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {restaurant.tables || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleQROrdering(restaurant._id, restaurant.features?.qrOrderingEnabled)}
                          className={`px-3 py-1 text-xs rounded-full font-medium ${
                            restaurant.features?.qrOrderingEnabled !== false
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                        >
                          {restaurant.features?.qrOrderingEnabled !== false ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(restaurant.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => navigate(`/admin/restaurant/${restaurant._id}`)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/admin/restaurant/${restaurant._id}/edit`)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit Features"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;