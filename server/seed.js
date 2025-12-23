import bcrypt from 'bcryptjs';
import { initDB, restaurantDB } from './db.js';

const sampleRestaurants = [
  {
    name: 'Spice Garden',
    description: 'Authentic Indian cuisine with a modern twist',
    rating: 4.5,
    deliveryTime: '30-40 min',
    cuisine: ['Indian', 'North Indian', 'Tandoor'],
    address: '123 Main Street, City',
    phone: '1234567890',
    email: 'spice@example.com',
    password: 'password123',
    isDeliveryAvailable: true,
    tables: 10,
    menu: [
      { name: 'Paneer Tikka', price: 250, category: 'Starters', isVeg: true, description: 'Grilled cottage cheese with spices', available: true },
      { name: 'Chicken Biryani', price: 350, category: 'Main Course', isVeg: false, description: 'Aromatic rice with tender chicken', available: true },
      { name: 'Dal Makhani', price: 200, category: 'Main Course', isVeg: true, description: 'Creamy black lentils', available: true },
      { name: 'Gulab Jamun', price: 80, category: 'Desserts', isVeg: true, description: 'Sweet milk dumplings', available: true },
      { name: 'Mango Lassi', price: 100, category: 'Drinks', isVeg: true, description: 'Refreshing yogurt drink', available: true }
    ]
  },
  {
    name: 'Pizza Paradise',
    description: 'Wood-fired pizzas and Italian delights',
    rating: 4.3,
    deliveryTime: '25-35 min',
    cuisine: ['Italian', 'Pizza', 'Pasta'],
    address: '456 Oak Avenue, City',
    phone: '9876543210',
    email: 'pizza@example.com',
    password: 'password123',
    isDeliveryAvailable: true,
    tables: 12,
    menu: [
      { name: 'Margherita Pizza', price: 300, category: 'Main Course', isVeg: true, description: 'Classic tomato and mozzarella', available: true },
      { name: 'Pepperoni Pizza', price: 400, category: 'Main Course', isVeg: false, description: 'Loaded with pepperoni', available: true },
      { name: 'Garlic Bread', price: 120, category: 'Starters', isVeg: true, description: 'Crispy bread with garlic butter', available: true },
      { name: 'Tiramisu', price: 150, category: 'Desserts', isVeg: true, description: 'Italian coffee dessert', available: true },
      { name: 'Coke', price: 50, category: 'Drinks', isVeg: true, description: 'Chilled soft drink', available: true }
    ]
  },
  {
    name: 'Burger Hub',
    description: 'Juicy burgers and crispy fries',
    rating: 4.6,
    deliveryTime: '20-30 min',
    cuisine: ['American', 'Fast Food', 'Burgers'],
    address: '789 Elm Street, City',
    phone: '5551234567',
    email: 'burger@example.com',
    password: 'password123',
    isDeliveryAvailable: true,
    tables: 8,
    menu: [
      { name: 'Classic Burger', price: 180, category: 'Main Course', isVeg: false, description: 'Beef patty with cheese', available: true },
      { name: 'Veggie Burger', price: 150, category: 'Main Course', isVeg: true, description: 'Plant-based patty', available: true },
      { name: 'French Fries', price: 80, category: 'Starters', isVeg: true, description: 'Crispy golden fries', available: true },
      { name: 'Chocolate Shake', price: 120, category: 'Drinks', isVeg: true, description: 'Thick chocolate milkshake', available: true }
    ]
  }
];

async function seedDatabase() {
  try {
    await initDB();
    console.log('Initialized local database');

    const restaurants = [];
    for (const rest of sampleRestaurants) {
      const hashedPassword = await bcrypt.hash(rest.password, 10);
      
      // Add _id to menu items
      const menuWithIds = rest.menu.map(item => ({
        _id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        ...item
      }));
      
      const restaurant = await restaurantDB.create({
        ...rest,
        menu: menuWithIds,
        password: hashedPassword
      });
      restaurants.push(restaurant);
      console.log(`✅ Created restaurant: ${restaurant.name}`);
    }

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📝 Sample Login Credentials:');
    console.log('Email: spice@example.com | Password: password123');
    console.log('Email: pizza@example.com | Password: password123');
    console.log('Email: burger@example.com | Password: password123');
    console.log('\n🚀 Start the server with: npm run dev');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
