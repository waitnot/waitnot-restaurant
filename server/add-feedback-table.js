#!/usr/bin/env node

// Migration script to add feedback table to existing database
import { query } from './database/connection.js';

async function addFeedbackTable() {
  try {
    console.log('🔄 Adding feedback table to database...\n');

    // Create feedback table
    console.log('1️⃣ Creating feedback table...');
    await query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20),
        customer_email VARCHAR(255),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        feedback_text TEXT NOT NULL,
        feedback_type VARCHAR(20) DEFAULT 'general',
        is_anonymous BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'active',
        restaurant_response TEXT,
        responded_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Feedback table created');

    // Add indexes
    console.log('\n2️⃣ Adding indexes...');
    await query(`CREATE INDEX IF NOT EXISTS idx_feedback_restaurant_id ON feedback(restaurant_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at)`);
    console.log('   ✅ Indexes added');

    // Add trigger for updated_at
    console.log('\n3️⃣ Adding trigger for updated_at...');
    await query(`
      CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON feedback
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);
    console.log('   ✅ Trigger added');

    // Add feedback feature to restaurants
    console.log('\n4️⃣ Adding feedback feature to restaurant features...');
    await query(`
      UPDATE restaurants 
      SET features = features || '{"customerFeedback": true}'::jsonb
      WHERE features IS NOT NULL
    `);
    console.log('   ✅ Feedback feature added to all restaurants');

    console.log('\n🎉 Feedback table migration completed successfully!');
    console.log('✅ Restaurants can now receive and manage customer feedback.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run the migration
addFeedbackTable();