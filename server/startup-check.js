import { initDB, restaurantDB } from './db.js';
import bcrypt from 'bcryptjs';

async function ensureStartupData() {
  try {
    console.log('🚀 Running startup checks...');
    
    // Initialize database
    await initDB();
    console.log('✅ Database initialized');
    
    // Check if any restaurants exist
    const restaurants = await restaurantDB.findAll();
    console.log(`📊 Found ${restaurants.length} restaurants in database`);
    
    // If no restaurants, create default ones
    if (restaurants.length === 0) {
      console.log('🔄 No restaurants found, creating default restaurants...');
      
      const defaultRestaurants = [
        {
          name: 'King Restaurant',
          description: 'Premium dining experience',
          email: 'king@gmail.com',
          password: 'password123',
          phone: '1234567890',
          address: '123 King Street, City',
          cuisine: ['Multi-cuisine', 'Fine Dining'],
          isDeliveryAvailable: true,
          tables: 15,
          rating: 4.5,
          deliveryTime: '30-45 min'
        },
        {
          name: 'Spice Garden',
          description: 'Authentic Indian cuisine with a modern twist',
          email: 'spice@example.com',
          password: 'password123',
          phone: '1234567890',
          address: '123 Main Street, City',
          cuisine: ['Indian', 'North Indian', 'Tandoor'],
          isDeliveryAvailable: true,
          tables: 10,
          rating: 4.5,
          deliveryTime: '30-40 min'
        }
      ];
      
      for (const restData of defaultRestaurants) {
        try {
          const hashedPassword = await bcrypt.hash(restData.password, 10);
          const restaurant = await restaurantDB.create({
            ...restData,
            password: hashedPassword
          });
          
          console.log(`✅ Created restaurant: ${restaurant.name} (${restaurant.email})`);
          
          // Add sample menu items
          const menuItems = [
            { name: 'Chicken Tikka', price: 299, category: 'Starters', isVeg: false, description: 'Grilled chicken with spices' },
            { name: 'Paneer Butter Masala', price: 249, category: 'Main Course', isVeg: true, description: 'Creamy paneer curry' },
            { name: 'Biryani', price: 349, category: 'Main Course', isVeg: false, description: 'Aromatic rice with meat' },
            { name: 'Gulab Jamun', price: 99, category: 'Desserts', isVeg: true, description: 'Sweet milk dumplings' }
          ];
          
          for (const item of menuItems) {
            await restaurantDB.addMenuItem(restaurant._id, item);
          }
          
        } catch (error) {
          console.error(`❌ Error creating restaurant ${restData.name}:`, error.message);
        }
      }
      
      console.log('✅ Default restaurants created successfully!');
    } else {
      console.log('✅ Restaurants already exist in database');
      restaurants.forEach(r => {
        console.log(`   📍 ${r.name} (${r.email})`);
      });
    }
    
    console.log('\n📝 Available login credentials:');
    console.log('   Email: king@gmail.com | Password: password123');
    console.log('   Email: spice@example.com | Password: password123');
    console.log('\n🚀 Startup checks completed successfully!');
    
  } catch (error) {
    console.error('❌ Startup check failed:', error);
    throw error;
  }
}

export { ensureStartupData };