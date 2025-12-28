import { useState, useEffect } from 'react';
import { Search, MapPin, Clock, Star, Smartphone, QrCode, Utensils, Users, CheckCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { convertNumerals } from '../utils/numberFormatter';

export default function Home() {
  const { t, i18n } = useTranslation();
  const [restaurants, setRestaurants] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRestaurants, setShowRestaurants] = useState(false);

  useEffect(() => {
    if (searchQuery.trim()) {
      fetchRestaurants();
      setShowRestaurants(true);
    } else {
      setShowRestaurants(false);
      setRestaurants([]);
    }
  }, [searchQuery]);

  const fetchRestaurants = async () => {
    try {
      const params = {};
      if (searchQuery) params.q = searchQuery;
      
      const { data } = await axios.get('/api/restaurants/search', { params });
      setRestaurants(data);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary via-red-500 to-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
              Welcome to <span className="text-yellow-300">WaitNot</span>
            </h1>
            <p className="text-xl sm:text-2xl mb-8 text-red-100 max-w-3xl mx-auto">
              Revolutionizing restaurant dining with QR code ordering, seamless payments, and instant service
            </p>
            
            {/* Search Section */}
            <div className="max-w-2xl mx-auto mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-4 text-gray-400" size={24} />
                <input
                  type="text"
                  placeholder="Search restaurants by name..."
                  className="w-full pl-12 pr-4 py-4 text-gray-800 border-0 rounded-xl focus:outline-none focus:ring-4 focus:ring-white/30 text-lg shadow-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {searchQuery && (
                <p className="text-sm text-red-100 mt-2">
                  {restaurants.length} restaurant{restaurants.length !== 1 ? 's' : ''} found
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/restaurant-login"
                className="bg-white text-primary px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center gap-2"
              >
                <Utensils size={20} />
                Restaurant Login
              </Link>
              <Link
                to="/admin-login"
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-primary transition-colors flex items-center gap-2"
              >
                <Users size={20} />
                Admin Portal
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Restaurant Results */}
      {showRestaurants && (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">
            Search Results
          </h2>
          
          {restaurants.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {restaurants.map((restaurant) => (
                <Link
                  key={restaurant._id}
                  to={`/restaurant/${restaurant._id}`}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="h-48 bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                    {restaurant.image ? (
                      <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-4xl font-bold">{restaurant.name[0]}</span>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{restaurant.name}</h3>
                    <p className="text-gray-600 text-sm mb-3">{restaurant.cuisine?.join(', ')}</p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Star size={16} fill="currentColor" />
                        <span className="font-semibold">{convertNumerals(restaurant.rating, i18n.language)}</span>
                      </div>
                      
                      <div className="flex items-center gap-1 text-gray-600">
                        <Clock size={16} />
                        <span>
                          {(() => {
                            const time = restaurant.deliveryTime || '30-40 min';
                            const timeWithoutMin = time.replace(/\s*min\s*$/i, '');
                            return `${convertNumerals(timeWithoutMin, i18n.language)} min`;
                          })()}
                        </span>
                      </div>
                      
                      {restaurant.isDeliveryAvailable && (
                        <div className="flex items-center gap-1 text-green-600">
                          <MapPin size={16} />
                          <span>Delivery</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No restaurants found. Try a different search term.</p>
            </div>
          )}
        </div>
      )}

      {/* Features Section */}
      {!showRestaurants && (
        <>
          <div className="max-w-7xl mx-auto px-4 py-16">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4">
                Why Choose WaitNot?
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Experience the future of dining with our innovative QR-based ordering system
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-white rounded-xl shadow-lg p-8 text-center hover:shadow-xl transition-shadow">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <QrCode className="text-primary" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">QR Code Ordering</h3>
                <p className="text-gray-600">
                  Simply scan the QR code at your table to browse the menu and place orders instantly. No waiting for waiters!
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white rounded-xl shadow-lg p-8 text-center hover:shadow-xl transition-shadow">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Smartphone className="text-primary" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Mobile Payments</h3>
                <p className="text-gray-600">
                  Pay seamlessly with UPI, cards, or cash. Secure transactions with instant confirmation and receipts.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white rounded-xl shadow-lg p-8 text-center hover:shadow-xl transition-shadow">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="text-primary" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Real-time Updates</h3>
                <p className="text-gray-600">
                  Get live updates on your order status. Know exactly when your food is being prepared and served.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-white rounded-xl shadow-lg p-8 text-center hover:shadow-xl transition-shadow">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Utensils className="text-primary" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Multi-cuisine Options</h3>
                <p className="text-gray-600">
                  Discover restaurants serving various cuisines. Filter by categories and find exactly what you're craving.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="bg-white rounded-xl shadow-lg p-8 text-center hover:shadow-xl transition-shadow">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="text-primary" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Group Ordering</h3>
                <p className="text-gray-600">
                  Perfect for families and groups. Multiple people can add items to the same table order simultaneously.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="bg-white rounded-xl shadow-lg p-8 text-center hover:shadow-xl transition-shadow">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="text-primary" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Contactless Service</h3>
                <p className="text-gray-600">
                  Enjoy a completely contactless dining experience. Safe, hygienic, and convenient for everyone.
                </p>
              </div>
            </div>
          </div>

          {/* How It Works Section */}
          <div className="bg-gray-100 py-16">
            <div className="max-w-7xl mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4">
                  How It Works
                </h2>
                <p className="text-xl text-gray-600">
                  Get started in just 3 simple steps
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Step 1 */}
                <div className="text-center">
                  <div className="bg-primary text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                    1
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Scan QR Code</h3>
                  <p className="text-gray-600">
                    Use your phone camera to scan the QR code placed on your restaurant table
                  </p>
                </div>

                {/* Step 2 */}
                <div className="text-center">
                  <div className="bg-primary text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                    2
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Browse & Order</h3>
                  <p className="text-gray-600">
                    Explore the menu, filter by categories, and add your favorite items to cart
                  </p>
                </div>

                {/* Step 3 */}
                <div className="text-center">
                  <div className="bg-primary text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                    3
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Pay & Enjoy</h3>
                  <p className="text-gray-600">
                    Complete payment and relax while your fresh food is prepared and served
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-primary text-white py-16">
            <div className="max-w-4xl mx-auto px-4 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Ready to Transform Your Dining Experience?
              </h2>
              <p className="text-xl mb-8 text-red-100">
                Join thousands of satisfied customers who have discovered the future of restaurant dining
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => {
                    document.querySelector('input[type="text"]').focus();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="bg-white text-primary px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Search size={20} />
                  Find Restaurants
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-800 text-white py-12">
            <div className="max-w-7xl mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-2xl font-bold mb-4 text-yellow-300">WaitNot</h3>
                  <p className="text-gray-300">
                    Revolutionizing the restaurant industry with innovative QR-based ordering and payment solutions.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold mb-4">For Restaurants</h4>
                  <ul className="space-y-2 text-gray-300">
                    <li><Link to="/restaurant-login" className="hover:text-white">Restaurant Login</Link></li>
                    <li><Link to="/admin-login" className="hover:text-white">Admin Portal</Link></li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold mb-4">Features</h4>
                  <ul className="space-y-2 text-gray-300">
                    <li>QR Code Ordering</li>
                    <li>Mobile Payments</li>
                    <li>Real-time Updates</li>
                    <li>Contactless Service</li>
                  </ul>
                </div>
              </div>
              
              <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
                <p>&copy; 2024 WaitNot. All rights reserved.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
