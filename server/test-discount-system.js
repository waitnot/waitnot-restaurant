import { query } from './database/connection.js';

async function testDiscountSystem() {
  try {
    console.log('🧪 Testing Discount System...');

    // Test 1: Check if discount tables exist
    console.log('\n1. Checking database tables...');
    
    const discountsTable = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'discounts'
    `);
    
    const discountUsageTable = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'discount_usage'
    `);
    
    console.log('✅ Discounts table exists:', discountsTable.rows.length > 0);
    console.log('✅ Discount usage table exists:', discountUsageTable.rows.length > 0);

    // Test 2: Get a test restaurant ID
    console.log('\n2. Getting test restaurant...');
    const restaurants = await query('SELECT id, name FROM restaurants LIMIT 1');
    
    if (restaurants.rows.length === 0) {
      console.log('❌ No restaurants found. Please create a restaurant first.');
      return;
    }
    
    const testRestaurant = restaurants.rows[0];
    console.log('✅ Test restaurant:', testRestaurant.name, testRestaurant.id);

    // Test 3: Check discount table structure
    console.log('\n3. Checking discount table structure...');
    const tableStructure = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'discounts' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Discount table columns:');
    tableStructure.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Test 4: Check if orders table has discount columns
    console.log('\n4. Checking orders table discount columns...');
    const orderColumns = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name IN ('discount_id', 'discount_amount', 'original_amount', 'is_qr_order')
    `);
    
    console.log('✅ Orders table discount columns:');
    orderColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });

    // Test 5: Try to create a test discount directly in database
    console.log('\n5. Testing discount creation in database...');
    try {
      const testDiscount = await query(`
        INSERT INTO discounts (
          restaurant_id, name, description, discount_type, discount_value, 
          min_order_amount, is_qr_exclusive, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        testRestaurant.id, 
        'Test Discount', 
        'Test discount for QR users', 
        'percentage', 
        10, 
        0, 
        true, 
        true
      ]);
      
      console.log('✅ Test discount created:', testDiscount.rows[0].name);
      
      // Clean up - delete the test discount
      await query('DELETE FROM discounts WHERE id = $1', [testDiscount.rows[0].id]);
      console.log('✅ Test discount cleaned up');
      
    } catch (error) {
      console.log('❌ Failed to create test discount:', error.message);
    }

    console.log('\n🎉 Discount system database test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDiscountSystem()
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });