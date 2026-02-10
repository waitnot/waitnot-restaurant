import { Link } from 'react-router-dom';
import { Users, User } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center flex-shrink-0 hover:opacity-80 transition-opacity">
            <img 
              src="/waitnotflogo.png" 
              alt="WaitNot Logo" 
              className="h-12 sm:h-14 md:h-16 lg:h-18 w-auto object-contain"
            />
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-4">
            <Link
              to="/staff-login"
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Users size={18} />
              <span className="hidden sm:inline">Staff Login</span>
            </Link>
            
            <Link
              to="/restaurant-login"
              className="flex items-center space-x-2 px-4 py-2 bg-primary text-white hover:bg-primary-dark rounded-lg transition-colors"
            >
              <User size={18} />
              <span className="hidden sm:inline">Restaurant Login</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
