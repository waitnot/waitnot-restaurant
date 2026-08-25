/**
 * Migration: Add rooms support to the restaurant system
 * Run: node add-rooms-feature.js
 */
import { query, initDatabase } from './database/connection.js';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  await initDatabase();

  // Add rooms column to restaurants
  await query(`
    ALTER TABLE restaurants 
    ADD COLUMN IF NOT EXISTS rooms INTEGER DEFAULT 0;
  `);
  console.log('✅ Added rooms column to restaurants');

  // Add room_number column to orders
  await query(`
    ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS room_number INTEGER;
  `);
  console.log('✅ Added room_number column to orders');

  // Allow order_type to include 'room'
  // (order_type is VARCHAR, no enum constraint, so no change needed)
  console.log('✅ order_type already supports any string value (room, dine-in, delivery, etc.)');

  console.log('\n🎉 Rooms feature migration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
