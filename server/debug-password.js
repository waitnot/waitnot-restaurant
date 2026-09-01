import { initDB, restaurantDB } from './db.js';
import bcrypt from 'bcryptjs';

async function debugPassword() {
  try {
    console.log('🔍 Debugging password issue...');
    
    await initDB();
    
    const email = 'king@gmail.com';
    const plainPassword = 'password123';
    
    // Get the restaurant
    const restaurant = await restaurantDB.findOne({ email });
    if (!restaurant) {
      console.log('❌ Restaurant not found');
      return;
    }
    
    console.log('✅ Restaurant found:', restaurant.name);
    console.log('📝 Current password hash:', restaurant.password);
    console.log('📝 Password hash length:', restaurant.password?.length);
    console.log('📝 Password starts with $2a$:', restaurant.password?.startsWith('$2a$'));
    
    // Test current password
    console.log('\n🔍 Testing current password...');
    const isCurrentValid = await bcrypt.compare(plainPassword, restaurant.password);
    console.log('Current password valid:', isCurrentValid);
    
    // Create a fresh hash
    console.log('\n🔄 Creating fresh password hash...');
    const freshHash = await bcrypt.hash(plainPassword, 10);
    console.log('Fresh hash:', freshHash);
    console.log('Fresh hash length:', freshHash.length);
    
    // Test fresh hash
    const isFreshValid = await bcrypt.compare(plainPassword, freshHash);
    console.log('Fresh hash valid:', isFreshValid);
    
    // Update with fresh hash
    console.log('\n🔄 Updating with fresh hash...');
    await restaurantDB.update(restaurant._id, { password: freshHash });
    
    // Verify update
    const updatedRestaurant = await restaurantDB.findOne({ email });
    console.log('Updated password hash:', updatedRestaurant.password);
    
    const isFinalValid = await bcrypt.compare(plainPassword, updatedRestaurant.password);
    console.log('✅ Final password test:', isFinalValid);
    
    if (isFinalValid) {
      console.log('\n🎉 Password fix successful!');
      console.log('📝 Login credentials:');
      console.log('   Email: king@gmail.com');
      console.log('   Password: password123');
    } else {
      console.log('\n❌ Password fix failed');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
  
  process.exit(0);
}

debugPassword();