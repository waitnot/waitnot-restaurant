#!/usr/bin/env node

// Add columns for third-party order integration
import { query } from './database/connection.js';

async function addThirdPartyColumns() {
  try {
    console.log('🔄 Adding third-party order columns...');
    
    // Add columns to orders table
    const alterQueries = [
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'direct'`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_order_id VARCHAR(255)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission DECIMAL(10,2) DEFAULT 0`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 0`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10,2)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMP`,
      `CREATE INDEX IF NOT EXISTS idx_orders_platform_order_id ON orders(platform_order_id)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source)`
    ];
    
    for (const alterQuery of alterQueries) {
      console.log(`Executing: ${alterQuery}`);
      await query(alterQuery);
    }
    
    console.log('✅ Third-party order columns added successfully!');
    
    // Test the new columns
    console.log('\n🧪 Testing new columns...');
    const testResult = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name IN ('source', 'platform_order_id', 'platform_fee', 'commission', 'commission_rate', 'net_amount', 'estimated_delivery_time')
      ORDER BY column_name
    `);
    
    console.log('📊 New columns added:');
    testResult.rows.forEach(row => {
      console.log(`   ✅ ${row.column_name} (${row.data_type}) - Nullable: ${row.is_nullable}`);
    });
    
  } catch (error) {
    console.error('❌ Error adding third-party columns:', error);
    throw error;
  }
}

// Run the migration
addThirdPartyColumns()
  .then(() => {
    console.log('\n🎉 Third-party integration database setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });