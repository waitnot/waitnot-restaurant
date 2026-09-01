import { query } from './database/connection.js';

async function addDiscountSystem() {
  try {
    console.log('🎉 Adding discount system to database...');

    // Create discounts table
    await query(`
      CREATE TABLE IF NOT EXISTS discounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        discount_type VARCHAR(20) DEFAULT 'percentage', -- 'percentage' or 'fixed'
        discount_value DECIMAL(10,2) NOT NULL,
        min_order_amount DECIMAL(10,2) DEFAULT 0,
        max_discount_amount DECIMAL(10,2),
        is_active BOOLEAN DEFAULT true,
        is_qr_exclusive BOOLEAN DEFAULT false, -- Special discount for QR users
        start_date TIMESTAMP WITH TIME ZONE,
        end_date TIMESTAMP WITH TIME ZONE,
        usage_limit INTEGER, -- Max number of uses (null = unlimited)
        usage_count INTEGER DEFAULT 0,
        applicable_categories TEXT[], -- Array of categories this discount applies to
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create discount_usage table to track individual uses
    await query(`
      CREATE TABLE IF NOT EXISTS discount_usage (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        discount_id UUID REFERENCES discounts(id) ON DELETE CASCADE,
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        customer_phone VARCHAR(20),
        discount_amount DECIMAL(10,2) NOT NULL,
        original_amount DECIMAL(10,2) NOT NULL,
        final_amount DECIMAL(10,2) NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add discount columns to orders table
    await query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS discount_id UUID REFERENCES discounts(id),
      ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS is_qr_order BOOLEAN DEFAULT false
    `);

    // Create indexes for better performance
    await query('CREATE INDEX IF NOT EXISTS idx_discounts_restaurant_id ON discounts(restaurant_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_discounts_active ON discounts(is_active)');
    await query('CREATE INDEX IF NOT EXISTS idx_discounts_dates ON discounts(start_date, end_date)');
    await query('CREATE INDEX IF NOT EXISTS idx_discount_usage_discount_id ON discount_usage(discount_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_orders_discount_id ON orders(discount_id)');

    console.log('✅ Discount system added successfully!');
    console.log('📊 Tables created:');
    console.log('   - discounts (main discount configuration)');
    console.log('   - discount_usage (usage tracking)');
    console.log('   - orders table updated with discount columns');

  } catch (error) {
    console.error('❌ Error adding discount system:', error);
    throw error;
  }
}

// Run the migration
addDiscountSystem()
  .then(() => {
    console.log('🎉 Discount system migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });