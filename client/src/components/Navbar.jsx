import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import LanguageSelector from './LanguageSelector';

export default function Navbar() {
  const { cart } = useCart();
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 sm:h-24">
          {/* Logo */}
          <Link to="/" className="flex items-center flex-shrink-0 hover:opacity-80 transition-opacity">
            <img 
              src="/waitnotflogo.png" 
              alt="WaitNot Logo" 
              className="h-14 sm:h-16 md:h-18 w-auto object-contain"
            />
          </Link>
          
          {/* Right Side Navigation */}
          <div className="flex items-center gap-3 sm:gap-6">
            {/* Language Selector */}
            <div className="flex items-center">
              <LanguageSelector />
            </div>
            
            {/* Cart Link */}
            <Link 
              to="/checkout" 
              className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-primary transition-all duration-200"
            >
              <ShoppingCart size={24} className="text-primary" />
              <span className="hidden md:inline font-medium">Cart</span>
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center font-bold px-1.5 shadow-lg animate-pulse">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
