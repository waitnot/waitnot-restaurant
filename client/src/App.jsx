import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import RestaurantPage from './pages/RestaurantPage';
import Checkout from './pages/Checkout';
import QROrder from './pages/QROrder';
import RestaurantDashboard from './pages/RestaurantDashboard';
import RestaurantLogin from './pages/RestaurantLogin';
import RestaurantProfile from './pages/RestaurantProfile';
import PrinterSettings from './pages/PrinterSettings';
import Analytics from './pages/Analytics';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminCreateRestaurant from './pages/AdminCreateRestaurant';
import AdminEditRestaurant from './pages/AdminEditRestaurant';
import NotFound from './pages/NotFound';
import { CartProvider } from './context/CartContext';
import { FeatureProvider } from './context/FeatureContext';
import { useAnalytics } from './hooks/useAnalytics';

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
            <Routes>
              <Route path="/" element={<><Navbar /><Home /></>} />
              <Route path="/restaurant/:id" element={<><Navbar /><RestaurantPage /></>} />
              <Route path="/checkout" element={<><Navbar /><Checkout /></>} />
              <Route path="/qr/:restaurantId/:tableNumber" element={<QROrder />} />
              <Route path="/restaurant-login" element={<RestaurantLogin />} />
              <Route path="/restaurant-dashboard" element={<FeatureProvider><RestaurantDashboard /></FeatureProvider>} />
              <Route path="/restaurant-profile" element={<FeatureProvider><RestaurantProfile /></FeatureProvider>} />
              <Route path="/printer-settings" element={<FeatureProvider><PrinterSettings /></FeatureProvider>} />
              <Route path="/analytics" element={<FeatureProvider><Analytics /></FeatureProvider>} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
              <Route path="/admin/create-restaurant" element={<AdminCreateRestaurant />} />
              <Route path="/admin/restaurant/:id/edit" element={<AdminEditRestaurant />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          </AnalyticsWrapper>
        </Router>
      </CartProvider>
    </HelmetProvider>
  );
}

export default App;
