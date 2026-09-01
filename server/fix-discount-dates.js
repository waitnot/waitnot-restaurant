import { query } from './database/connection.js';

async function fixDiscountDates() {
  try {
    console.log('🕐 Fixing discount dates...');

    // Check current time
    const currentTime = await query('SELECT NOW() as current_time');
    console.log('Current database time:', currentTime.rows[0].current_time);

    // Get the discount with date issues
    const discounts = await query(`
      SELECT id, name, start_date, end_date, is_active
      FROM discounts 
      WHERE restaurant_id = '3a0d1b05-6ace-4a0c-8625-20e618740534'
    `);

    console.log('Current discounts:');
    discounts.rows.forEach(discount => {
      console.log(`   - ${discount.name}:`);
      console.log(`     Start: ${discount.start_date}`);
      console.log(`     End: ${discount.end_date}`);
      console.log(`     Active: ${discount.is_active}`);
    });

    // Update the discount to have valid dates (start now, end in 24 hours)
    const result = await query(`
      UPDATE discounts 
      SET 
        start_date = NOW(),
        end_date = NOW() + INTERVAL '24 hours'
      WHERE restaurant_id = '3a0d1b05-6ace-4a0c-8625-20e618740534'
      RETURNING id, name, start_date, end_date
    `);

    console.log('✅ Updated discount dates:');
    result.rows.forEach(discount => {
      console.log(`   - ${discount.name}:`);
      console.log(`     New Start: ${discount.start_date}`);
      console.log(`     New End: ${discount.end_date}`);
    });

    console.log('🎉 Discount dates fix completed!');

  } catch (error) {
    console.error('❌ Error fixing discount dates:', error);
    throw error;
  }
}

// Run the fix
fixDiscountDates()
  .then(() => {
    console.log('✅ Fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });