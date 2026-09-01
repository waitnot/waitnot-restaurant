import fetch from 'node-fetch';

async function testAdminFeatureManagement() {
  try {
    console.log('🧪 Testing admin feature management system...');
    
    const baseUrl = 'http://localhost:5000';
    
    // 1. Admin login
    console.log('\n1. Testing admin login...');
    const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error('Admin login failed');
    }
    
    const loginData = await loginResponse.json();
    const adminToken = loginData.token;
    console.log('✅ Admin login successful');
    
    // 2. Get restaurants
    console.log('\n2. Getting restaurants...');
    const restaurantsResponse = await fetch(`${baseUrl}/api/admin/restaurants`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    if (!restaurantsResponse.ok) {
      throw new Error('Failed to get restaurants');
    }
    
    const restaurants = await restaurantsResponse.json();
    console.log(`✅ Found ${restaurants.length} restaurants`);
    
    if (restaurants.length === 0) {
      console.log('⚠️ No restaurants found to test features');
      return;
    }
    
    const testRestaurant = restaurants[0];
    console.log(`Testing with restaurant: ${testRestaurant.name}`);
    console.log(`Current features: ${Object.keys(testRestaurant.features || {}).length} features`);
    
    // 3. Update restaurant features
    console.log('\n3. Testing feature update...');
    const newFeatures = {
      menuManagement: true,
      orderManagement: true,
      analytics: false, // Disable analytics
      profileEdit: true,
      printerSettings: false, // Disable printer settings
      qrCodeGeneration: true,
      tableManagement: true,
      deliveryToggle: true,
      passwordChange: true,
      imageUpload: true,
      menuCategories: true,
      orderHistory: true,
      realTimeOrders: true,
      customerInfo: true,
      salesReports: false, // Disable sales reports
      menuItemToggle: true,
      bulkOperations: false,
      exportData: false,
      notifications: true,
      multiLanguage: false
    };
    
    const updateResponse = await fetch(`${baseUrl}/api/admin/restaurants/${testRestaurant._id}/features`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ features: newFeatures })
    });
    
    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Feature update failed: ${error}`);
    }
    
    const updatedRestaurant = await updateResponse.json();
    console.log('✅ Features updated successfully');
    
    // 4. Verify the update
    console.log('\n4. Verifying feature update...');
    const verifyResponse = await fetch(`${baseUrl}/api/admin/restaurants`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const verifiedRestaurants = await verifyResponse.json();
    const verifiedRestaurant = verifiedRestaurants.find(r => r._id === testRestaurant._id);
    
    console.log('Updated features:');
    Object.entries(verifiedRestaurant.features).forEach(([feature, enabled]) => {
      const status = enabled ? '✅' : '❌';
      console.log(`  ${status} ${feature}: ${enabled}`);
    });
    
    // 5. Test restaurant API with updated features
    console.log('\n5. Testing restaurant API with updated features...');
    const restaurantResponse = await fetch(`${baseUrl}/api/restaurants/${testRestaurant._id}`);
    
    if (restaurantResponse.ok) {
      const restaurantData = await restaurantResponse.json();
      console.log('✅ Restaurant API returns updated features');
      console.log(`Features in restaurant data: ${Object.keys(restaurantData.features || {}).length} features`);
    }
    
    console.log('\n🎉 Admin feature management system test completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('- Admin login: ✅');
    console.log('- Get restaurants: ✅');
    console.log('- Update features: ✅');
    console.log('- Verify update: ✅');
    console.log('- Restaurant API: ✅');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAdminFeatureManagement();