import { initDatabase, query } from './server/database/connection.js';

async function testConnection() {
  try {
    console.log('🔄 Testing PostgreSQL connection...');
    
    // Test basic connection
    const result = await query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('✅ Database connected successfully!');
    console.log('📅 Current time:', result.rows[0].current_time);
    console.log('🐘 PostgreSQL version:', result.rows[0].postgres_version.split(' ')[0]);
    
    // Initialize database (create tables)
    console.log('\n🔄 Initializing database tables...');
    await initDatabase();
    
    // Test table creation
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📊 Database tables created:');
    tables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    // Test data counts
    console.log('\n📈 Current data counts:');
    const restaurantCount = await query('SELECT COUNT(*) FROM restaurants');
    const menuItemCount = await query('SELECT COUNT(*) FROM menu_items');
    const orderCount = await query('SELECT COUNT(*) FROM orders');
    const orderItemCount = await query('SELECT COUNT(*) FROM order_items');
    
    console.log(`   Restaurants: ${restaurantCount.rows[0].count}`);
    console.log(`   Menu Items: ${menuItemCount.rows[0].count}`);
    console.log(`   Orders: ${orderCount.rows[0].count}`);
    console.log(`   Order Items: ${orderItemCount.rows[0].count}`);
    
    console.log('\n🎉 Database is ready for use!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.error('\n🔧 Troubleshooting tips:');
    console.error('   1. Check DATABASE_URL environment variable');
    console.error('   2. Verify Neon database is running');
    console.error('   3. Check network connectivity');
    console.error('   4. Verify SSL settings');
    process.exit(1);
  }
  
  process.exit(0);
}

testConnection();