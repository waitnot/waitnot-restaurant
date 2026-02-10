import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Settings, Shield, Clock, Activity, Bell } from 'lucide-react';
import axios from 'axios';
import io from 'socket.io-client';
import SEO from '../components/SEO';

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const staffData = localStorage.getItem('staffData');
    const token = localStorage.getItem('staffToken');
    
    if (!staffData || !token) {
      navigate('/staff-login');
      return;
    }
    
    const parsedStaff = JSON.parse(staffData);
    setStaff(parsedStaff);
    
    // Set axios default header
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    fetchRestaurantData(parsedStaff.restaurant_id);
    fetchOrders(parsedStaff.restaurant_id);
    
    // Initialize Socket.IO connection
    const newSocket = io(axios.defaults.baseURL || 'http://localhost:5000', {
      transports: ['websocket', 'polling']
    });
    
    setSocket(newSocket);
    
    // Join restaurant room for real-time updates
    newSocket.emit('join-restaurant', parsedStaff.restaurant_id);
    
    // Listen for order updates
    newSocket.on('order-updated', (updatedOrder) => {
      console.log('Order updated:', updatedOrder);
      setOrders(prevOrders => {
        const orderIndex = prevOrders.findIndex(o => o._id === updatedOrder._id);
        if (orderIndex !== -1) {
          // Update existing order
          const newOrders = [...prevOrders];
          newOrders[orderIndex] = updatedOrder;
          // Filter out completed orders
          return newOrders.filter(order => order.status !== 'completed');
        } else if (updatedOrder.status !== 'completed') {
          // Add new order if not completed
          return [updatedOrder, ...prevOrders];
        }
        return prevOrders;
      });
    });
    
    // Listen for new orders
    newSocket.on('new-order', (newOrder) => {
      console.log('New order received:', newOrder);
      if (newOrder.status !== 'completed') {
        setOrders(prevOrders => [newOrder, ...prevOrders]);
      }
    });
    
    // Cleanup on unmount
    return () => {
      if (newSocket) {
        newSocket.emit('leave-restaurant', parsedStaff.restaurant_id);
        newSocket.disconnect();
      }
    };
  }, [navigate]);

  const fetchRestaurantData = async (restaurantId) => {
    try {
      const { data } = await axios.get(`/api/restaurants/${restaurantId}`);
      setRestaurant(data);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    }
  };

  const fetchOrders = async (restaurantId) => {
    try {
      const { data } = await axios.get(`/api/orders/restaurant/${restaurantId}`);
      setOrders(data.filter(order => order.status !== 'completed'));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/staff/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('staffToken');
      localStorage.removeItem('staffData');
      delete axios.defaults.headers.common['Authorization'];
      navigate('/staff-login');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      // Add confirmation for reject action
      if (status === 'rejected') {
        const confirmed = window.confirm('Are you sure you want to reject this order? This action cannot be undone.');
        if (!confirmed) return;
      }
      
      await axios.patch(`/api/orders/${orderId}/status`, { status });
      fetchOrders(staff.restaurant_id);
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to update order status');
    }
  };

  const canPerformAction = (resource, action) => {
    if (!staff?.permissions) return false;
    return staff.permissions[resource]?.[action] || false;
  };

  const getRoleColor = (role) => {
    const colors = {
      manager: 'bg-purple-100 text-purple-800',
      cashier: 'bg-green-100 text-green-800',
      waiter: 'bg-blue-100 text-blue-800',
      kitchen: 'bg-orange-100 text-orange-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleIcon = (role) => {
    const icons = {
      manager: '👨‍💼',
      cashier: '💰',
      waiter: '🍽️',
      kitchen: '👨‍🍳'
    };
    return icons[role] || '👤';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!staff) {
    return null;
  }

  return (
    <>
      <SEO 
        title={`Staff Dashboard - ${restaurant?.name || 'WaitNot'}`}
        description="Staff dashboard for restaurant management"
      />
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <nav className="bg-white shadow-md p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-2xl">{getRoleIcon(staff.role)}</div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  {restaurant?.name || 'Restaurant Dashboard'}
                </h1>
                <p className="text-sm text-gray-600">
                  Welcome, {staff.name}
                  {staff.role === 'waiter' && staff.waiter_number && (
                    <span className="ml-2 font-semibold text-blue-600">({staff.waiter_number})</span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(staff.role)}`}>
                  {staff.roleDetails?.name || staff.role}
                </span>
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-gray-700 hover:text-primary"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto p-4">
          {/* Stats Cards - Only show for non-waiter roles */}
          {staff.role !== 'waiter' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Orders</p>
                    <p className="text-2xl font-bold text-gray-800">{orders.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Activity className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending Orders</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {orders.filter(o => o.status === 'pending').length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Preparing</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {orders.filter(o => o.status === 'preparing').length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Bell className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Your Role</p>
                    <p className="text-lg font-bold text-gray-800">{staff.roleDetails?.name}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Shield className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="bg-white rounded-lg shadow-md">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'orders'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Orders ({orders.length})
                </button>
                
                {canPerformAction('analytics', 'view') && (
                  <button
                    onClick={() => setActiveTab('analytics')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'analytics'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Analytics
                  </button>
                )}
                
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'profile'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Profile
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'orders' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">Active Orders</h2>
                  
                  {orders.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No active orders at the moment
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-4">
                      {orders.map((order) => (
                        <div 
                          key={order._id} 
                          className="border border-gray-200 rounded-lg p-3 flex flex-col justify-between h-32"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-800 text-sm truncate">
                                {order.orderType === 'dine-in' ? `Table ${order.tableNumber}` : 
                                 order.orderType === 'delivery' ? 'Delivery' : 'Takeaway'}
                              </h3>
                              <p className="text-gray-600 text-xs truncate">
                                {order.customerName}
                              </p>
                              {staff.role === 'kitchen' && order.items.length > 0 && (
                                <p className="text-xs text-gray-500 truncate">
                                  {order.items[0].name}{order.items.length > 1 ? ` +${order.items.length - 1} more` : ''}
                                </p>
                              )}
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                              order.status === 'ready' ? 'bg-green-100 text-green-800' :
                              order.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {order.status.charAt(0).toUpperCase()}
                            </span>
                          </div>

                          <div className="mb-1 flex-1 overflow-hidden">
                            {staff.role === 'kitchen' ? (
                              // Kitchen-specific view with item focus
                              <div className="text-xs text-gray-600">
                                <div className="truncate">{order.items.length} item{order.items.length > 1 ? 's' : ''}</div>
                                <div className="font-semibold text-gray-800 text-sm">₹{order.totalAmount}</div>
                              </div>
                            ) : (
                              // Simplified view for waiters and managers
                              <div className="text-xs text-gray-600">
                                <div className="truncate">{order.items.length} item{order.items.length > 1 ? 's' : ''}</div>
                                {staff.role === 'manager' && order.deliveryAddress && (
                                  <div className="text-xs text-gray-500 truncate">📍 {order.deliveryAddress}</div>
                                )}
                                <div className="font-semibold text-gray-800 text-sm">₹{order.totalAmount}</div>
                              </div>
                            )}
                          </div>

                          {canPerformAction('orders', 'edit') && (
                            <div className="flex space-x-1">
                              {order.status === 'pending' && staff.role === 'kitchen' && (
                                <>
                                  <button
                                    onClick={() => updateOrderStatus(order._id, 'preparing')}
                                    className="flex-1 bg-green-500 text-white py-1 px-2 rounded text-xs hover:bg-green-600"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => updateOrderStatus(order._id, 'rejected')}
                                    className="flex-1 bg-red-500 text-white py-1 px-2 rounded text-xs hover:bg-red-600"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              
                              {order.status === 'pending' && staff.role !== 'kitchen' && (
                                <button
                                  onClick={() => updateOrderStatus(order._id, 'preparing')}
                                  className="flex-1 bg-blue-500 text-white py-1 px-2 rounded text-xs hover:bg-blue-600"
                                >
                                  Start
                                </button>
                              )}
                              
                              {order.status === 'preparing' && (
                                <button
                                  onClick={() => updateOrderStatus(order._id, 'ready')}
                                  className="flex-1 bg-green-500 text-white py-1 px-2 rounded text-xs hover:bg-green-600"
                                >
                                  Ready
                                </button>
                              )}
                              
                              {order.status === 'ready' && (
                                <button
                                  onClick={() => updateOrderStatus(order._id, 'completed')}
                                  className="flex-1 bg-gray-500 text-white py-1 px-2 rounded text-xs hover:bg-gray-600"
                                >
                                  Done
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'analytics' && canPerformAction('analytics', 'view') && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">Analytics</h2>
                  <div className="text-center py-12 text-gray-500">
                    Analytics dashboard coming soon...
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-800">Profile Information</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <p className="mt-1 text-sm text-gray-900">{staff.name}</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <p className="mt-1 text-sm text-gray-900">{staff.email}</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                        <p className="mt-1 text-sm text-gray-900">{staff.phone || 'Not provided'}</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Role</label>
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(staff.role)}`}>
                          {staff.roleDetails?.name || staff.role}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                        <div className="space-y-2">
                          {staff.permissions && Object.entries(staff.permissions).map(([resource, perms]) => (
                            <div key={resource} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm font-medium capitalize">{resource}</span>
                              <div className="flex space-x-2">
                                {Object.entries(perms).map(([action, allowed]) => (
                                  <span
                                    key={action}
                                    className={`px-2 py-1 rounded text-xs ${
                                      allowed 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {action}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}