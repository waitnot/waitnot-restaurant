import { query } from './database/connection.js';

async function addDiscountBannerSystem() {
  try {
    console.log('🎨 Adding discount banner system to database...');

    // Add banner image fields to discounts table
    await query(`
      ALTER TABLE discounts 
      ADD COLUMN IF NOT EXISTS banner_image TEXT,
      ADD COLUMN IF NOT EXISTS banner_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS banner_subtitle VARCHAR(255),
      ADD COLUMN IF NOT EXISTS show_banner BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS banner_link_text VARCHAR(100) DEFAULT 'Shop Now'
    `);

    console.log('✅ Discount banner system added successfully!');
    console.log('📊 New columns added to discounts table:');
    console.log('   - banner_image (TEXT) - URL or base64 image data');
    console.log('   - banner_title (VARCHAR) - Main banner headline');
    console.log('   - banner_subtitle (VARCHAR) - Banner description');
    console.log('   - show_banner (BOOLEAN) - Whether to display banner');
    console.log('   - banner_link_text (VARCHAR) - Call-to-action text');

  } catch (error) {
    console.error('❌ Error adding discount banner system:', error);
    throw error;
  }
}

// Run the migration
addDiscountBannerSystem()
  .then(() => {
    console.log('🎉 Discount banner system migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });