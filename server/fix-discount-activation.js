import { query } from './database/connection.js';

async function fixDiscountActivation() {
  try {
    console.log('🔧 Fixing discount activation...');

    // Update all discounts with null is_active to true
    const result = await query(`
      UPDATE discounts 
      SET is_active = true 
      WHERE is_active IS NULL
      RETURNING id, name, is_active
    `);

    console.log('✅ Updated discounts:');
    result.rows.forEach(discount => {
      console.log(`   - ${discount.name}: is_active = ${discount.is_active}`);
    });

    // Also ensure the default value is set correctly for future inserts
    await query(`
      ALTER TABLE discounts 
      ALTER COLUMN is_active SET DEFAULT true
    `);

    console.log('✅ Set default value for is_active to true');

    console.log('🎉 Discount activation fix completed!');

  } catch (error) {
    console.error('❌ Error fixing discount activation:', error);
    throw error;
  }
}

// Run the fix
fixDiscountActivation()
  .then(() => {
    console.log('✅ Fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });