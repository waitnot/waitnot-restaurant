#!/usr/bin/env node

// Test script to create a test order and verify Clear Table button functionality
import { orderDB, restaurantDB } from './db.js';

async function testClearTableButton() {
  try {
    console.log('🧪 Testing Clear Table Button Functionality...\n');

    // Get restaurant ID
    console.log('1️⃣ Finding restaurant...');
    const restaurant = await restaurantDB.findOne({ email: 'king@gmail.com' });
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }
    console.log(`   ✅ Found restaurant: ${restaurant.name} (ID: ${restaurant._id})`);

    // Create a simple test order for testing the button
    console.log('\n2️⃣ Creating test order for Table 1...');
    
    const testOrderData = {
      restaurantId: restaurant._id,
      customerName: 'Test Customer',
      customerPhone: '+91-1234567890',
      orderType: 'dine-in',
      tableNumber: 1,
      items: [
        { name: 'Test Item', price: 100, quantity: 1 }
      ],
      totalAmount: 100,
      source: 'staff',
      status: 'pending'
    };

    const createdOrder = await orderDB.create(testOrderData);
    console.log(`   ✅ Test order created: ${createdOrder._id}`);
    console.log(`   📋 Order details:`);
    console.log(`      - Customer: ${createdOrder.customerName}`);
    console.log(`      - Table: ${createdOrder.tableNumber}`);
    console.log(`      - Status: ${createdOrder.status}`);
    console.log(`      - Total: ₹${createdOrder.totalAmount}`);

    // Check current order counts
    console.log('\n3️⃣ Checking current order counts...');
    const allOrders = await orderDB.findByRestaurant(restaurant._id);
    
    const activeDineInOrders = allOrders.filter(order => 
      (order.orderType === 'dine-in' || (order.source === 'staff' && order.orderType === 'dine-in')) &&
      order.status !== 'completed'
    );
    
    const completedOrders = allOrders.filter(order => order.status === 'completed');
    
    console.log(`   📊 Current counts:`);
    console.log(`      - Total orders: ${allOrders.length}`);
    console.log(`      - Active dine-in orders: ${activeDineInOrders.length}`);
    console.log(`      - Completed orders: ${completedOrders.length}`);
    console.log(`      - Table 1 active orders: ${activeDineInOrders.filter(o => o.tableNumber === 1).length}`);

    console.log('\n4️⃣ Instructions for manual testing:');
    console.log('   🌐 Open your restaurant dashboard in the browser');
    console.log('   📋 Go to "Table Orders" tab');
    console.log(`   🔍 Look for Table 1 with customer "${createdOrder.customerName}"`);
    console.log('   🧹 Click the "Clear Table" button');
    console.log('   ✅ Confirm the action in the popup');
    console.log('   📊 Verify the table disappears from Table Orders');
    console.log('   📜 Check Order History tab to see the completed order');

    console.log('\n5️⃣ Expected behavior:');
    console.log('   ✅ Confirmation popup should appear');
    console.log('   ✅ After confirming, success message should show');
    console.log('   ✅ Table should disappear from Table Orders');
    console.log('   ✅ Order should appear in Order History');
    console.log('   ✅ Badge count should decrease by 1');

    console.log('\n🔧 If Clear Table is not working, check:');
    console.log('   1. Browser console for JavaScript errors');
    console.log('   2. Network tab for failed API requests');
    console.log('   3. Make sure you are logged in as the restaurant');
    console.log('   4. Refresh the page and try again');

    console.log('\n📝 Test order created successfully!');
    console.log('   You can now test the Clear Table button manually.');
    
  } catch (error) {
    console.error('\n❌ Test setup failed!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testClearTableButton();