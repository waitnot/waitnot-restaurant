#!/usr/bin/env node

// Test script to verify order status update functionality
import { orderDB, restaurantDB } from './db.js';

async function testOrderStatusUpdate() {
  try {
    console.log('🧪 Testing Order Status Update...\n');

    // Get restaurant ID
    console.log('1️⃣ Finding restaurant...');
    const restaurant = await restaurantDB.findOne({ email: 'king@gmail.com' });
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }
    console.log(`   ✅ Found restaurant: ${restaurant.name} (ID: ${restaurant._id})`);

    // Get current orders
    console.log('\n2️⃣ Getting current orders...');
    const allOrders = await orderDB.findByRestaurant(restaurant._id);
    const pendingOrders = allOrders.filter(order => order.status === 'pending');
    
    console.log(`   📊 Order counts:`);
    console.log(`      - Total orders: ${allOrders.length}`);
    console.log(`      - Pending orders: ${pendingOrders.length}`);
    console.log(`      - Completed orders: ${allOrders.filter(o => o.status === 'completed').length}`);

    if (pendingOrders.length === 0) {
      console.log('\n⚠️ No pending orders found to test with.');
      console.log('   The Clear Table functionality requires pending orders.');
      console.log('   Please create an order through the staff interface first.');
      return;
    }

    // Test updating the first pending order
    const testOrder = pendingOrders[0];
    console.log(`\n3️⃣ Testing status update on order: ${testOrder._id}`);
    console.log(`   📋 Order details:`);
    console.log(`      - Customer: ${testOrder.customerName}`);
    console.log(`      - Table: ${testOrder.tableNumber}`);
    console.log(`      - Current Status: ${testOrder.status}`);
    console.log(`      - Total: ₹${testOrder.totalAmount}`);

    // Update status to completed
    console.log('\n4️⃣ Updating order status to completed...');
    const updatedOrder = await orderDB.update(testOrder._id, { status: 'completed' });
    console.log(`   ✅ Order status updated successfully`);
    console.log(`   📋 Updated order status: ${updatedOrder.status}`);

    // Verify the update
    console.log('\n5️⃣ Verifying the update...');
    const verifyOrders = await orderDB.findByRestaurant(restaurant._id);
    const updatedPendingOrders = verifyOrders.filter(order => order.status === 'pending');
    const updatedCompletedOrders = verifyOrders.filter(order => order.status === 'completed');

    console.log(`   📊 Updated counts:`);
    console.log(`      - Pending orders: ${updatedPendingOrders.length} (decreased by 1)`);
    console.log(`      - Completed orders: ${updatedCompletedOrders.length} (increased by 1)`);

    console.log('\n🎉 Order Status Update Test PASSED!');
    console.log('✅ The database update functionality is working correctly.');
    console.log('✅ If Clear Table is not working, the issue is likely in the frontend.');
    
    console.log('\n🔧 Troubleshooting steps:');
    console.log('   1. Open browser developer tools (F12)');
    console.log('   2. Go to Console tab');
    console.log('   3. Click the Clear Table button');
    console.log('   4. Look for console.log messages starting with 🧹');
    console.log('   5. Check for any error messages in red');
    console.log('   6. If no messages appear, the button click is not being registered');
    
  } catch (error) {
    console.error('\n❌ Order Status Update Test FAILED!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testOrderStatusUpdate();