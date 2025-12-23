import { initDB, restaurantDB } from './db.js';
import bcrypt from 'bcryptjs';

async function testPasswordChange() {
  try {
    console.log('🔍 Testing password change functionality...');
    
    await initDB();
    
    // Get the test restaurant
    const restaurant = await restaurantDB.findOne({ email: 'king@gmail.com' });
    if (!restaurant) {
      console.log('❌ Test restaurant not found');
      return;
    }
    
    console.log('✅ Found restaurant:', restaurant.name);
    
    // Test current password verification
    const currentPassword = 'password123';
    const newPassword = 'newpassword456';
    
    console.log('\n🔍 Step 1: Verifying current password...');
    const isCurrentValid = await bcrypt.compare(currentPassword, restaurant.password);
    console.log('Current password valid:', isCurrentValid ? '✅ Yes' : '❌ No');
    
    if (!isCurrentValid) {
      console.log('❌ Current password verification failed - cannot proceed');
      return;
    }
    
    console.log('\n🔄 Step 2: Changing password...');
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    const updatedRestaurant = await restaurantDB.update(restaurant._id, { 
      password: hashedNewPassword 
    });
    
    if (updatedRestaurant) {
      console.log('✅ Password updated in database');
      
      // Verify new password works
      console.log('\n🔍 Step 3: Verifying new password...');
      const isNewPasswordValid = await bcrypt.compare(newPassword, updatedRestaurant.password);
      console.log('New password valid:', isNewPasswordValid ? '✅ Yes' : '❌ No');
      
      // Verify old password no longer works
      console.log('\n🔍 Step 4: Verifying old password is invalid...');
      const isOldPasswordStillValid = await bcrypt.compare(currentPassword, updatedRestaurant.password);
      console.log('Old password still valid:', isOldPasswordStillValid ? '❌ Yes (Problem!)' : '✅ No (Good)');
      
      if (isNewPasswordValid && !isOldPasswordStillValid) {
        console.log('\n🎉 Password change test SUCCESSFUL!');
        console.log('📝 New login credentials:');
        console.log('   Email: king@gmail.com');
        console.log('   Password: newpassword456');
        
        // Reset password back to original for consistency
        console.log('\n🔄 Resetting password back to original...');
        const originalHashedPassword = await bcrypt.hash(currentPassword, 10);
        await restaurantDB.update(restaurant._id, { password: originalHashedPassword });
        console.log('✅ Password reset to original: password123');
        
      } else {
        console.log('\n❌ Password change test FAILED!');
      }
    } else {
      console.log('❌ Failed to update password in database');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  process.exit(0);
}

testPasswordChange();