// API configuration for both axios and fetch
const isDesktopApp = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron');
const API_BASE_URL = isDesktopApp 
  ? 'https://waitnot-restaurant.onrender.com'  // Always use production for desktop app
  : process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5000'  // Development server
    : 'https://waitnot-restaurant.onrender.com';  // Production server

console.log('API Base URL:', API_BASE_URL);
console.log('Is Desktop App:', isDesktopApp);

// Enhanced fetch wrapper with automatic base URL
export const apiRequest = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  console.log('API Fetch Request:', options.method || 'GET', url);
  
  // Add default headers
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available
  const token = localStorage.getItem('restaurantToken') || localStorage.getItem('adminToken');
  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }

  // Merge headers
  const headers = {
    ...defaultHeaders,
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log('API Fetch Response:', response.status, url);

    // Handle 401 errors (unauthorized)
    if (response.status === 401) {
      // Clear tokens and redirect to login
      localStorage.removeItem('restaurantToken');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('restaurantId');
      localStorage.removeItem('restaurantData');
      
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('login')) {
        window.location.href = '/restaurant-login';
      }
      throw new Error('Unauthorized');
    }

    return response;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

// Export the base URL for direct use
export { API_BASE_URL };

// Default export for convenience
export default apiRequest;