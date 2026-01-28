import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Calendar, Percent, DollarSign, Users, QrCode } from 'lucide-react';
import axios from 'axios';

export default function DiscountManager({ restaurant }) {
  const [discounts, setDiscounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageUploadMethod, setImageUploadMethod] = useState('url'); // 'url' or 'upload'
  const [imageFile, setImageFile] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    min_order_amount: '',
    max_discount_amount: '',
    is_qr_exclusive: false,
    start_date: '',
    end_date: '',
    usage_limit: '',
    applicable_categories: [],
    banner_image: '',
    banner_title: '',
    banner_subtitle: '',
    show_banner: false,
    banner_link_text: 'Shop Now'
  });

  const categories = [...new Set(restaurant?.menu?.map(item => item.category) || [])];

  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check if it's an image file
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Check file size (max 2MB for images)
      if (file.size > 2 * 1024 * 1024) {
        alert('Image file is too large. Maximum size is 2MB.\n\nTip: Compress your image at tinypng.com or use a smaller image.');
        return;
      }
      
      setImageFile(file);
      
      // Convert to base64 and preview
      const reader = new FileReader();
      reader.onload = () => {
        setFormData({...formData, banner_image: reader.result});
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, [restaurant]);

  const fetchDiscounts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/discounts/restaurant/${restaurant._id}`);
      setDiscounts(response.data);
    } catch (error) {
      console.error('Error fetching discounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('restaurantToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const submitData = {
        ...formData,
        discount_value: parseFloat(formData.discount_value),
        min_order_amount: formData.min_order_amount ? parseFloat(formData.min_order_amount) : 0,
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null
      };

      if (editingDiscount) {
        await axios.put(`/api/discounts/${editingDiscount.id}`, submitData, config);
      } else {
        await axios.post('/api/discounts', submitData, config);
      }

      fetchDiscounts();
      resetForm();
      alert(editingDiscount ? 'Discount updated successfully!' : 'Discount created successfully!');
    } catch (error) {
      console.error('Error saving discount:', error);
      alert('Failed to save discount. Please try again.');
    }
  };

  const handleEdit = (discount) => {
    setEditingDiscount(discount);
    setFormData({
      name: discount.name,
      description: discount.description || '',
      discount_type: discount.discount_type,
      discount_value: discount.discount_value.toString(),
      min_order_amount: discount.min_order_amount?.toString() || '',
      max_discount_amount: discount.max_discount_amount?.toString() || '',
      is_qr_exclusive: discount.is_qr_exclusive,
      start_date: discount.start_date ? new Date(discount.start_date).toISOString().slice(0, 16) : '',
      end_date: discount.end_date ? new Date(discount.end_date).toISOString().slice(0, 16) : '',
      usage_limit: discount.usage_limit?.toString() || '',
      applicable_categories: discount.applicable_categories || [],
      banner_image: discount.banner_image || '',
      banner_title: discount.banner_title || '',
      banner_subtitle: discount.banner_subtitle || '',
      show_banner: discount.show_banner || false,
      banner_link_text: discount.banner_link_text || 'Shop Now'
    });
    setShowForm(true);
  };

  const handleDelete = async (discountId) => {
    if (!window.confirm('Are you sure you want to delete this discount?')) return;

    try {
      const token = localStorage.getItem('restaurantToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      await axios.delete(`/api/discounts/${discountId}`, config);
      fetchDiscounts();
      alert('Discount deleted successfully!');
    } catch (error) {
      console.error('Error deleting discount:', error);
      alert('Failed to delete discount. Please try again.');
    }
  };

  const toggleActive = async (discount) => {
    try {
      const token = localStorage.getItem('restaurantToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      await axios.put(`/api/discounts/${discount.id}`, {
        ...discount,
        is_active: !discount.is_active
      }, config);
      
      fetchDiscounts();
    } catch (error) {
      console.error('Error toggling discount status:', error);
      alert('Failed to update discount status.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      min_order_amount: '',
      max_discount_amount: '',
      is_qr_exclusive: false,
      start_date: '',
      end_date: '',
      usage_limit: '',
      applicable_categories: [],
      banner_image: '',
      banner_title: '',
      banner_subtitle: '',
      show_banner: false,
      banner_link_text: 'Shop Now'
    });
    setEditingDiscount(null);
    setShowForm(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No limit';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDiscountDisplay = (discount) => {
    if (discount.discount_type === 'percentage') {
      return `${discount.discount_value}% OFF`;
    } else {
      return `₹${discount.discount_value} OFF`;
    }
  };

  const getStatusColor = (discount) => {
    if (!discount.is_active) return 'bg-gray-100 text-gray-600';
    
    const now = new Date();
    const startDate = discount.start_date ? new Date(discount.start_date) : null;
    const endDate = discount.end_date ? new Date(discount.end_date) : null;
    
    if (startDate && startDate > now) return 'bg-yellow-100 text-yellow-800';
    if (endDate && endDate < now) return 'bg-red-100 text-red-800';
    if (discount.usage_limit && discount.current_usage >= discount.usage_limit) return 'bg-red-100 text-red-800';
    
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (discount) => {
    if (!discount.is_active) return 'Inactive';
    
    const now = new Date();
    const startDate = discount.start_date ? new Date(discount.start_date) : null;
    const endDate = discount.end_date ? new Date(discount.end_date) : null;
    
    if (startDate && startDate > now) return 'Scheduled';
    if (endDate && endDate < now) return 'Expired';
    if (discount.usage_limit && discount.current_usage >= discount.usage_limit) return 'Limit Reached';
    
    return 'Active';
  };

  if (loading) {
    return <div className="text-center py-8">Loading discounts...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-800">🎉 Discount Management</h3>
          <p className="text-gray-600 text-sm">Create and manage discounts for festivals and special occasions</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center gap-2"
        >
          <Plus size={20} />
          Add Discount
        </button>
      </div>

      {/* Discounts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {discounts.map((discount) => (
          <div key={discount.id} className="bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-primary">
            {/* Banner Preview */}
            {discount.show_banner && discount.banner_image && (
              <div className="relative">
                <img 
                  src={discount.banner_image} 
                  alt={discount.banner_title || discount.name}
                  className="w-full h-32 object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                  <div className="text-center text-white">
                    <h4 className="font-bold text-lg">{discount.banner_title || discount.name}</h4>
                    {discount.banner_subtitle && (
                      <p className="text-sm opacity-90">{discount.banner_subtitle}</p>
                    )}
                  </div>
                </div>
                <div className="absolute top-2 right-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                    🎨 Banner Active
                  </span>
                </div>
              </div>
            )}
            
            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2">
                    {discount.name}
                    {discount.is_qr_exclusive && (
                      <QrCode size={16} className="text-blue-500" title="QR Exclusive" />
                    )}
                    {discount.show_banner && (
                      <span className="text-blue-500" title="Has Banner">🎨</span>
                    )}
                  </h4>
                  <p className="text-2xl font-bold text-primary">{getDiscountDisplay(discount)}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(discount)}
                    className="p-1 text-gray-500 hover:text-blue-600"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(discount.id)}
                    className="p-1 text-gray-500 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

            {discount.description && (
              <p className="text-gray-600 text-sm mb-3">{discount.description}</p>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(discount)}`}>
                  {getStatusText(discount)}
                </span>
              </div>
              </div>

              {discount.min_order_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Min Order:</span>
                  <span className="font-semibold">₹{discount.min_order_amount}</span>
                </div>
              )}

              {discount.max_discount_amount && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Max Discount:</span>
                  <span className="font-semibold">₹{discount.max_discount_amount}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-600">Valid Until:</span>
                <span className="font-semibold">{formatDate(discount.end_date)}</span>
              </div>

              {discount.usage_limit && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Usage:</span>
                  <span className="font-semibold">
                    {discount.current_usage || 0}/{discount.usage_limit}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t">
              <button
                onClick={() => toggleActive(discount)}
                className={`w-full py-2 px-4 rounded-lg text-sm font-semibold ${
                  discount.is_active
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {discount.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}

        {discounts.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-lg font-semibold mb-2">No Discounts Yet</h3>
            <p className="text-sm">Create your first discount to attract more customers!</p>
          </div>
        )}
      </div>

      {/* Discount Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {editingDiscount ? 'Edit Discount' : 'Create New Discount'}
              </h3>
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-gray-700 mb-2">Discount Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., Diwali Special, Weekend Offer"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Describe your discount offer..."
                    rows="2"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Discount Type *</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({...formData, discount_type: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">
                    Discount Value * {formData.discount_type === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    max={formData.discount_type === 'percentage' ? '100' : undefined}
                    step={formData.discount_type === 'percentage' ? '0.1' : '1'}
                    value={formData.discount_value}
                    onChange={(e) => setFormData({...formData, discount_value: e.target.value})}
                    placeholder={formData.discount_type === 'percentage' ? '10' : '100'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Minimum Order Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.min_order_amount}
                    onChange={(e) => setFormData({...formData, min_order_amount: e.target.value})}
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Maximum Discount Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.max_discount_amount}
                    onChange={(e) => setFormData({...formData, max_discount_amount: e.target.value})}
                    placeholder="No limit"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.usage_limit}
                    onChange={(e) => setFormData({...formData, usage_limit: e.target.value})}
                    placeholder="Unlimited"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_qr_exclusive}
                      onChange={(e) => setFormData({...formData, is_qr_exclusive: e.target.checked})}
                      className="rounded"
                    />
                    <QrCode size={20} className="text-blue-500" />
                    <span className="text-gray-700">QR Code Exclusive Discount</span>
                  </label>
                  <p className="text-sm text-gray-500 ml-6">Only customers who scan QR codes can use this discount</p>
                </div>

                {/* Banner Settings */}
                <div className="md:col-span-2 border-t pt-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    🎨 Banner Advertisement
                  </h4>
                  
                  <div className="space-y-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.show_banner}
                        onChange={(e) => setFormData({...formData, show_banner: e.target.checked})}
                        className="rounded"
                      />
                      <span className="text-gray-700">Show Banner in QR Ordering</span>
                    </label>
                    <p className="text-sm text-gray-500 ml-6">Display an attractive banner above the menu to promote this discount</p>

                    {formData.show_banner && (
                      <div className="ml-6 space-y-4 p-4 bg-gray-50 rounded-lg">
                        {/* Banner Image Upload */}
                        <div>
                          <label className="block text-gray-700 mb-2">Banner Image *</label>
                          <div className="space-y-3">
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  value="url"
                                  checked={imageUploadMethod === 'url'}
                                  onChange={(e) => setImageUploadMethod(e.target.value)}
                                  className="rounded"
                                />
                                <span className="text-sm">Image URL</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  value="upload"
                                  checked={imageUploadMethod === 'upload'}
                                  onChange={(e) => setImageUploadMethod(e.target.value)}
                                  className="rounded"
                                />
                                <span className="text-sm">Upload Image</span>
                              </label>
                            </div>

                            {imageUploadMethod === 'url' ? (
                              <input
                                type="url"
                                value={formData.banner_image}
                                onChange={(e) => setFormData({...formData, banner_image: e.target.value})}
                                placeholder="https://example.com/banner-image.jpg"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            ) : (
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageFileChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            )}
                          </div>
                          
                          {/* Image Preview */}
                          {formData.banner_image && (
                            <div className="mt-3">
                              <p className="text-sm text-gray-600 mb-2">Preview:</p>
                              <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
                                <img 
                                  src={formData.banner_image} 
                                  alt="Banner preview"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                                  <div className="text-center text-white">
                                    <h4 className="font-bold text-lg">{formData.banner_title || formData.name}</h4>
                                    {formData.banner_subtitle && (
                                      <p className="text-sm opacity-90">{formData.banner_subtitle}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Banner Text Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-gray-700 mb-2">Banner Title</label>
                            <input
                              type="text"
                              value={formData.banner_title}
                              onChange={(e) => setFormData({...formData, banner_title: e.target.value})}
                              placeholder="e.g., Special Diwali Offer!"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-700 mb-2">Banner Subtitle</label>
                            <input
                              type="text"
                              value={formData.banner_subtitle}
                              onChange={(e) => setFormData({...formData, banner_subtitle: e.target.value})}
                              placeholder="e.g., Get 10% off on all items"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-gray-700 mb-2">Call-to-Action Text</label>
                          <input
                            type="text"
                            value={formData.banner_link_text}
                            onChange={(e) => setFormData({...formData, banner_link_text: e.target.value})}
                            placeholder="e.g., Order Now, Shop Now, Get Discount"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-red-600"
                >
                  {editingDiscount ? 'Update Discount' : 'Create Discount'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}