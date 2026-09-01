import { query } from './database/connection.js';

async function migrateDeliveryOrdersFeature() {
  try {
    console.log('🔄 Adding deliveryOrders feature to existing restaurants...');
    
    // Update all restaurants to include the new deliveryOrders feature
    await query(`
      UPDATE restaurants 
      SET features = features || '{"deliveryOrders": true}'::jsonb
      WHERE features IS NOT NULL
    `);
    
    console.log('✅ DeliveryOrders feature migration completed successfully!');
    
    // Verify the update
    const result = await query(`
      SELECT name, features->'deliveryOrders' as delivery_orders_enabled
      FROM restaurants 
      LIMIT 5
    `);
    
    console.log('📊 Verification - Restaurants with deliveryOrders feature:');
    result.rows.forEach(row => {
      console.log(`- ${row.name}: ${row.delivery_orders_enabled}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateDeliveryOrdersFeature()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateDeliveryOrdersFeature };