// Test script to verify restaurant profile update functionality

import { initDB, restaurantDB } from './db.js';

async function testProfileUpdate() {
  try {
    console.log('🔍 Testing restaurant profile update...');
    
    await initDB();
    
    // Get the test restaurant
    const restaurant = await restaurantDB.findOne({ email: 'king@gmail.com' });
    if (!restaurant) {
      console.log('❌ Test restaurant not found');
      return;
    }
    
    console.log('✅ Found restaurant:', restaurant.name);
    console.log('📝 Current details:');
    console.log('   Name:', restaurant.name);
    console.log('   Description:', restaurant.description);
    console.log('   Phone:', restaurant.phone);
    console.log('   Address:', restaurant.address);
    console.log('   Tables:', restaurant.tables);
    console.log('   Cuisine:', restaurant.cuisine);
    
    // Test update
    console.log('\n🔄 Testing profile update...');
    
    const updateData = {
      name: 'Hotel King Premium',
      description: 'Luxury dining experience with authentic flavors',
      phone: '+91-9876543210',
      address: '123 Royal Street, Premium District, City - 400001',
      deliveryTime: '25-35 min',
      tables: 20,
      cuisine: ['Indian', 'Continental', 'Chinese', 'Italian'],
      isDeliveryAvailable: true
    };
    
    const updatedRestaurant = await restaurantDB.update(restaurant._id, updateData);
    
    if (updatedRestaurant) {
      console.log('✅ Profile updated successfully!');
      console.log('📝 Updated details:');
      console.log('   Name:', updatedRestaurant.name);
      console.log('   Description:', updatedRestaurant.description);
      console.log('   Phone:', updatedRestaurant.phone);
      console.log('   Address:', updatedRestaurant.address);
      console.log('   Tables:', updatedRestaurant.tables);
      console.log('   Cuisine:', updatedRestaurant.cuisine);
      console.log('   Delivery Available:', updatedRestaurant.isDeliveryAvailable);
    } else {
      console.log('❌ Profile update failed');
    }
    
    // Test image update
    console.log('\n🔄 Testing image update...');
    const imageData = {
      image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
    };
    
    const imageUpdatedRestaurant = await restaurantDB.update(restaurant._id, imageData);
    
    if (imageUpdatedRestaurant && imageUpdatedRestaurant.image) {
      console.log('✅ Image updated successfully!');
      console.log('   Image size:', imageUpdatedRestaurant.image.length, 'characters');
    } else {
      console.log('❌ Image update failed');
    }
    
    console.log('\n🎉 Profile update test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  process.exit(0);
}

testProfileUpdate();