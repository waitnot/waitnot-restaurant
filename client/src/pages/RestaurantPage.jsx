import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Clock, MapPin, Plus, Minus, Leaf } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import { translateCategory } from '../utils/translationHelper';
import { useRestaurantTranslation } from '../hooks/useContentTranslation';
import { formatCurrency, convertNumerals } from '../utils/numberFormatter';

export default function RestaurantPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const { addToCart, cart } = useCart();
  const { translatedContent: translatedRestaurant, isTranslating } = useRestaurantTranslation(restaurant);

  useEffect(() => {
    fetchRestaurant();
  }, [id]);

  const fetchRestaurant = async () => {
    try {
      const { data } = await axios.get(`/api/restaurants/${id}`);
      setRestaurant(data);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    }
  };

  useEffect(() => {
    if (translatedRestaurant && !selectedCategory) {
      setSelectedCategory(t('all'));
    }
  }, [translatedRestaurant, t, selectedCategory]);

  if (!restaurant) return <div className="text-center py-12">{t('loading')}</div>;
  if (!translatedRestaurant) return <div className="text-center py-12">{t('loading')}</div>;

  const displayRestaurant = translatedRestaurant || restaurant;
  const uniqueCategories = [...new Set(displayRestaurant.menu.map(item => item.category))];
  const categories = [t('all'), ...uniqueCategories];
  
  const filteredMenu = selectedCategory === t('all') 
    ? displayRestaurant.menu 
    : displayRestaurant.menu.filter(item => item.category === selectedCategory || uniqueCategories.includes(item.category));

  const getItemQuantity = (itemId) => {
    const item = cart.find(i => i._id === itemId);
    return item ? item.quantity : 0;
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {/* Restaurant Header */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
          <div className="w-full md:w-48 h-40 sm:h-48 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center flex-shrink-0">
            {displayRestaurant.image ? (
              <img src={displayRestaurant.image} alt={displayRestaurant.name} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <span className="text-white text-4xl sm:text-6xl font-bold">{displayRestaurant.name[0]}</span>
            )}
          </div>
          
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">{displayRestaurant.name}</h1>
            <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">{displayRestaurant.description}</p>
            
            <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-1 text-yellow-500">
                <Star size={16} className="sm:w-[18px] sm:h-[18px]" fill="currentColor" />
                <span className="font-semibold">{convertNumerals(displayRestaurant.rating, i18n.language)}</span>
              </div>
              
              <div className="flex items-center gap-1 text-gray-600">
                <Clock size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span>
                  {(() => {
                    const time = displayRestaurant.deliveryTime || '30-40 min';
                    const timeWithoutMin = time.replace(/\s*min\s*$/i, '');
                    return `${convertNumerals(timeWithoutMin, i18n.language)} ${t('min')}`;
                  })()}
                </span>
              </div>
              
              {displayRestaurant.isDeliveryAvailable && (
                <div className="flex items-center gap-1 text-green-600">
                  <MapPin size={16} className="sm:w-[18px] sm:h-[18px]" />
                  <span>{t('deliveryAvailable')}</span>
                </div>
              )}
            </div>
            
            <div className="mt-3 sm:mt-4 text-sm sm:text-base">
              <span className="text-gray-700 font-semibold">{t('Cuisines')}: </span>
              <span className="text-gray-600">{displayRestaurant.cuisine?.join(', ')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2 hide-scrollbar">
        {categories.map((category, index) => {
          const isAllCategory = index === 0;
          const displayName = isAllCategory ? category : category;
          const categoryValue = isAllCategory ? t('all') : category;
          
          return (
            <button
              key={category}
              onClick={() => setSelectedCategory(categoryValue)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full whitespace-nowrap text-sm sm:text-base ${
                selectedCategory === categoryValue
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              {displayName}
            </button>
          );
        })}
      </div>

      {/* Menu List - Horizontal Cards */}
      <div className="space-y-3 sm:space-y-4">
        {filteredMenu.map((item) => {
          const quantity = getItemQuantity(item._id);
          
          return (
            <div key={item._id} className="bg-white rounded-lg shadow-md overflow-hidden flex">
              {/* Item Image */}
              <div className="w-28 sm:w-32 h-28 sm:h-32 bg-gradient-to-r from-accent to-secondary flex items-center justify-center flex-shrink-0 relative">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-3xl">🍽️</span>
                )}
                {item.isVeg && (
                  <div className="absolute top-1 left-1 bg-white p-1 rounded shadow-sm">
                    <Leaf size={14} className="text-green-600" />
                  </div>
                )}
              </div>
              
              {/* Item Details */}
              <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">{item.name}</h3>
                  <p className="text-gray-600 text-xs sm:text-sm mb-2 line-clamp-2">{item.description}</p>
                  <p className="text-lg sm:text-xl font-bold text-primary">{formatCurrency(item.price, i18n.language)}</p>
                </div>
              </div>
              
              {/* Add to Cart Button */}
              <div className="flex items-center p-3 sm:p-4">
                {quantity === 0 ? (
                  <button
                    onClick={() => addToCart(item, restaurant)}
                    className="bg-primary text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-red-600 transition-colors font-semibold text-sm sm:text-base whitespace-nowrap"
                  >
                    {t('add')}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 sm:gap-3 bg-primary text-white rounded-lg px-2 sm:px-3 py-2">
                    <button
                      onClick={() => {
                        const cartItem = cart.find(i => i._id === item._id);
                        if (cartItem) {
                          const { updateQuantity } = useCart();
                          updateQuantity(item._id, quantity - 1);
                        }
                      }}
                      className="p-1 hover:bg-red-600 rounded"
                    >
                      <Minus size={18} />
                    </button>
                    <span className="font-bold min-w-[20px] text-center">{quantity}</span>
                    <button
                      onClick={() => addToCart(item, restaurant)}
                      className="p-1 hover:bg-red-600 rounded"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
