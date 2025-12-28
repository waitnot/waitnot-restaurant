import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';
import SEO from '../components/SEO';

export default function NotFound() {
  return (
    <>
      <SEO 
        title="Page Not Found - 404 Error | WaitNot"
        description="The page you're looking for doesn't exist. Return to WaitNot homepage to explore our QR code restaurant ordering system and digital menu solutions."
        keywords="404, page not found, WaitNot, restaurant ordering system"
      />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="max-w-2xl mx-auto text-center">
          {/* 404 Illustration */}
          <div className="mb-8">
            <div className="text-9xl font-bold text-red-600 mb-4">404</div>
            <div className="w-32 h-1 bg-red-500 mx-auto"></div>
          </div>
          
          {/* Error Message */}
          <h1 className="text-4xl font-bold text-black mb-4">
            Oops! Page Not Found
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            The page you're looking for seems to have wandered off the menu. 
            Don't worry, let's get you back to the right place!
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link 
              to="/"
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
            >
              <Home size={20} />
              Back to Homepage
            </Link>
            <button 
              onClick={() => window.history.back()}
              className="border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-8 py-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft size={20} />
              Go Back
            </button>
          </div>
          
          {/* Popular Links */}
          <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
            <h2 className="text-2xl font-bold text-black mb-6 flex items-center justify-center gap-2">
              <Search size={24} />
              Popular Pages
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link 
                to="/"
                className="text-red-600 hover:text-red-700 font-semibold py-2 px-4 rounded-lg hover:bg-red-50 transition-all"
              >
                🏠 Homepage - Explore WaitNot
              </Link>
              <Link 
                to="/restaurant-login"
                className="text-red-600 hover:text-red-700 font-semibold py-2 px-4 rounded-lg hover:bg-red-50 transition-all"
              >
                🔐 Restaurant Login
              </Link>
              <a 
                href="https://wa.me/916364039135"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-600 hover:text-red-700 font-semibold py-2 px-4 rounded-lg hover:bg-red-50 transition-all"
              >
                💬 Contact Support
              </a>
              <a 
                href="/#pricing"
                className="text-red-600 hover:text-red-700 font-semibold py-2 px-4 rounded-lg hover:bg-red-50 transition-all"
              >
                💰 View Pricing Plans
              </a>
            </div>
          </div>
          
          {/* Help Text */}
          <p className="text-gray-500 mt-8">
            Need help? Contact us at{' '}
            <a 
              href="https://wa.me/916364039135" 
              className="text-red-600 hover:text-red-700 font-semibold"
              target="_blank"
              rel="noopener noreferrer"
            >
              +91 6364039135
            </a>
          </p>
        </div>
      </div>
    </>
  );
}