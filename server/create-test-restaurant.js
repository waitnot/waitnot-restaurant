import { initDB, restaurantDB } from './db.js';
import bcrypt from 'bcryptjs';

async function createTestRestaurant() {
  try {
    console.log('🔄 Initializing database...');
    await initDB();
    
    console.log('🔄 Creating test restaurant...');
    
    // Check if restaurant already exists
    const existing = await restaurantDB.findOne({ email: 'king@gmail.com' });
    if (existing) {
      console.log('✅ Restaurant already exists with email: king@gmail.com');
      console.log('Restaurant details:', {
        id: existing._id,
        name: existing.name,
        email: existing.email,
        tables: existing.tables
      });
      return;
    }
    
    // Create test restaurant
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const restaurant = await restaurantDB.create({
      name: 'King Restaurant',
      description: 'Premium dining experience',
      email: 'king@gmail.com',
      password: hashedPassword,
      phone: '1234567890',
      address: '123 King Street, City',
      cuisine: ['Multi-cuisine', 'Fine Dining'],
      isDeliveryAvailable: true,
      tables: 15,
      rating: 4.5,
      deliveryTime: '30-45 min'
    });
    
    console.log('✅ Test restaurant created successfully!');
    console.log('📝 Login credentials:');
    console.log('   Email: king@gmail.com');
    console.log('   Password: password123');
    console.log('');
    console.log('Restaurant details:', {
      id: restaurant._id,
      name: restaurant.name,
      email: restaurant.email,
      tables: restaurant.tables
    });
    
    // Add some sample menu items
    console.log('🔄 Adding sample menu items...');
    
    const menuItems = [
      { name: 'Chicken Tikka', price: 299, category: 'Starters', isVeg: false, description: 'Grilled chicken with spices' },
      { name: 'Paneer Butter Masala', price: 249, category: 'Main Course', isVeg: true, description: 'Creamy paneer curry' },
      { name: 'Biryani', price: 349, category: 'Main Course', isVeg: false, description: 'Aromatic rice with meat' },
      { name: 'Gulab Jamun', price: 99, category: 'Desserts', isVeg: true, description: 'Sweet milk dumplings' }
    ];
    
    for (const item of menuItems) {
      await restaurantDB.addMenuItem(restaurant._id, item);
    }
    
    console.log('✅ Sample menu items added!');
    console.log('🚀 You can now login with: king@gmail.com / password123');
    
  } catch (error) {
    console.error('❌ Error creating test restaurant:', error);
    console.error('Error details:', error.message);
  }
  
  process.exit(0);
}

createTestRestaurant();