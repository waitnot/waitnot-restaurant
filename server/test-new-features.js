import { initDB, restaurantDB } from './db.js';

async function testNewFeatures() {
  try {
    console.log('🧪 Testing new feature system...');
    
    // Initialize database connection
    await initDB();
    
    // Get the first restaurant
    const restaurants = await restaurantDB.findAll();
    const restaurant = restaurants[0];
    
    if (!restaurant) {
      console.log('❌ No restaurants found');
      return;
    }
    
    console.log(`📊 Testing features for: ${restaurant.name}`);
    console.log('Current features:', restaurant.features);
    
    // Test feature checks
    const features = restaurant.features || {};
    
    console.log('\n🔍 Feature Status:');
    console.log(`   👥 Staff Orders: ${features.staffOrders ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   💬 Customer Feedback: ${features.customerFeedback ? '✅ Enabled' : '❌ Disabled'}`);
    
    // Test disabling a feature
    console.log('\n🔄 Testing feature toggle...');
    await restaurantDB.update(restaurant._id, {
      features: {
        ...features,
        staffOrders: false
      }
    });
    
    // Verify the change
    const updatedRestaurant = await restaurantDB.findById(restaurant._id);
    console.log(`👥 Staff Orders after toggle: ${updatedRestaurant.features.staffOrders ? '✅ Enabled' : '❌ Disabled'}`);
    
    // Re-enable it
    await restaurantDB.update(restaurant._id, {
      features: {
        ...updatedRestaurant.features,
        staffOrders: true
      }
    });
    
    console.log('✅ Feature toggle test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing features:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

testNewFeatures();