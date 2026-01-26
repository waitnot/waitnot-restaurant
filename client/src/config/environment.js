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
  DEVELOPMENT_SERVER
};