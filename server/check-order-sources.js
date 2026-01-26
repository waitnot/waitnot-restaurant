#!/usr/bin/env node

// Check order sources in database
import { query } from './database/connection.js';

async function checkOrderSources() {
  try {
    console.log('🔍 Checking order sources in database...\n');
    
    // Get all orders with their sources
    const result = await query(`
      SELECT id, customer_name, source, platform_order_id, total_amount, created_at
      FROM orders 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    
    console.log(`📊 Found ${result.rows.length} recent orders:`);
    
    result.rows.forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.customer_name}`);
      console.log(`      - Source: "${order.source}"`);
      console.log(`      - Platform Order ID: ${order.platform_order_id || 'null'}`);
      console.log(`      - Total: ₹${order.total_amount}`);
      console.log(`      - Created: ${order.created_at}`);
      console.log('');
    });
    
    // Count by source
    const sourceCount = await query(`
      SELECT source, COUNT(*) as count
      FROM orders 
      GROUP BY source
      ORDER BY count DESC
    `);
    
    console.log('📊 Orders by source:');
    sourceCount.rows.forEach(row => {
      console.log(`   - ${row.source || 'null'}: ${row.count} orders`);
    });
    
    // Check third-party orders specifically
    const thirdPartyCount = await query(`
      SELECT COUNT(*) as count
      FROM orders 
      WHERE source IN ('swiggy', 'zomato', 'uber-eats', 'foodpanda')
    `);
    
    console.log(`\n📱 Third-party orders: ${thirdPartyCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error checking order sources:', error);
    throw error;
  }
}

// Run the check
checkOrderSources()
  .then(() => {
    console.log('\n✅ Order source check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Check failed:', error);
    process.exit(1);
  });