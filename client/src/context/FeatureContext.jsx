import React, { createContext, useContext, useState, useEffect } from 'react';

const FeatureContext = createContext();

export const useFeatures = () => {
  const context = useContext(FeatureContext);
  if (!context) {
    throw new Error('useFeatures must be used within a FeatureProvider');
  }
  return context;
};

export const FeatureProvider = ({ children }) => {
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      const token = localStorage.getItem('restaurantToken');
      
      if (restaurantId && token) {
        // Try to fetch fresh restaurant data from API
        try {
          const response = await fetch(`/api/restaurants/${restaurantId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const restaurant = await response.json();
            setFeatures(restaurant.features || {});
            localStorage.setItem('restaurantData', JSON.stringify(restaurant));
            return;
          }
        } catch (apiError) {
          console.log('API not available, using cached data');
        }
      }
      
      // Fallback to cached restaurant data
      const restaurantData = localStorage.getItem('restaurantData');
      if (restaurantData) {
        const restaurant = JSON.parse(restaurantData);
        setFeatures(restaurant.features || {});
        return;
      }
      
      // Default features if no data available
      setFeatures({
        // Core Features
        menuManagement: true,
        orderManagement: true,
        qrCodeGeneration: true,
        tableManagement: true,
        
        // Analytics
        analytics: true,
        orderHistory: true,
        salesReports: true,
        
        // Settings
        profileEdit: false, // Disabled by default
        printerSettings: true,
        
        // Operations
        deliveryToggle: false, // Disabled by default
        deliveryOrders: true,
        realTimeOrders: true,
        notifications: true,
        thirdPartyOrders: true,
        staffOrders: true,
        
        // Security
        passwordChange: false, // Disabled by default
        
        // Media
        imageUpload: true,
        
        // Menu Features
        menuCategories: true,
        menuItemToggle: true,
        
        // Customer Management
        customerInfo: true,
        customerFeedback: true,
        
        // Advanced
        bulkOperations: true,
        exportData: true,
        multiLanguage: false // Disabled by default
      });
    } catch (error) {
      console.error('Error loading features:', error);
      // Set default features if loading fails
      setFeatures({
        // Core Features
        menuManagement: true,
        orderManagement: true,
        qrCodeGeneration: true,
        tableManagement: true,
        
        // Analytics
        analytics: true,
        orderHistory: true,
        salesReports: true,
        
        // Settings
        profileEdit: false, // Disabled by default
        printerSettings: true,
        
        // Operations
        deliveryToggle: false, // Disabled by default
        deliveryOrders: true,
        realTimeOrders: true,
        notifications: true,
        thirdPartyOrders: true,
        staffOrders: true,
        
        // Security
        passwordChange: false, // Disabled by default
        
        // Media
        imageUpload: true,
        
        // Menu Features
        menuCategories: true,
        menuItemToggle: true,
        
        // Customer Management
        customerInfo: true,
        customerFeedback: true,
        
        // Advanced
        bulkOperations: true,
        exportData: true,
        multiLanguage: false // Disabled by default
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshFeatures = async () => {
    try {
      const token = localStorage.getItem('restaurantToken');
      const restaurantId = localStorage.getItem('restaurantId');
      
      if (!token || !restaurantId) return;

      const response = await fetch(`/api/restaurants/${restaurantId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const restaurant = await response.json();
        setFeatures(restaurant.features || {});
        localStorage.setItem('restaurantData', JSON.stringify(restaurant));
      }
    } catch (error) {
      console.error('Error refreshing features:', error);
    }
  };

  const isFeatureEnabled = (featureName) => {
    return features[featureName] === true;
  };

  const value = {
    features,
    loading,
    isFeatureEnabled,
    refreshFeatures
  };

  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  );
};

export default FeatureContext;