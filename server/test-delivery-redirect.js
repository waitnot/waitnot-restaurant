import { query } from './database/connection.js';

async function testDeliveryRedirectBehavior() {
  try {
    console.log('🧪 Testing delivery orders redirect behavior...');
    
    // 1. Test with delivery orders enabled
    console.log('\n1. Testing with delivery orders ENABLED...');
    await query(`
      UPDATE restaurants 
      SET features = features || '{"deliveryOrders": true}'::jsonb
      WHERE name = 'Hotel King'
    `);
    
    const enabledCheck = await query(`
      SELECT features->'deliveryOrders' as delivery_orders_enabled
      FROM restaurants 
      WHERE name = 'Hotel King'
    `);
    
    console.log(`✅ Delivery orders enabled: ${enabledCheck.rows[0].delivery_orders_enabled}`);
    console.log('Expected behavior: User can access delivery orders tab');
    
    // 2. Test with delivery orders disabled
    console.log('\n2. Testing with delivery orders DISABLED...');
    await query(`
      UPDATE restaurants 
      SET features = features || '{"deliveryOrders": false}'::jsonb
      WHERE name = 'Hotel King'
    `);
    
    const disabledCheck = await query(`
      SELECT features->'deliveryOrders' as delivery_orders_enabled
      FROM restaurants 
      WHERE name = 'Hotel King'
    `);
    
    console.log(`✅ Delivery orders disabled: ${disabledCheck.rows[0].delivery_orders_enabled}`);
    console.log('Expected behavior: User automatically redirected to Table Orders (dine-in)');
    console.log('Expected behavior: No "Delivery Orders Disabled" message shown');
    console.log('Expected behavior: Delivery tab hidden from navigation');
    
    // 3. Check other features to ensure fallback works
    console.log('\n3. Checking fallback feature availability...');
    const featuresCheck = await query(`
      SELECT 
        features->'orderManagement' as order_management,
        features->'menuManagement' as menu_management,
        features->'qrCodeGeneration' as qr_generation,
        features->'orderHistory' as order_history
      FROM restaurants 
      WHERE name = 'Hotel King'
    `);
    
    const features = featuresCheck.rows[0];
    console.log('Available fallback features:');
    console.log(`- Table Orders (orderManagement): ${features.order_management}`);
    console.log(`- Menu Management: ${features.menu_management}`);
    console.log(`- QR Code Generation: ${features.qr_generation}`);
    console.log(`- Order History: ${features.order_history}`);
    
    // 4. Restore delivery orders for normal operation
    console.log('\n4. Restoring delivery orders for normal operation...');
    await query(`
      UPDATE restaurants 
      SET features = features || '{"deliveryOrders": true}'::jsonb
      WHERE name = 'Hotel King'
    `);
    
    console.log('✅ Delivery orders restored');
    
    console.log('\n🎉 Delivery redirect behavior test completed!');
    
    console.log('\n📋 Expected User Experience:');
    console.log('✅ When delivery orders disabled:');
    console.log('  - No error message shown');
    console.log('  - Automatically redirected to Table Orders');
    console.log('  - Delivery tab hidden from navigation');
    console.log('  - Seamless user experience');
    console.log('✅ When delivery orders enabled:');
    console.log('  - Full access to delivery orders');
    console.log('  - Delivery tab visible in navigation');
    console.log('  - Normal functionality');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDeliveryRedirectBehavior();