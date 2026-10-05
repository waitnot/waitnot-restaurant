import { Link } from 'react-router-dom';

export default function Navbar() {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 sm:h-24">
          {/* Logo */}
          <Link to="/" className="flex items-center flex-shrink-0 hover:opacity-80 transition-opacity">
            <img
              src="/waitnotflogo.png"
              alt="WaitNot Logo"
              className="h-14 sm:h-16 md:h-20 w-auto object-contain"
            />
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollTo('restaurant-benefits')} className="text-sm font-medium text-gray-600 hover:text-red-600 transition-colors">Features</button>
            <button onClick={() => scrollTo('pricing')} className="text-sm font-medium text-gray-600 hover:text-red-600 transition-colors">Pricing</button>
            <button onClick={() => scrollTo('how-it-works')} className="text-sm font-medium text-gray-600 hover:text-red-600 transition-colors">How It Works</button>
            <button onClick={() => scrollTo('cta-section')} className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors">Get Started</button>
          </div>

          {/* Mobile menu — just Get Started */}
          <div className="md:hidden">
            <button onClick={() => scrollTo('cta-section')} className="px-3 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors">Get Started</button>
          </div>
        </div>
      </div>
    </nav>
  );
}
