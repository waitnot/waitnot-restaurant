import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Save, User, MapPin, Phone, Mail, Clock, Star, Utensils, Lock, Eye, EyeOff } from 'lucide-react';
import { compressImage, validateImageFile } from '../utils/imageUtils.jsx';
import FeatureGuard from '../components/FeatureGuard';

const RestaurantProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  
  // Password change states
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    phone: '',
    address: '',
    deliveryTime: '',
    cuisine: [],
    isDeliveryAvailable: true,
    tables: 0
  });

  const [newCuisine, setNewCuisine] = useState('');

  useEffect(() => {
    loadRestaurantData();
  }, []);

  const loadRestaurantData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('restaurantToken');
      if (!token) {
        navigate('/restaurant-login');
        return;
      }

      const restaurantData = JSON.parse(localStorage.getItem('restaurantData'));
      if (restaurantData) {
        setFormData({
          name: restaurantData.name || '',
          description: restaurantData.description || '',
          image: restaurantData.image || '',
          phone: restaurantData.phone || '',
          address: restaurantData.address || '',
          deliveryTime: restaurantData.deliveryTime || '',
          cuisine: restaurantData.cuisine || [],
          isDeliveryAvailable: restaurantData.isDeliveryAvailable !== false,
          tables: restaurantData.tables || 0
        });
        setImagePreview(restaurantData.image || '');
      }
    } catch (error) {
      console.error('Error loading restaurant data:', error);
      setMessage('Error loading restaurant data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setMessage(validation.error);
        return;
      }

      try {
        // Compress image
        const compressedImage = await compressImage(file, 800, 0.8);
        setImagePreview(compressedImage);
        setFormData(prev => ({
          ...prev,
          image: compressedImage
        }));
        setMessage(''); // Clear any previous error messages
      } catch (error) {
        console.error('Error processing image:', error);
        setMessage('Error processing image. Please try again.');
      }
    }
  };

  const addCuisine = () => {
    if (newCuisine.trim() && !formData.cuisine.includes(newCuisine.trim())) {
      setFormData(prev => ({
        ...prev,
        cuisine: [...prev.cuisine, newCuisine.trim()]
      }));
      setNewCuisine('');
    }
  };

  const removeCuisine = (cuisineToRemove) => {
    setFormData(prev => ({
      ...prev,
      cuisine: prev.cuisine.filter(c => c !== cuisineToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('restaurantToken');
      const restaurantData = JSON.parse(localStorage.getItem('restaurantData'));
      
      if (!token || !restaurantData) {
        navigate('/restaurant-login');
        return;
      }

      const response = await fetch(`/api/restaurants/${restaurantData._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const updatedRestaurant = await response.json();
        
        // Update local storage
        localStorage.setItem('restaurantData', JSON.stringify(updatedRestaurant));
        
        setMessage('Profile updated successfully!');
        
        // Redirect back to dashboard after a short delay
        setTimeout(() => {
          navigate('/restaurant-dashboard');
        }, 2000);
      } else {
        const error = await response.json();
        setMessage(error.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Error updating profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordChanging(true);
    setPasswordMessage('');

    try {
      // Validate passwords
      if (passwordData.newPassword.length < 6) {
        setPasswordMessage('New password must be at least 6 characters long');
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setPasswordMessage('New passwords do not match');
        return;
      }

      const restaurantData = JSON.parse(localStorage.getItem('restaurantData'));
      
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          restaurantId: restaurantData._id,
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const result = await response.json();

      if (response.ok) {
        setPasswordMessage('Password changed successfully!');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        
        // Hide password section after successful change
        setTimeout(() => {
          setShowPasswordSection(false);
          setPasswordMessage('');
        }, 2000);
      } else {
        setPasswordMessage(result.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordMessage('Error changing password. Please try again.');
    } finally {
      setPasswordChanging(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading restaurant data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
            <h1 className="text-2xl font-bold text-white flex items-center">
              <User className="mr-3" />
              Restaurant Profile
            </h1>
            <p className="text-red-100 mt-1">Update your restaurant information and settings</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            {message && (
              <div className={`mb-6 p-4 rounded-lg ${
                message.includes('successfully') 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {message}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Restaurant Image */}
                <FeatureGuard feature="imageUpload">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Restaurant Image
                    </label>
                    <div className="flex flex-col items-center">
                      <div className="relative w-48 h-48 bg-gray-200 rounded-lg overflow-hidden mb-4">
                        {imagePreview ? (
                          <img 
                            src={imagePreview} 
                            alt="Restaurant" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Camera size={48} />
                          </div>
                        )}
                        <label className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                          <Camera className="text-white" size={24} />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <p className="text-sm text-gray-500 text-center">
                        Click to upload image (Max 5MB)
                      </p>
                    </div>
                  </div>
                </FeatureGuard>

                {/* Basic Information */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Restaurant Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Enter restaurant name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Describe your restaurant..."
                  />
                </div>

                {/* Contact Information */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="inline mr-1" size={16} />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="inline mr-1" size={16} />
                    Address
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Enter complete address"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Operational Details */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="inline mr-1" size={16} />
                    Delivery Time
                  </label>
                  <input
                    type="text"
                    name="deliveryTime"
                    value={formData.deliveryTime}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="e.g., 30-45 min"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Tables
                  </label>
                  <input
                    type="number"
                    name="tables"
                    value={formData.tables}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Enter number of tables"
                  />
                </div>

                {/* Cuisine Types */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Utensils className="inline mr-1" size={16} />
                    Cuisine Types
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newCuisine}
                      onChange={(e) => setNewCuisine(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCuisine())}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="Add cuisine type"
                    />
                    <button
                      type="button"
                      onClick={addCuisine}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.cuisine.map((cuisine, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm"
                      >
                        {cuisine}
                        <button
                          type="button"
                          onClick={() => removeCuisine(cuisine)}
                          className="ml-2 text-red-600 hover:text-red-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Delivery Option */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="isDeliveryAvailable"
                      checked={formData.isDeliveryAvailable}
                      onChange={handleInputChange}
                      className="mr-2 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Delivery Available
                    </span>
                  </label>
                </div>

                {/* Password Change Section */}
                <FeatureGuard feature="passwordChange">
                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900 flex items-center">
                        <Lock className="mr-2" size={20} />
                        Change Password
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordSection(!showPasswordSection);
                          setPasswordMessage('');
                          setPasswordData({
                            currentPassword: '',
                            newPassword: '',
                            confirmPassword: ''
                          });
                        }}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        {showPasswordSection ? 'Cancel' : 'Change Password'}
                      </button>
                    </div>

                  {showPasswordSection && (
                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                      {passwordMessage && (
                        <div className={`p-3 rounded-lg text-sm ${
                          passwordMessage.includes('successfully') 
                            ? 'bg-green-50 text-green-700 border border-green-200' 
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {passwordMessage}
                        </div>
                      )}

                      <form onSubmit={handlePasswordChange}>
                        <div className="space-y-4">
                          {/* Current Password */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Current Password *
                            </label>
                            <div className="relative">
                              <input
                                type={showPasswords.current ? 'text' : 'password'}
                                value={passwordData.currentPassword}
                                onChange={(e) => setPasswordData(prev => ({
                                  ...prev,
                                  currentPassword: e.target.value
                                }))}
                                required
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                placeholder="Enter current password"
                              />
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility('current')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                              >
                                {showPasswords.current ? <EyeOff size={20} /> : <Eye size={20} />}
                              </button>
                            </div>
                          </div>

                          {/* New Password */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              New Password *
                            </label>
                            <div className="relative">
                              <input
                                type={showPasswords.new ? 'text' : 'password'}
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData(prev => ({
                                  ...prev,
                                  newPassword: e.target.value
                                }))}
                                required
                                minLength={6}
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                placeholder="Enter new password (min 6 characters)"
                              />
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility('new')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                              >
                                {showPasswords.new ? <EyeOff size={20} /> : <Eye size={20} />}
                              </button>
                            </div>
                          </div>

                          {/* Confirm New Password */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Confirm New Password *
                            </label>
                            <div className="relative">
                              <input
                                type={showPasswords.confirm ? 'text' : 'password'}
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData(prev => ({
                                  ...prev,
                                  confirmPassword: e.target.value
                                }))}
                                required
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                placeholder="Confirm new password"
                              />
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility('confirm')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                              >
                                {showPasswords.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
                              </button>
                            </div>
                          </div>

                          {/* Password Change Button */}
                          <button
                            type="submit"
                            disabled={passwordChanging}
                            className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          >
                            {passwordChanging ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Changing Password...
                              </>
                            ) : (
                              <>
                                <Lock className="mr-2" size={16} />
                                Change Password
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
                </FeatureGuard>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-6">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2" size={20} />
                        Save Changes
                      </>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => navigate('/restaurant-dashboard')}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RestaurantProfile;