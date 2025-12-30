import { query } from './database/connection.js';

async function addQROrderingControl() {
  try {
    console.log('🔄 Adding QR ordering control feature...');
    
    // First check current state
    const checkResult = await query(`
      SELECT id, name, features
      FROM restaurants 
      LIMIT 3
    `);
    
    console.log('📋 Current restaurant features:');
    checkResult.rows.forEach(row => {
      console.log(`  - ${row.name}: ${JSON.stringify(row.features)}`);
    });
    
    // Update all existing restaurants to include qrOrderingEnabled feature
    const result = await query(`
      UPDATE restaurants 
      SET features = features || '{"qrOrderingEnabled": true}'::jsonb
      WHERE NOT (features ? 'qrOrderingEnabled')
    `);
    
    console.log(`✅ Updated ${result.rowCount} restaurants with QR ordering control feature`);
    
    // Verify the update
    const verifyResult = await query(`
      SELECT id, name, features->'qrOrderingEnabled' as qr_ordering_enabled
      FROM restaurants 
      LIMIT 5
    `);
    
    console.log('📋 Sample restaurants with QR ordering status:');
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.name}: QR Ordering ${row.qr_ordering_enabled ? 'Enabled' : 'Disabled'}`);
    });
    
    console.log('✅ QR ordering control feature added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding QR ordering control:', error);
    throw error;
  }
}

// Run the migration
console.log('Script starting...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);

addQROrderingControl()
  .then(() => {
    console.log('🎉 QR ordering control migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });

export { addQROrderingControl };