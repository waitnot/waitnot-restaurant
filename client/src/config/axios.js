import axios from 'axios';

// Use localhost for development, production server for desktop app
const isDesktopApp = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron');
const isCapacitorApp = typeof window !== 'undefined' && (window.Capacitor?.isNativePlatform?.() || window.location.protocol === 'capacitor:');
const isDevelopment = process.env.NODE_ENV === 'development';

const baseURL = (isDesktopApp || isCapacitorApp)
  ? 'https://waitnot-restaurant.onrender.com'
  : isDevelopment
    ? 'http://localhost:5001'
    : 'https://waitnot-restaurant.onrender.com';

console.log('🔧 Axios Configuration:', {
  isDesktopApp,
  isDevelopment,
  baseURL
});

// Create axios instance with optimized defaults
const axiosInstance = axios.create({
  baseURL,
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
axiosInstance.interceptors.request.use(
  (config) => {
    // Log all API requests for debugging (only in development)
    if (isDevelopment) {
      console.log('📤 API Request:', config.method?.toUpperCase(), config.url, 'Base:', config.baseURL);
    }
    
    // Add auth token if available
    const token = localStorage.getItem('restaurantToken') || localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    if (isDevelopment) {
      console.error('❌ Request Error:', error);
    }
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => {
    if (isDevelopment) {
      console.log('📥 API Response:', response.status, response.config.url);
    }
    return response;
  },
  (error) => {
    if (isDevelopment) {
      console.error('❌ Response Error:', error.response?.status, error.config?.url, error.message);
    }
    
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

// Set as default axios instance
axios.defaults.baseURL = baseURL;
axios.defaults.timeout = 10000;

export default axiosInstance;