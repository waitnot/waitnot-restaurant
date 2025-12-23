import { initDB, restaurantDB } from './db.js';
import bcrypt from 'bcryptjs';

async function testLogin() {
  try {
    console.log('🔍 Testing login functionality...');
    
    await initDB();
    
    const email = 'king@gmail.com';
    const password = 'password123';
    
    console.log(`\n🔄 Attempting login with: ${email}`);
    
    // Simulate the login process
    const restaurant = await restaurantDB.findOne({ email });
    
    if (!restaurant) {
      console.log('❌ Restaurant not found');
      return;
    }
    
    console.log('✅ Restaurant found:', restaurant.name);
    
    const isValid = await bcrypt.compare(password, restaurant.password);
    console.log('🔐 Password validation:', isValid ? '✅ Valid' : '❌ Invalid');
    
    if (isValid) {
      console.log('\n🎉 LOGIN SUCCESSFUL!');
      console.log('📝 Restaurant details:');
      console.log('   ID:', restaurant._id);
      console.log('   Name:', restaurant.name);
      console.log('   Email:', restaurant.email);
      console.log('   Tables:', restaurant.tables);
      console.log('   Menu items:', restaurant.menu?.length || 0);
      
      console.log('\n✅ You can now login to your application with:');
      console.log('   Email: king@gmail.com');
      console.log('   Password: password123');
    } else {
      console.log('\n❌ LOGIN FAILED');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  process.exit(0);
}

testLogin();