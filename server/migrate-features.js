import { query } from './database/connection.js';

async function migrateFeatures() {
  try {
    console.log('🔄 Adding features column to restaurants table...');
    
    // Add features column if it doesn't exist
    await query(`
      ALTER TABLE restaurants 
      ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{
        "menuManagement": true,
        "orderManagement": true,
        "analytics": true,
        "profileEdit": true,
        "printerSettings": true,
        "qrCodeGeneration": true,
        "tableManagement": true,
        "deliveryToggle": true,
        "passwordChange": true,
        "imageUpload": true,
        "menuCategories": true,
        "orderHistory": true,
        "realTimeOrders": true,
        "customerInfo": true,
        "salesReports": true,
        "menuItemToggle": true,
        "bulkOperations": true,
        "exportData": true,
        "notifications": true,
        "multiLanguage": true
      }'::jsonb
    `);
    
    // Update existing restaurants that don't have features set
    await query(`
      UPDATE restaurants 
      SET features = '{
        "menuManagement": true,
        "orderManagement": true,
        "analytics": true,
        "profileEdit": true,
        "printerSettings": true,
        "qrCodeGeneration": true,
        "tableManagement": true,
        "deliveryToggle": true,
        "passwordChange": true,
        "imageUpload": true,
        "menuCategories": true,
        "orderHistory": true,
        "realTimeOrders": true,
        "customerInfo": true,
        "salesReports": true,
        "menuItemToggle": true,
        "bulkOperations": true,
        "exportData": true,
        "notifications": true,
        "multiLanguage": true
      }'::jsonb
      WHERE features IS NULL
    `);
    
    console.log('✅ Features column migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateFeatures()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateFeatures };