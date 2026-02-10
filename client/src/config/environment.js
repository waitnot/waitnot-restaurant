// Environment configuration for WaitNot
// Smart environment detection for different deployment scenarios

// Detect if running in Electron desktop app
const isDesktopApp = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron');

// Detect if running in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Production server URL
const PRODUCTION_SERVER = 'https://waitnot-restaurant.onrender.com';

// Development server URL  
const DEVELOPMENT_SERVER = 'http://localhost:5000';

// Production frontend URL (for QR codes) - Always use this for QR codes so customers can access them
const PRODUCTION_FRONTEND = 'https://waitnot-restaurant.onrender.com';

// Development frontend URL
const DEVELOPMENT_FRONTEND = 'http://localhost:3000';

// Get the correct server URL based on environment
export const getServerUrl = () => {
  if (isDesktopApp) {
    console.log('🖥️ Desktop app detected - using production server');
    return PRODUCTION_SERVER;
  }
  
  if (isDevelopment) {
    console.log('🔧 Development environment detected - using local server');
    return DEVELOPMENT_SERVER;
  }
  
  console.log('🌐 Production environment detected - using production server');
  return PRODUCTION_SERVER;
};

// Get the correct frontend URL for QR codes
export const getFrontendUrl = () => {
  // Always use production domain for QR codes to ensure they work for customers
  // Even in development, QR codes should point to production so customers can access them
  console.log('🌐 Using production frontend for QR codes');
  return PRODUCTION_FRONTEND;
};

// Get WebSocket URL (same as server URL)
export const getWebSocketUrl = () => {
  return getServerUrl();
};

// Environment info for debugging
export const getEnvironmentInfo = () => {
  return {
    isDesktopApp,
    isDevelopment,
    nodeEnv: process.env.NODE_ENV,
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    userAgent: window.navigator.userAgent,
    serverUrl: getServerUrl(),
    frontendUrl: getFrontendUrl(),
    webSocketUrl: getWebSocketUrl()
  };
};

// Log environment info on load
console.log('🔍 Environment Configuration:', getEnvironmentInfo());

// Export constants
export {
  isDesktopApp,
  isDevelopment,
  PRODUCTION_SERVER,
  DEVELOPMENT_SERVER,
  PRODUCTION_FRONTEND,
  DEVELOPMENT_FRONTEND
};