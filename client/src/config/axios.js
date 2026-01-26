import axios from 'axios';

// Use localhost for development, production server for desktop app
const isDesktopApp = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron');
const isDevelopment = process.env.NODE_ENV === 'development';

const baseURL = isDesktopApp 
  ? 'https://waitnot-restaurant.onrender.com'  // Desktop app always uses production
  : isDevelopment 
    ? 'http://localhost:5000'  // Development uses local server
    : 'https://waitnot-restaurant.onrender.com';  // Production uses production server

console.log('🔧 Axios Configuration:', {
  isDesktopApp,
  isDevelopment,
  baseURL
});

// Set default base URL
axios.defaults.baseURL = baseURL;

// Add request interceptor to include auth token
axios.interceptors.request.use(
  (config) => {
    // Log all API requests for debugging
    console.log('📤 API Request:', config.method?.toUpperCase(), config.url, 'Base:', config.baseURL);
    
    // Add auth token if available
    const token = localStorage.getItem('restaurantToken') || localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
axios.interceptors.response.use(
  (response) => {
    console.log('📥 API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('❌ Response Error:', error.response?.status, error.config?.url, error.message);
    
    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401) {
      // Clear tokens and redirect to login
      localStorage.removeItem('restaurantToken');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('restaurantId');
      localStorage.removeItem('restaurantData');
      
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('login')) {
        window.location.href = '/restaurant-login';
      }
    }
    return Promise.reject(error);
  }
);

export default axios;