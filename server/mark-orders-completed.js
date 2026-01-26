import { query } from './database/connection.js';

async function markOrdersCompleted() {
  try {
    console.log('✅ Marking all existing orders as completed...\n');
    
    // Get restaurant ID
    const restaurantResult = await query(`
      SELECT id, name FROM restaurants WHERE email = 'king@gmail.com'
    `);
    
    if (restaurantResult.rows.length === 0) {
      console.log('❌ Restaurant not found');
      return;
    }
    
    const restaurant = restaurantResult.rows[0];
    console.log(`🏪 Processing orders for: ${restaurant.name}\n`);
    
    // Mark all pending/preparing orders as completed
    const updateResult = await query(`
      UPDATE orders 
      SET status = 'completed' 
      WHERE restaurant_id = $1 
      AND status IN ('pending', 'preparing')
    `, [restaurant.id]);
    
    console.log(`✅ Marked ${updateResult.rowCount} orders as completed`);
    
    // Show current order status
    const statusQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM orders 
      WHERE restaurant_id = $1 
      GROUP BY status
      ORDER BY status
    `;
    
    const statusResult = await query(statusQuery, [restaurant.id]);
    
    console.log('\n📊 Current Order Status:');
    statusResult.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count} orders`);
    });
    
    console.log('\n✅ All orders marked as completed!');
    console.log('🔄 Refresh your restaurant dashboard - the badges should now show 0 for active orders.');
    console.log('💡 New orders will appear in the badges and display properly.');
    
  } catch (error) {
    console.error('❌ Error marking orders as completed:', error);
  } finally {
    process.exit(0);
  }
}

markOrdersCompleted();