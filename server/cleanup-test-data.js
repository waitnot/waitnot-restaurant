import { query } from './database/connection.js';

async function cleanupTestData() {
  try {
    console.log('🧹 Cleaning up test data...\n');
    
    // Get restaurant ID
    const restaurantResult = await query(`
      SELECT id, name FROM restaurants WHERE email = 'king@gmail.com'
    `);
    
    if (restaurantResult.rows.length === 0) {
      console.log('❌ Restaurant not found');
      return;
    }
    
    const restaurant = restaurantResult.rows[0];
    console.log(`🏪 Cleaning data for: ${restaurant.name}\n`);
    
    // 1. Clean up duplicate menu items (keep only unique items)
    console.log('1️⃣ Cleaning duplicate menu items...');
    
    // First, let's see how many menu items we have
    const menuCountResult = await query(`
      SELECT COUNT(*) as count FROM menu_items WHERE restaurant_id = $1
    `, [restaurant.id]);
    
    console.log(`   Current menu items: ${menuCountResult.rows[0].count}`);
    
    // Delete duplicate menu items by keeping only the first occurrence of each name
    const duplicateMenuQuery = `
      DELETE FROM menu_items 
      WHERE restaurant_id = $1 
      AND ctid NOT IN (
        SELECT MIN(ctid) 
        FROM menu_items 
        WHERE restaurant_id = $1 
        GROUP BY name, price, category
      )
    `;
    
    const deletedMenuResult = await query(duplicateMenuQuery, [restaurant.id]);
    console.log(`   ✅ Removed ${deletedMenuResult.rowCount} duplicate menu items`);
    
    // 2. Clean up test orders (keep only recent real orders)
    console.log('\n2️⃣ Cleaning test orders...');
    
    // Remove obvious test orders (with test names or duplicate data)
    const testOrdersQuery = `
      DELETE FROM orders 
      WHERE restaurant_id = $1 
      AND (
        customer_name IN ('test', 'Test', 'TEST', 'sdff', 'sfd', 'asas', 'njs', 'jn', 'bnmb', 'aa') 
        OR customer_phone IN ('123456', 'q12345', '96666666')
        OR customer_name ~ '^[a-z]{1,4}$'
        OR customer_name LIKE 'sdm%'
      )
    `;
    
    const deletedOrdersResult = await query(testOrdersQuery, [restaurant.id]);
    console.log(`   ✅ Removed ${deletedOrdersResult.rowCount} test orders`);
    
    // 3. Remove duplicate orders (same customer, phone, amount)
    console.log('\n3️⃣ Removing duplicate orders...');
    
    const duplicateOrdersQuery = `
      DELETE FROM orders 
      WHERE restaurant_id = $1 
      AND ctid NOT IN (
        SELECT MIN(ctid) 
        FROM orders 
        WHERE restaurant_id = $1 
        GROUP BY customer_name, customer_phone, total_amount, order_type
      )
    `;
    
    const deletedDuplicatesResult = await query(duplicateOrdersQuery, [restaurant.id]);
    console.log(`   ✅ Removed ${deletedDuplicatesResult.rowCount} duplicate orders`);
    
    // 4. Reset table count to reasonable number
    console.log('\n4️⃣ Resetting table count...');
    
    const updateTablesQuery = `
      UPDATE restaurants 
      SET tables = 5 
      WHERE id = $1
    `;
    
    await query(updateTablesQuery, [restaurant.id]);
    console.log(`   ✅ Set table count to 5`);
    
    // 5. Show final counts
    console.log('\n📊 Final Counts:');
    
    const finalCountsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM menu_items WHERE restaurant_id = $1) as menu_items,
        (SELECT COUNT(*) FROM orders WHERE restaurant_id = $1) as total_orders,
        (SELECT COUNT(*) FROM orders WHERE restaurant_id = $1 AND order_type = 'dine-in') as dine_in_orders,
        (SELECT COUNT(*) FROM orders WHERE restaurant_id = $1 AND order_type = 'delivery') as delivery_orders,
        (SELECT tables FROM restaurants WHERE id = $1) as tables
    `;
    
    const finalResult = await query(finalCountsQuery, [restaurant.id]);
    const final = finalResult.rows[0];
    
    console.log(`   Menu Items: ${final.menu_items}`);
    console.log(`   Total Orders: ${final.total_orders}`);
    console.log(`   Dine-in Orders: ${final.dine_in_orders}`);
    console.log(`   Delivery Orders: ${final.delivery_orders}`);
    console.log(`   Tables: ${final.tables}`);
    
    console.log('\n✅ Cleanup completed! The order counts should now be accurate.');
    console.log('🔄 Refresh your restaurant dashboard to see the updated counts.');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    process.exit(0);
  }
}

cleanupTestData();