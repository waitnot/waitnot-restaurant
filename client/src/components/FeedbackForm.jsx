import { useState } from 'react';
import axios from 'axios';

export default function FeedbackForm({ restaurantId, orderId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    rating: 5,
    feedbackText: '',
    feedbackType: 'general',
    isAnonymous: false
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.customerName.trim() && !formData.isAnonymous) {
      alert('Please enter your name or choose to submit anonymously');
      return;
    }
    
    if (!formData.feedbackText.trim()) {
      alert('Please enter your feedback');
      return;
    }

    setLoading(true);
    
    try {
      const feedbackData = {
        restaurantId,
        orderId,
        ...formData,
        customerName: formData.isAnonymous ? 'Anonymous' : formData.customerName
      };

      await axios.post('/api/feedback', feedbackData);
      
      if (onSuccess) {
        onSuccess();
      } else {
        alert('✅ Thank you for your feedback! We appreciate your input.');
      }
      
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('❌ Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">💬 Share Your Feedback</h2>
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
            {/* Anonymous Option */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anonymous"
                checked={formData.isAnonymous}
                onChange={(e) => handleInputChange('isAnonymous', e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="anonymous" className="text-sm text-gray-700">
                Submit anonymously
              </label>
            </div>

            {/* Customer Information */}
            {!formData.isAnonymous && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => handleInputChange('customerName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter your name"
                    required={!formData.isAnonymous}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter your phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter your email"
                  />
                </div>
              </>
            )}

            {/* Rating */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Rating *
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleInputChange('rating', star)}
                    className={`text-2xl ${
                      star <= formData.rating ? 'text-yellow-400' : 'text-gray-300'
                    } hover:text-yellow-400 transition-colors`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {formData.rating === 1 && 'Poor'}
                {formData.rating === 2 && 'Fair'}
                {formData.rating === 3 && 'Good'}
                {formData.rating === 4 && 'Very Good'}
                {formData.rating === 5 && 'Excellent'}
              </div>
            </div>

            {/* Feedback Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Feedback Type
              </label>
              <select
                value={formData.feedbackType}
                onChange={(e) => handleInputChange('feedbackType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="general">General</option>
                <option value="food">Food Quality</option>
                <option value="service">Service</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>

            {/* Feedback Text */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Your Feedback *
              </label>
              <textarea
                value={formData.feedbackText}
                onChange={(e) => handleInputChange('feedbackText', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                rows="4"
                placeholder="Share your experience with us..."
                required
              />
            </div>

            {/* Submit Button */}
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
                disabled={loading}
                className={`flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-600 font-semibold ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}