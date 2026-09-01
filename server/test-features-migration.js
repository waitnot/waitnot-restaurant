import { query } from './database/connection.js';

async function testFeaturesMigration() {
  try {
    console.log('🔍 Testing features column migration...');
    
    // Check if features column exists
    const result = await query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'restaurants' AND column_name = 'features'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Features column exists:', result.rows[0]);
      
      // Test querying restaurants with features
      const restaurants = await query(`
        SELECT id, name, features 
        FROM restaurants 
        LIMIT 3
      `);
      
      console.log('📊 Sample restaurants with features:');
      restaurants.rows.forEach(r => {
        console.log(`- ${r.name}: ${JSON.stringify(r.features)}`);
      });
      
    } else {
      console.log('❌ Features column not found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFeaturesMigration();