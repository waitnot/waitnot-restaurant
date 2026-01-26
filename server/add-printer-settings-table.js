import { query } from './database/connection.js';

async function addPrinterSettingsTable() {
  try {
    console.log('🔧 Creating printer_settings table...');
    
    // Create printer_settings table
    await query(`
      CREATE TABLE IF NOT EXISTS printer_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        settings JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(restaurant_id)
      )
    `);
    
    console.log('✅ printer_settings table created successfully');
    
    // Create index for faster lookups
    await query(`
      CREATE INDEX IF NOT EXISTS idx_printer_settings_restaurant_id 
      ON printer_settings(restaurant_id)
    `);
    
    console.log('✅ Index created on restaurant_id');
    
    // Add trigger to update updated_at timestamp
    await query(`
      CREATE OR REPLACE FUNCTION update_printer_settings_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    
    await query(`
      DROP TRIGGER IF EXISTS update_printer_settings_updated_at ON printer_settings
    `);
    
    await query(`
      CREATE TRIGGER update_printer_settings_updated_at
        BEFORE UPDATE ON printer_settings
        FOR EACH ROW
        EXECUTE FUNCTION update_printer_settings_updated_at()
    `);
    
    console.log('✅ Updated timestamp trigger created');
    
    // Insert default settings for existing restaurants
    console.log('🔄 Adding default printer settings for existing restaurants...');
    
    const defaultSettings = {
      enableKitchenPrinting: true,
      enableFinalBillPrinting: true,
      kitchenReceiptSize: '80mm',
      cashCounterReceiptSize: '80mm',
      autoPrintKitchenBill: false,
      autoPrintFinalBill: false,
      kitchenPrinterName: 'Kitchen Printer',
      cashCounterPrinterName: 'Cash Counter Printer',
      enableUpiPayments: true,
      upiBaseUrl: 'upi://pay?pa=Q582735754@ybl&pn=PhonePeMerchant&mc=0000&mode=02&purpose=00',
      merchantName: 'PhonePeMerchant',
      defaultUpiApp: 'phonepe',
      billCustomization: {
        enableCustomBill: false,
        logoFile: null,
        logoDataUrl: '',
        logoSize: 'medium',
        headerText: '',
        footerText: 'Thank you for dining with us!',
        showQRCode: true,
        enableUpiPayment: true,
        qrCodeFile: null,
        qrCodeDataUrl: '',
        showAddress: true,
        address: '',
        showPhone: true,
        phone: '',
        showEmail: false,
        email: '',
        showGST: false,
        gstNumber: '',
        billTemplate: 'modern'
      }
    };
    
    // Get all restaurants
    const restaurants = await query('SELECT id FROM restaurants');
    
    for (const restaurant of restaurants.rows) {
      // Check if settings already exist
      const existing = await query(
        'SELECT id FROM printer_settings WHERE restaurant_id = $1',
        [restaurant.id]
      );
      
      if (existing.rows.length === 0) {
        await query(`
          INSERT INTO printer_settings (restaurant_id, settings)
          VALUES ($1, $2)
        `, [restaurant.id, JSON.stringify(defaultSettings)]);
        
        console.log(`✅ Default settings added for restaurant: ${restaurant.id}`);
      } else {
        console.log(`⏭️  Settings already exist for restaurant: ${restaurant.id}`);
      }
    }
    
    console.log('🎉 Printer settings table setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error creating printer_settings table:', error);
    throw error;
  }
}

// Run the migration
addPrinterSettingsTable()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });