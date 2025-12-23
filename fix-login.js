import { initDB, restaurantDB } from './server/db.js';
import bcrypt from 'bcryptjs';

async function fixLogin() {
  try {
    console.log('🔧 Fixing login issue...');
    
    // Initialize database
    await initDB();
    console.log('✅ Database initialized');
    
    // Check current restaurants
    const existing = await restaurantDB.findAll();
    console.log(`📊 Current restaurants in database: ${existing.length}`);
    
    // Create the specific restaurant for king@gmail.com
    const email = 'king@gmail.com';
    const password = 'password123';
    
    // Check if it already exists
    const existingRestaurant = await restaurantDB.findOne({ email });
    
    if (existingRestaurant) {
      console.log('✅ Restaurant already exists with email:', email);
      console.log('   Name:', existingRestaurant.name);
      console.log('   ID:', existingRestaurant._id);
      
      // Test password
      const isValidPassword = await bcrypt.compare(password, existingRestaurant.password);
      console.log('   Password test:', isValidPassword ? '✅ Valid' : '❌ Invalid');
      
      if (!isValidPassword) {
        console.log('🔄 Updating password...');
        const hashedPassword = await bcrypt.hash(password, 10);
        await restaurantDB.update(existingRestaurant._id, { password: hashedPassword });
        console.log('✅ Password updated successfully');
      }
    } else {
      console.log('🔄 Creating new restaurant...');
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const restaurant = await restaurantDB.create({
        name: 'King Restaurant',
        description: 'Premium dining experience',
        email: email,
        password: hashedPassword,
        phone: '1234567890',
        address: '123 King Street, City',
        cuisine: ['Multi-cuisine', 'Fine Dining'],
        isDeliveryAvailable: true,
        tables: 15,
        rating: 4.5,
        deliveryTime: '30-45 min'
      });
      
      console.log('✅ Restaurant created successfully!');
      console.log('   Name:', restaurant.name);
      console.log('   Email:', restaurant.email);
      console.log('   ID:', restaurant._id);
      
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
      
      console.log('✅ Sample menu items added');
    }
    
    console.log('\n🎉 Login fix completed!');
    console.log('📝 You can now login with:');
    console.log('   Email: king@gmail.com');
    console.log('   Password: password123');
    
    // Final verification
    console.log('\n🔍 Final verification...');
    const testRestaurant = await restaurantDB.findOne({ email });
    if (testRestaurant) {
      const passwordTest = await bcrypt.compare(password, testRestaurant.password);
      console.log('✅ Restaurant exists and password is valid:', passwordTest);
    } else {
      console.log('❌ Something went wrong - restaurant not found');
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    console.error('Error details:', error.message);
  }
  
  process.exit(0);
}

fixLogin();