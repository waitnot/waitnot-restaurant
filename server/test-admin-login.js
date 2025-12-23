import fetch from 'node-fetch';

async function testAdminLogin() {
  try {
    console.log('🧪 Testing admin login functionality...');
    
    const loginData = {
      username: 'admin',
      password: 'admin123'
    };
    
    console.log('📤 Sending login request...');
    const response = await fetch('http://localhost:5000/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Admin login successful!');
      console.log('   Token received:', !!result.token);
      console.log('   Admin data:', result.admin);
      
      // Test admin stats endpoint
      console.log('\n📊 Testing admin stats endpoint...');
      const statsResponse = await fetch('http://localhost:5000/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${result.token}`
        }
      });
      
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        console.log('✅ Admin stats retrieved:', stats);
      } else {
        console.log('❌ Admin stats failed:', await statsResponse.text());
      }
      
      // Test restaurants endpoint
      console.log('\n🏪 Testing admin restaurants endpoint...');
      const restaurantsResponse = await fetch('http://localhost:5000/api/admin/restaurants', {
        headers: {
          'Authorization': `Bearer ${result.token}`
        }
      });
      
      if (restaurantsResponse.ok) {
        const restaurants = await restaurantsResponse.json();
        console.log('✅ Admin restaurants retrieved:', restaurants.length, 'restaurants');
        restaurants.forEach(r => {
          console.log(`   📍 ${r.name} (${r.email})`);
        });
      } else {
        console.log('❌ Admin restaurants failed:', await restaurantsResponse.text());
      }
      
    } else {
      console.log('❌ Admin login failed:', result);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testAdminLogin();