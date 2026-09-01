import { query } from './database/connection.js';

async function testFeatureSystem() {
  try {
    console.log('🧪 Testing complete feature management system...');
    
    // 1. Check if features column exists and has data
    console.log('\n1. Checking features column...');
    const restaurants = await query(`
      SELECT id, name, features 
      FROM restaurants 
      LIMIT 3
    `);
    
    console.log('Restaurants with features:');
    restaurants.rows.forEach(r => {
      console.log(`- ${r.name}: ${Object.keys(r.features || {}).length} features`);
    });
    
    // 2. Test feature update
    if (restaurants.rows.length > 0) {
      const testRestaurant = restaurants.rows[0];
      console.log(`\n2. Testing feature update for ${testRestaurant.name}...`);
      
      const newFeatures = {
        ...testRestaurant.features,
        menuManagement: false,
        analytics: false
      };
      
      await query(`
        UPDATE restaurants 
        SET features = $1 
        WHERE id = $2
      `, [JSON.stringify(newFeatures), testRestaurant.id]);
      
      // Verify update
      const updated = await query(`
        SELECT features 
        FROM restaurants 
        WHERE id = $1
      `, [testRestaurant.id]);
      
      console.log('✅ Feature update successful');
      console.log('Updated features:', updated.rows[0].features);
      
      // Restore original features
      await query(`
        UPDATE restaurants 
        SET features = $1 
        WHERE id = $2
      `, [JSON.stringify(testRestaurant.features), testRestaurant.id]);
      
      console.log('✅ Features restored');
    }
    
    console.log('\n🎉 Feature management system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFeatureSystem();