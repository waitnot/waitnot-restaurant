import { query } from './database/connection.js';

async function debugCounts() {
  try {
    console.log('🔍 Debugging Database Counts...\n');
    
    // Get restaurant data
    const restaurantQuery = `
      SELECT id, name, 
             (SELECT COUNT(*) FROM menu_items WHERE restaurant_id = restaurants.id) as menu_count,
             tables
      FROM restaurants 
      WHERE email = 'king@gmail.com'
    `;
    
    const restaurantResult = await query(restaurantQuery);
    const restaurant = restaurantResult.rows[0];
    
    if (!restaurant) {
      console.log('❌ Restaurant not found');
      return;
    }
    
    console.log('🏪 Restaurant Info:');
    console.log(`   Name: ${restaurant.name}`);
    console.log(`   ID: ${restaurant.id}`);
    console.log(`   Menu Items: ${restaurant.menu_count}`);
    console.log(`   Tables: ${restaurant.tables}\n`);
    
    // Get orders data
    const ordersQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN order_type = 'delivery' THEN 1 END) as delivery_orders,
        COUNT(CASE WHEN order_type = 'dine-in' THEN 1 END) as dine_in_orders,
        COUNT(CASE WHEN order_type = 'takeaway' THEN 1 END) as takeaway_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders
      FROM orders 
      WHERE restaurant_id = $1
    `;
    
    const ordersResult = await query(ordersQuery, [restaurant.id]);
    const orderStats = ordersResult.rows[0];
    
    console.log('📋 Order Statistics:');
    console.log(`   Total Orders: ${orderStats.total_orders}`);
    console.log(`   Delivery Orders: ${orderStats.delivery_orders}`);
    console.log(`   Dine-in Orders: ${orderStats.dine_in_orders}`);
    console.log(`   Takeaway Orders: ${orderStats.takeaway_orders}`);
    console.log(`   Completed Orders: ${orderStats.completed_orders}\n`);
    
    // Get recent orders sample
    const recentOrdersQuery = `
      SELECT id, order_type, status, customer_name, total_amount, created_at
      FROM orders 
      WHERE restaurant_id = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    
    const recentOrdersResult = await query(recentOrdersQuery, [restaurant.id]);
    
    console.log('📝 Recent Orders (Last 10):');
    recentOrdersResult.rows.forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.customer_name} - ${order.order_type} - ${order.status} - ₹${order.total_amount}`);
    });
    
    // Check for potential duplicates
    const duplicateQuery = `
      SELECT customer_name, customer_phone, total_amount, COUNT(*) as count
      FROM orders 
      WHERE restaurant_id = $1 
      GROUP BY customer_name, customer_phone, total_amount
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 5
    `;
    
    const duplicateResult = await query(duplicateQuery, [restaurant.id]);
    
    if (duplicateResult.rows.length > 0) {
      console.log('\n⚠️  Potential Duplicate Orders:');
      duplicateResult.rows.forEach(dup => {
        console.log(`   ${dup.customer_name} (${dup.customer_phone}) - ₹${dup.total_amount} - ${dup.count} times`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error debugging counts:', error);
  } finally {
    process.exit(0);
  }
}

debugCounts();