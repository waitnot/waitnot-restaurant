import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Suspense, lazy } from 'react';
import Navbar from './components/Navbar';
import { CartProvider } from './context/CartContext';
import { FeatureProvider } from './context/FeatureContext';
import { useAnalytics } from './hooks/useAnalytics';

// Lazy load components for better performance
const Home = lazy(() => import('./pages/Home'));
const RestaurantPage = lazy(() => import('./pages/RestaurantPage'));
const Checkout = lazy(() => import('./pages/Checkout'));
const QROrder = lazy(() => import('./pages/QROrder'));
const HomeDelivery = lazy(() => import('./pages/HomeDelivery'));
const RestaurantDashboard = lazy(() => import('./pages/RestaurantDashboard'));
const RestaurantLogin = lazy(() => import('./pages/RestaurantLogin'));
const RestaurantProfile = lazy(() => import('./pages/RestaurantProfile'));
const PrinterSettings = lazy(() => import('./pages/PrinterSettings'));
const Analytics = lazy(() => import('./pages/Analytics'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminCreateRestaurant = lazy(() => import('./pages/AdminCreateRestaurant'));
const AdminEditRestaurant = lazy(() => import('./pages/AdminEditRestaurant'));
const StaffLogin = lazy(() => import('./pages/StaffLogin'));
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-600 font-medium">Loading...</p>
    </div>
  </div>
);

// Detect if running in Electron desktop app
const isDesktopApp = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron');

// Use HashRouter for desktop app, BrowserRouter for web
const Router = isDesktopApp ? HashRouter : BrowserRouter;

console.log('🔧 Router Configuration:', {
  isDesktopApp,
  routerType: isDesktopApp ? 'HashRouter' : 'BrowserRouter',
  userAgent: window.navigator.userAgent
});

// Analytics wrapper component
function AnalyticsWrapper({ children }) {
  useAnalytics();
  return children;
}

function App() {
  return (
    <HelmetProvider>
      <CartProvider>
        <Router>
          <AnalyticsWrapper>
            <div className="min-h-screen bg-gray-50">
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/" element={<><Navbar /><Home /></>} />
                  <Route path="/restaurant/:id" element={<><Navbar /><RestaurantPage /></>} />
                  <Route path="/checkout" element={<><Navbar /><Checkout /></>} />
                  <Route path="/qr/:restaurantId/:tableNumber" element={<QROrder />} />
                  <Route path="/delivery/:restaurantId" element={<HomeDelivery />} />
                  <Route path="/restaurant-login" element={<RestaurantLogin />} />
                  <Route path="/restaurant-dashboard" element={<FeatureProvider><RestaurantDashboard /></FeatureProvider>} />
                  <Route path="/restaurant-profile" element={<FeatureProvider><RestaurantProfile /></FeatureProvider>} />
                  <Route path="/printer-settings" element={<FeatureProvider><PrinterSettings /></FeatureProvider>} />
                  <Route path="/analytics" element={<FeatureProvider><Analytics /></FeatureProvider>} />
                  <Route path="/admin-login" element={<AdminLogin />} />
                  <Route path="/admin-dashboard" element={<AdminDashboard />} />
                  <Route path="/admin/create-restaurant" element={<AdminCreateRestaurant />} />
                  <Route path="/admin/restaurant/:id/edit" element={<AdminEditRestaurant />} />
                  <Route path="/staff-login" element={<StaffLogin />} />
                  <Route path="/staff-dashboard" element={<StaffDashboard />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </div>
          </AnalyticsWrapper>
        </Router>
      </CartProvider>
    </HelmetProvider>
  );
}

export default App;
