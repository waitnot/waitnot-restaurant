// Environment configuration for WaitNot
// FORCED PRODUCTION MODE - NO localhost connections allowed

// Production server URL - ONLY option
const PRODUCTION_SERVER = 'https://waitnot-restaurant.onrender.com';

// Get the server URL - ALWAYS production
export const getServerUrl = () => {
  console.log('🌐 FORCED PRODUCTION SERVER');
  return PRODUCTION_SERVER;
};

// Get WebSocket URL - ALWAYS production
export const getWebSocketUrl = () => {
  return PRODUCTION_SERVER;
};

// Environment info for debugging - ALWAYS production
export const getEnvironmentInfo = () => {
  return {
    isDesktopApp: true,
    isProduction: true,
    nodeEnv: 'production',
    protocol: 'https:',
    hostname: 'waitnot-restaurant.onrender.com',
    userAgent: window.navigator.userAgent,
    serverUrl: PRODUCTION_SERVER,
    webSocketUrl: PRODUCTION_SERVER
  };
};

// Log environment info on load
console.log('🔍 FORCED PRODUCTION Configuration:', getEnvironmentInfo());

// Export constants
export {
  PRODUCTION_SERVER
};