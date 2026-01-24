import axios from 'axios';

// Configure axios base URL for production
const baseURL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:5000'  // Development server
  : 'https://waitnot-restaurant.onrender.com';  // Production server

// Set default base URL
axios.defaults.baseURL = baseURL;

// Add request interceptor to include auth token
axios.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('restaurantToken') || localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
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