import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Settings, ToggleLeft, ToggleRight, Edit, X, Check, Download } from 'lucide-react';

const AdminEditRestaurant = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [restaurant, setRestaurant] = useState(null);
  const [features, setFeatures] = useState({});

  // Credential edit state
  const [showCredEdit, setShowCredEdit] = useState(false);
  const [credForm, setCredForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [credSaving, setCredSaving] = useState(false);
  const [credMessage, setCredMessage] = useState({ text: '', type: '' });

  const handleCredSave = async () => {
    if (!credForm.email || !credForm.password) {
      setCredMessage({ text: 'Both email and password are required', type: 'error' });
      return;
    }
    if (credForm.password !== credForm.confirmPassword) {
      setCredMessage({ text: 'Passwords do not match', type: 'error' });
      return;
    }
    setCredSaving(true);
    setCredMessage({ text: '', type: '' });
    try {
      const token = localStorage.getItem('adminToken');

      // Update email via dedicated endpoint
      const emailRes = await fetch(`/api/admin/restaurants/${id}/reset-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: credForm.email })
      });
      if (!emailRes.ok) { const d = await emailRes.json(); throw new Error(d.error || 'Failed to update email'); }
      const emailData = await emailRes.json();

      // Update password via dedicated endpoint
      const passRes = await fetch(`/api/admin/restaurants/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ password: credForm.password })
      });
      if (!passRes.ok) { const d = await passRes.json(); throw new Error(d.error || 'Failed to update password'); }

      setRestaurant(prev => ({ ...prev, email: emailData.email }));
      setCredMessage({ text: 'Email and password updated successfully', type: 'success' });
      setCredForm({ email: '', password: '', confirmPassword: '' });
      setTimeout(() => { setShowCredEdit(false); setCredMessage({ text: '', type: '' }); }, 1500);
    } catch (err) {
      setCredMessage({ text: err.message, type: 'error' });
    } finally {
      setCredSaving(false);
    }
  };

  // Feature definitions with descriptions
  const featureDefinitions = {
    // Core Features
    menuManagement: {
      name: 'Menu Management',
      description: 'Add, edit, and delete menu items',
      category: 'Core Features'
    },
    orderManagement: {
      name: 'Order Management',
      description: 'View and manage incoming orders',
      category: 'Core Features'
    },
    qrCodeGeneration: {
      name: 'QR Code Generation',
      description: 'Generate QR codes for tables',
      category: 'Core Features'
    },
    tableManagement: {
      name: 'Table Management',
      description: 'Manage table numbers and settings',
      category: 'Core Features'
    },
    
    // Analytics
    analytics: {
      name: 'Analytics Dashboard',
      description: 'View sales reports and analytics',
      category: 'Analytics'
    },
    orderHistory: {
      name: 'Order History',
      description: 'View past orders and history',
      category: 'Analytics'
    },
    salesReports: {
      name: 'Sales Reports',
      description: 'Generate detailed sales reports',
      category: 'Analytics'
    },
    
    // Settings
    profileEdit: {
      name: 'Profile Editing',
      description: 'Edit restaurant profile and information',
      category: 'Settings'
    },
    printerSettings: {
      name: 'Printer Settings',
      description: 'Configure kitchen printer settings',
      category: 'Settings'
    },
    
    // Operations
    deliveryToggle: {
      name: 'Delivery Toggle',
      description: 'Enable/disable delivery service',
      category: 'Operations'
    },
    deliveryOrders: {
      name: 'Delivery Orders Management',
      description: 'View and manage delivery orders',
      category: 'Operations'
    },
    realTimeOrders: {
      name: 'Real-time Orders',
      description: 'Live order notifications',
      category: 'Operations'
    },
    notifications: {
      name: 'Notifications',
      description: 'Push notifications for orders',
      category: 'Operations'
    },
    staffOrders: {
      name: 'Staff Orders',
      description: 'Allow staff to place orders for customers',
      category: 'Operations'
    },
    
    // Security
    passwordChange: {
      name: 'Password Change',
      description: 'Allow password changes',
      category: 'Security'
    },
    
    // Media
    imageUpload: {
      name: 'Image Upload',
      description: 'Upload restaurant and menu images',
      category: 'Media'
    },
    
    // Menu Features
    menuCategories: {
      name: 'Menu Categories',
      description: 'Organize menu items by categories',
      category: 'Menu Features'
    },
    menuItemToggle: {
      name: 'Menu Item Toggle',
      description: 'Enable/disable individual menu items',
      category: 'Menu Features'
    },
    
    // Customer Management
    customerInfo: {
      name: 'Customer Information',
      description: 'View customer details in orders',
      category: 'Customer Management'
    },
    customerFeedback: {
      name: 'Customer Feedback',
      description: 'Collect and manage customer feedback',
      category: 'Customer Management'
    },
    
    // Advanced
    bulkOperations: {
      name: 'Bulk Operations',
      description: 'Bulk edit menu items and orders',
      category: 'Advanced'
    },
    exportData: {
      name: 'Data Export',
      description: 'Export orders and analytics data',
      category: 'Advanced'
    },
    multiLanguage: {
      name: 'Multi-language Support',
      description: 'Support for multiple languages',
      category: 'Advanced'
    }
  };

  useEffect(() => {
    loadRestaurant();
  }, [id]);

  const loadRestaurant = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/restaurants`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const restaurants = await response.json();
        const foundRestaurant = restaurants.find(r => r._id === id);
        if (foundRestaurant) {
          setRestaurant(foundRestaurant);
          setFeatures(foundRestaurant.features || {});
        } else {
          setMessage('Restaurant not found');
        }
      } else {
        setMessage('Failed to load restaurant');
      }
    } catch (error) {
      console.error('Error loading restaurant:', error);
      setMessage('Error loading restaurant');
    } finally {
      setLoading(false);
    }
  };

  const exportMenu = () => {
    if (!restaurant) return;
    const data = {
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        email: restaurant.email,
        phone: restaurant.phone,
        address: restaurant.address,
        tables: restaurant.tables
      },
      menuItems: (restaurant.menu || []).map(item => ({
        id: item._id,
        name: item.name,
        price: item.price,
        category: item.category,
        isVeg: item.isVeg,
        description: item.description,
        available: item.available,
        displayOrder: item.displayOrder
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${restaurant.name.replace(/\s+/g, '-')}-menu.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFeatureToggle = (featureKey) => {
    setFeatures(prev => ({
      ...prev,
      [featureKey]: !prev[featureKey]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/restaurants/${id}/features`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ features })
      });

      const result = await response.json();

      if (response.ok) {
        setMessage('Features updated successfully!');
        setTimeout(() => {
          navigate('/admin-dashboard');
        }, 2000);
      } else {
        setMessage(result.error || 'Failed to update features');
      }
    } catch (error) {
      console.error('Error updating features:', error);
      setMessage('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const groupedFeatures = Object.entries(featureDefinitions).reduce((acc, [key, def]) => {
    if (!acc[def.category]) {
      acc[def.category] = [];
    }
    acc[def.category].push({ key, ...def });
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading restaurant...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Restaurant not found</p>
          <button
            onClick={() => navigate('/admin-dashboard')}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin-dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Edit Restaurant Features</h1>
          <p className="text-gray-600 mt-2">
            Configure which features are available for <strong>{restaurant.name}</strong>
          </p>
        </div>

        {/* Restaurant Info Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                <Settings className="w-8 h-8 text-gray-600" />
              </div>
              <div className="ml-4">
                <h2 className="text-xl font-semibold text-gray-900">{restaurant.name}</h2>
                <p className="text-gray-600">{restaurant.email}</p>
                <p className="text-sm text-gray-500">{restaurant.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportMenu}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
              >
                <Download size={15} />
                Export Menu
              </button>
              <button
                onClick={() => { setShowCredEdit(!showCredEdit); setCredMessage({ text: '', type: '' }); setCredForm({ email: '', password: '', confirmPassword: '' }); }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {showCredEdit ? <X size={15} /> : <Edit size={15} />}
                {showCredEdit ? 'Cancel' : 'Edit Credentials'}
              </button>
            </div>
          </div>

          {showCredEdit && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Update Email / Password</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">New Email</label>
                  <input
                    type="email"
                    value={credForm.email}
                    onChange={e => setCredForm({ ...credForm, email: e.target.value })}
                    placeholder={restaurant.email}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
                  <input
                    type="password"
                    value={credForm.password}
                    onChange={e => setCredForm({ ...credForm, password: e.target.value })}
                    placeholder="Enter new password"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={credForm.confirmPassword}
                    onChange={e => setCredForm({ ...credForm, confirmPassword: e.target.value })}
                    placeholder="Confirm new password"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {credMessage.text && (
                <p className={`mt-3 text-sm font-medium ${credMessage.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                  {credMessage.text}
                </p>
              )}
              <div className="mt-4">
                <button
                  onClick={handleCredSave}
                  disabled={credSaving || (!credForm.email || !credForm.password || !credForm.confirmPassword)}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Check size={15} />
                  {credSaving ? 'Saving...' : 'Save Credentials'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('successfully') 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        {/* Features Configuration */}
        <div className="space-y-8">
          {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
            <div key={category} className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{category}</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryFeatures.map((feature) => (
                    <div key={feature.key} className="flex items-start space-x-3">
                      <button
                        onClick={() => handleFeatureToggle(feature.key)}
                        className={`flex-shrink-0 mt-1 ${
                          features[feature.key] 
                            ? 'text-green-600 hover:text-green-700' 
                            : 'text-gray-400 hover:text-gray-500'
                        }`}
                      >
                        {features[feature.key] ? (
                          <ToggleRight className="w-6 h-6" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </button>
                      <div className="flex-1">
                        <h4 className={`font-medium ${
                          features[feature.key] ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {feature.name}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {feature.description}
                        </p>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full mt-2 ${
                          features[feature.key] 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {features[feature.key] ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="mt-8 flex justify-end space-x-4">
          <button
            onClick={() => navigate('/admin-dashboard')}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Features
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminEditRestaurant;