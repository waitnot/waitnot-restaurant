import axios from 'axios';

const PRODUCTION_URL = 'https://waitnot-restaurant.onrender.com';

const isDesktopApp = typeof window !== 'undefined' && window.navigator?.userAgent?.includes('Electron');
const isCapacitorApp = typeof window !== 'undefined' && (
  window.Capacitor?.isNativePlatform?.() ||
  window.location?.protocol === 'capacitor:'
);

// True dev = running on localhost in a browser (not native app)
const isLocalDev = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  !isDesktopApp && !isCapacitorApp;

// Local dev: use local server directly (port 5001) — avoids any proxy or CORS issues
// Native apps: use production
// Deployed web: use production
const baseURL = isLocalDev
  ? 'http://localhost:5001'
  : PRODUCTION_URL;

console.log('🔧 Axios baseURL:', baseURL);

// Create axios instance with optimized defaults
const axiosInstance = axios.create({
  baseURL,
  timeout: 30000, // 30s — handles Neon cold start (~5-8s)
  headers: { 'Content-Type': 'application/json' },
});

axiosInstance.interceptors.request.use(
  (config) => {
    if (isLocalDev) {
      console.log('📤 API Request:', config.method?.toUpperCase(), config.url);
    }
    const token = localStorage.getItem('restaurantToken') || localStorage.getItem('adminToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isLocalDev) {
      console.error('❌ Response Error:', error.response?.status, error.config?.url, error.message);
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('restaurantToken');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('restaurantId');
      localStorage.removeItem('restaurantData');
      if (!window.location.pathname.includes('login')) {
        window.location.href = '/restaurant-login';
      }
    }
    return Promise.reject(error);
  }
);

// Apply to bare axios so pages using `import axios from 'axios'` also hit the right server
axios.defaults.baseURL = baseURL;
axios.defaults.timeout = 30000;

export default axiosInstance;