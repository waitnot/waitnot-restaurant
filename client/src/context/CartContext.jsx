import { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [restaurant, setRestaurant] = useState(null);

  const addToCart = (item, restaurantInfo) => {
    if (restaurant && restaurant._id !== restaurantInfo._id) {
      if (!window.confirm('Clear cart and add items from different restaurant?')) {
        return;
      }
      setCart([]);
    }
    
    setRestaurant(restaurantInfo);
    
    const existing = cart.find(i => i._id === item._id);
    if (existing) {
      setCart(cart.map(i => 
        i._id === item._id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(i => i._id !== itemId));
    if (cart.length === 1) setRestaurant(null);
  };

  const updateQuantity = (itemId, quantity) => {
    if (quantity === 0) {
      removeFromCart(itemId);
    } else {
      setCart(cart.map(i => i._id === itemId ? { ...i, quantity } : i));
    }
  };

  const clearCart = () => {
    setCart([]);
    setRestaurant(null);
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ 
      cart, 
      restaurant, 
      addToCart, 
      removeFromCart, 
      updateQuantity, 
      clearCart, 
      total 
    }}>
      {children}
    </CartContext.Provider>
  );
};
