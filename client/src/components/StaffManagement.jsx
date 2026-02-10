import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Users, Shield, Clock, Activity } from 'lucide-react';
import axios from 'axios';

const STAFF_ROLES = {
  manager: {
    name: 'Manager',
    color: 'bg-purple-100 text-purple-800',
    icon: '👨‍💼',
    description: 'Full access to all features'
  },
  waiter: {
    name: 'Waiter',
    color: 'bg-blue-100 text-blue-800',
    icon: '🍽️',
    description: 'Take orders and serve customers'
  },
  kitchen: {
    name: 'Kitchen Staff',
    color: 'bg-orange-100 text-orange-800',
    icon: '👨‍🍳',
    description: 'Manage kitchen operations'
  }
};

export default function StaffManagement({ restaurantId }) {
  const [staff, setStaff] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [activeTab, setActiveTab] = useState('staff');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'waiter'
  });

  useEffect(() => {
    if (restaurantId) {
      fetchStaff();
      if (activeTab === 'activity') {
        fetchActivityLogs();
      }
    }
  }, [restaurantId, activeTab]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/api/staff/restaurant/${restaurantId}`);
      setStaff(data);
    } catch (error) {
      console.error('Error fetching staff:', error);
      alert('Failed to fetch staff members');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const { data } = await axios.get(`/api/staff/restaurant/${restaurantId}/activity`);
      setActivityLogs(data);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingStaff) {
        // Update existing staff using restaurant owner endpoint
        const { data } = await axios.put(`/api/staff/restaurant/${restaurantId}/staff/${editingStaff.id}`, {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role
        });
        
        setStaff(staff.map(s => s.id === editingStaff.id ? data : s));
        alert('Staff member updated successfully!');
      } else {
        // Add new staff
        const { data } = await axios.post('/api/staff', {
          restaurantId,
          ...formData
        });
        
        setStaff([data, ...staff]);
        alert('Staff member added successfully!');
      }
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'waiter'
      });
      setShowAddForm(false);
      setEditingStaff(null);
    } catch (error) {
      console.error('Error saving staff:', error);
      alert(error.response?.data?.error || 'Failed to save staff member');
    }
  };

  const handleEdit = (staffMember) => {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name,
      email: staffMember.email,
      phone: staffMember.phone || '',
      password: '',
      role: staffMember.role
    });
    setShowAddForm(true);
  };

  const handleDelete = async (staffId, staffName) => {
    if (!window.confirm(`Are you sure you want to delete ${staffName}?`)) {
      return;
    }
    
    try {
      await axios.delete(`/api/staff/restaurant/${restaurantId}/staff/${staffId}`);
      setStaff(staff.filter(s => s.id !== staffId));
      alert('Staff member deleted successfully!');
    } catch (error) {
      console.error('Error deleting staff:', error);
      alert(error.response?.data?.error || 'Failed to delete staff member');
    }
  };

  const toggleStaffStatus = async (staffId, currentStatus) => {
    try {
      const { data } = await axios.put(`/api/staff/restaurant/${restaurantId}/staff/${staffId}`, {
        isActive: !currentStatus
      });
      
      setStaff(staff.map(s => s.id === staffId ? data : s));
    } catch (error) {
      console.error('Error updating staff status:', error);
      alert('Failed to update staff status');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getActivityIcon = (action) => {
    switch (action) {
      case 'login': return '🔐';
      case 'logout': return '🚪';
      case 'staff_added': return '➕';
      case 'staff_updated': return '✏️';
      case 'staff_deleted': return '🗑️';
      case 'password_changed': return '🔑';
      default: return '📝';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading staff...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Staff Management
            </h2>
            <p className="text-gray-600">Manage your restaurant staff and permissions</p>
          </div>
          <button
            onClick={() => {
              setShowAddForm(true);
              setEditingStaff(null);
              setFormData({
                name: '',
                email: '',
                phone: '',
                password: '',
                role: 'waiter'
              });
            }}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark flex items-center gap-2"
          >
            <Plus size={18} />
            Add Staff
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 border-b">
          <button
            onClick={() => setActiveTab('staff')}
            className={`pb-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'staff'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Staff Members ({staff.length})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'activity'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Activity Logs
          </button>
        </div>
      </div>

      {/* Staff List */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staff.map((staffMember) => (
            <div key={staffMember.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-2xl">
                    {STAFF_ROLES[staffMember.role]?.icon || '👤'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{staffMember.name}</h3>
                    <p className="text-sm text-gray-600">{staffMember.email}</p>
                    {staffMember.phone && (
                      <p className="text-sm text-gray-600">{staffMember.phone}</p>
                    )}
                    {staffMember.role === 'waiter' && staffMember.waiter_number && (
                      <p className="text-sm font-semibold text-blue-600">
                        Waiter #{staffMember.waiter_number}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleStaffStatus(staffMember.id, staffMember.is_active)}
                    className={`p-1 rounded ${
                      staffMember.is_active ? 'text-green-600' : 'text-gray-400'
                    }`}
                    title={staffMember.is_active ? 'Active' : 'Inactive'}
                  >
                    {staffMember.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    onClick={() => handleEdit(staffMember)}
                    className="p-1 text-blue-600 hover:text-blue-800"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(staffMember.id, staffMember.name)}
                    className="p-1 text-red-600 hover:text-red-800"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Role:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    STAFF_ROLES[staffMember.role]?.color || 'bg-gray-100 text-gray-800'
                  }`}>
                    {STAFF_ROLES[staffMember.role]?.name || staffMember.role}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    staffMember.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {staffMember.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="text-xs text-gray-500 mt-2">
                  <div>Created: {formatDate(staffMember.created_at)}</div>
                  {staffMember.updated_at !== staffMember.created_at && (
                    <div>Updated: {formatDate(staffMember.updated_at)}</div>
                  )}
                </div>
              </div>

              {/* Permissions Preview */}
              <div className="mt-4 pt-4 border-t">
                <div className="text-xs text-gray-600 mb-2">Permissions:</div>
                <div className="flex flex-wrap gap-1">
                  {staffMember.roleDetails?.permissions && Object.entries(staffMember.roleDetails.permissions).map(([resource, perms]) => (
                    <div key={resource} className="text-xs">
                      {Object.entries(perms).some(([_, allowed]) => allowed) && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                          {resource}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activity Logs */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </h3>
          
          <div className="space-y-3">
            {activityLogs.map((log) => (
              <div key={log.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl">{getActivityIcon(log.action)}</div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{log.staff_name}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      STAFF_ROLES[log.staff_role]?.color || 'bg-gray-100 text-gray-800'
                    }`}>
                      {STAFF_ROLES[log.staff_role]?.name || log.staff_role}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {JSON.stringify(log.details, null, 2)}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock size={12} />
                  {formatDate(log.created_at)}
                </div>
              </div>
            ))}
            
            {activityLogs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No activity logs found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Staff Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                  {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingStaff(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {!editingStaff && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      required={!editingStaff}
                      minLength="6"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    {Object.entries(STAFF_ROLES).map(([key, role]) => (
                      <option key={key} value={key}>
                        {role.icon} {role.name} - {role.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-primary text-white py-2 rounded-lg hover:bg-primary-dark font-semibold"
                  >
                    {editingStaff ? 'Update Staff' : 'Add Staff'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingStaff(null);
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}