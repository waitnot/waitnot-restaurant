import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import RestaurantPage from './pages/RestaurantPage';
import Checkout from './pages/Checkout';
import QROrder from './pages/QROrder';
import RestaurantDashboard from './pages/RestaurantDashboard';
import RestaurantLogin from './pages/RestaurantLogin';
import PrinterSettings from './pages/PrinterSettings';
import Analytics from './pages/Analytics';
import { CartProvider } from './context/CartContext';

function App() {
  return (
    <CartProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<><Navbar /><Home /></>} />
            <Route path="/restaurant/:id" element={<><Navbar /><RestaurantPage /></>} />
            <Route path="/checkout" element={<><Navbar /><Checkout /></>} />
            <Route path="/qr/:restaurantId/:tableNumber" element={<QROrder />} />
            <Route path="/restaurant-login" element={<RestaurantLogin />} />
            <Route path="/restaurant-dashboard" element={<RestaurantDashboard />} />
            <Route path="/printer-settings" element={<PrinterSettings />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </div>
      </Router>
    </CartProvider>
  );
}

export default App;
