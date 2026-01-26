import { useState } from 'react';
import axios from 'axios';

export default function ThirdPartyOrderForm({ restaurant, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    platform: 'swiggy',
    platformOrderId: '',
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    items: [],
    totalAmount: '',
    platformFee: '',
    commissionRate: '',
    estimatedDeliveryTime: '',
    specialInstructions: ''
  });
  const [currentItem, setCurrentItem] = useState({
    name: '',
    price: '',
    quantity: 1
  });
  const [loading, setLoading] = useState(false);

  const platforms = [
    { value: 'swiggy', label: '🍊 Swiggy', color: 'bg-orange-500' },
    { value: 'zomato', label: '🍅 Zomato', color: 'bg-red-500' },
    { value: 'uber-eats', label: '🚗 Uber Eats', color: 'bg-black' },
    { value: 'foodpanda', label: '🐼 Foodpanda', color: 'bg-pink-500' }
  ];

  const addItem = () => {
    if (!currentItem.name || !currentItem.price || currentItem.quantity < 1) {
      alert('Please fill in all item details');
      return;
    }

    const newItem = {
      ...currentItem,
      price: parseFloat(currentItem.price),
      quantity: parseInt(currentItem.quantity)
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    setCurrentItem({ name: '', price: '', quantity: 1 });
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateCommission = () => {
    const total = parseFloat(formData.totalAmount) || calculateTotal();
    const rate = parseFloat(formData.commissionRate) || 0;
    return (total * rate / 100);
  };

  const calculateNetAmount = () => {
    const total = parseFloat(formData.totalAmount) || calculateTotal();
    const commission = calculateCommission();
    const platformFee = parseFloat(formData.platformFee) || 0;
    return total - commission - platformFee;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.platformOrderId || !formData.customerName || formData.items.length === 0) {
      alert('Please fill in all required fields and add at least one item');
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        restaurantId: restaurant._id,
        platform: formData.platform,
        platformOrderId: formData.platformOrderId,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        deliveryAddress: formData.deliveryAddress,
        items: formData.items,
        totalAmount: parseFloat(formData.totalAmount) || calculateTotal(),
        platformFee: parseFloat(formData.platformFee) || 0,
        commissionRate: parseFloat(formData.commissionRate) || 0,
        estimatedDeliveryTime: formData.estimatedDeliveryTime || null,
        specialInstructions: formData.specialInstructions,
        orderType: 'delivery'
      };

      await axios.post('/api/third-party', orderData);
      
      if (onSuccess) {
        onSuccess();
      } else {
        alert('✅ Third-party order created successfully!');
      }
      
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error creating third-party order:', error);
      alert('❌ Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlatform = platforms.find(p => p.value === formData.platform);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">📱 Add Third-Party Order</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Platform Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Platform *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {platforms.map((platform) => (
                  <button
                    key={platform.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, platform: platform.value }))}
                    className={`p-3 rounded-lg border-2 font-semibold text-white ${
                      formData.platform === platform.value
                        ? `${platform.color} border-gray-800`
                        : `${platform.color} opacity-50 border-gray-300`
                    }`}
                  >
                    {platform.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Order Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {selectedPlatform?.label} Order ID *
                </label>
                <input
                  type="text"
                  value={formData.platformOrderId}
                  onChange={(e) => setFormData(prev => ({ ...prev, platformOrderId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., SWG123456789"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Customer name"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Customer Phone
                </label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Estimated Delivery Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.estimatedDeliveryTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimatedDeliveryTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Delivery Address */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Delivery Address
              </label>
              <textarea
                value={formData.deliveryAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                rows="2"
                placeholder="Complete delivery address"
              />
            </div>

            {/* Items Section */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Order Items *
              </label>
              
              {/* Add Item Form */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={currentItem.name}
                    onChange={(e) => setCurrentItem(prev => ({ ...prev, name: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Item name"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={currentItem.price}
                    onChange={(e) => setCurrentItem(prev => ({ ...prev, price: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Price"
                  />
                  <input
                    type="number"
                    min="1"
                    value={currentItem.quantity}
                    onChange={(e) => setCurrentItem(prev => ({ ...prev, quantity: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Qty"
                  />
                  <button
                    type="button"
                    onClick={addItem}
                    className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-red-600 font-semibold"
                  >
                    Add Item
                  </button>
                </div>
              </div>

              {/* Items List */}
              {formData.items.length > 0 && (
                <div className="space-y-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center bg-white p-3 rounded-lg border">
                      <div>
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-gray-600 ml-2">₹{item.price} x {item.quantity}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">₹{item.price * item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Financial Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Total Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={`Auto: ₹${calculateTotal()}`}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Platform Fee (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.platformFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, platformFee: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.commissionRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, commissionRate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., 20"
                />
              </div>
            </div>

            {/* Financial Summary */}
            {(formData.totalAmount || formData.platformFee || formData.commissionRate) && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">💰 Financial Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Order Total:</span>
                    <span>₹{parseFloat(formData.totalAmount) || calculateTotal()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Fee:</span>
                    <span>-₹{parseFloat(formData.platformFee) || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Commission ({formData.commissionRate || 0}%):</span>
                    <span>-₹{calculateCommission().toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-bold text-green-600">
                    <span>Net Amount:</span>
                    <span>₹{calculateNetAmount().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Special Instructions */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Special Instructions
              </label>
              <textarea
                value={formData.specialInstructions}
                onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                rows="2"
                placeholder="Any special cooking instructions or notes..."
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading || formData.items.length === 0}
                className={`flex-1 px-4 py-2 ${selectedPlatform?.color} text-white rounded-lg hover:opacity-90 font-semibold ${
                  loading || formData.items.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'Creating Order...' : `Create ${selectedPlatform?.label} Order`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}