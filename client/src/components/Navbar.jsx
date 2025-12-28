import { Link } from 'react-router-dom';

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
        </div>
      </div>
    </nav>
  );
}
