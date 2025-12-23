import { query, initDatabase } from './database/connection.js';
import { restaurantDB } from './db.js';

async function checkDatabaseStatus() {
  try {
    console.log('🔄 Checking database connection...');
    
    // Test basic connection
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully!');
    console.log('📅 Current time:', result.rows[0].current_time);
    
    // Check if tables exist
    console.log('\n🔄 Checking database tables...');
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📊 Available tables:');
    tables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    // Check data counts
    console.log('\n📈 Data counts:');
    const restaurantCount = await query('SELECT COUNT(*) FROM restaurants');
    const menuItemCount = await query('SELECT COUNT(*) FROM menu_items');
    const orderCount = await query('SELECT COUNT(*) FROM orders');
    const orderItemCount = await query('SELECT COUNT(*) FROM order_items');
    
    console.log(`   Restaurants: ${restaurantCount.rows[0].count}`);
    console.log(`   Menu Items: ${menuItemCount.rows[0].count}`);
    console.log(`   Orders: ${orderCount.rows[0].count}`);
    console.log(`   Order Items: ${orderItemCount.rows[0].count}`);
    
    // Check specific restaurants
    console.log('\n👥 Restaurant details:');
    const restaurants = await restaurantDB.findAll();
    
    if (restaurants.length === 0) {
      console.log('⚠️  No restaurants found in database!');
      console.log('💡 You may need to run the migration or seed script.');
    } else {
      restaurants.forEach(restaurant => {
        console.log(`   📍 ${restaurant.name} (${restaurant.email})`);
      });
    }
    
    // Test specific login
    console.log('\n🔍 Testing specific email lookup...');
    const testRestaurant = await restaurantDB.findOne({ email: 'king@gmail.com' });
    if (testRestaurant) {
      console.log('✅ Found restaurant with king@gmail.com');
      console.log('   Name:', testRestaurant.name);
      console.log('   Has password:', !!testRestaurant.password);
    } else {
      console.log('❌ No restaurant found with king@gmail.com');
      console.log('💡 You may need to create this restaurant first.');
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
    console.error('\n🔧 Possible issues:');
    console.error('   1. Database connection string incorrect');
    console.error('   2. Neon database is paused or unavailable');
    console.error('   3. Tables not created yet');
    console.error('   4. Migration not run');
  }
  
  process.exit(0);
}

checkDatabaseStatus();