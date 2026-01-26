#!/usr/bin/env node

// Test script to verify staff orders are stored in database
import { orderDB, restaurantDB } from './db.js';

async function teststaffOrder() {
  try {
    console.log('🧪 Testing staff Order Storage...\n');

    // Get restaurant ID
    console.log('1️⃣ Finding restaurant...');
    const restaurant = await restaurantDB.findOne({ email: 'king@gmail.com' });
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }
    console.log(`   ✅ Found restaurant: ${restaurant.name} (ID: ${restaurant._id})`);

    // Create test staff order
    console.log('\n2️⃣ Creating test staff order...');
    const testOrderData = {
      restaurantId: restaurant._id,
      customerName: 'Test staff Customer',
      customerPhone: '+91-9876543210',
      orderType: 'dine-in',
      tableNumber: 3,
      items: [
        {
          name: 'Test Dish 1',
          price: 150,
          quantity: 2
        },
        {
          name: 'Test Dish 2', 
          price: 200,
          quantity: 1
        }
      ],
      totalAmount: 500,
      specialInstructions: 'Test order from staff',
      source: 'staff',
      status: 'pending'
    };

    console.log('   📤 Order data:', JSON.stringify(testOrderData, null, 4));

    const createdOrder = await orderDB.create(testOrderData);
    console.log(`   ✅ Order created successfully with ID: ${createdOrder._id}`);

    // Verify order was stored
    console.log('\n3️⃣ Verifying order in database...');
    const orders = await orderDB.findByRestaurant(restaurant._id);
    const staffOrders = orders.filter(order => 
      order.customerName === 'Test staff Customer'
    );

    if (staffOrders.length === 0) {
      throw new Error('❌ staff order not found in database!');
    }

    const storedOrder = staffOrders[0];
    console.log('   ✅ Order found in database:');
    console.log(`      - Order ID: ${storedOrder._id}`);
    console.log(`      - Customer: ${storedOrder.customerName}`);
    console.log(`      - Phone: ${storedOrder.customerPhone}`);
    console.log(`      - Type: ${storedOrder.orderType}`);
    console.log(`      - Table: ${storedOrder.tableNumber}`);
    console.log(`      - Status: ${storedOrder.status}`);
    console.log(`      - Total: ₹${storedOrder.totalAmount}`);
    console.log(`      - Items: ${storedOrder.items?.length || 0} items`);
    console.log(`      - Instructions: ${storedOrder.specialInstructions || 'None'}`);

    // Verify items
    if (storedOrder.items && storedOrder.items.length > 0) {
      console.log('   📋 Order items:');
      storedOrder.items.forEach((item, index) => {
        console.log(`      ${index + 1}. ${item.name} x ${item.quantity} = ₹${item.price * item.quantity}`);
      });
    }

    // Check if order appears in active orders (non-completed)
    console.log('\n4️⃣ Checking active order counts...');
    const activeOrders = orders.filter(order => order.status !== 'completed');
    const activeDineInOrders = activeOrders.filter(order => 
      order.orderType === 'dine-in' || 
      (order.source === 'staff' && order.orderType === 'dine-in')
    );
    const activeDeliveryOrders = activeOrders.filter(order => 
      order.orderType === 'delivery' || order.orderType === 'takeaway'
    );

    console.log(`   📊 Order counts:`);
    console.log(`      - Total orders: ${orders.length}`);
    console.log(`      - Active orders: ${activeOrders.length}`);
    console.log(`      - Active dine-in orders: ${activeDineInOrders.length}`);
    console.log(`      - Active delivery orders: ${activeDeliveryOrders.length}`);

    // Clean up test order
    console.log('\n5️⃣ Cleaning up test order...');
    try {
      await orderDB.delete(createdOrder._id);
      console.log('   ✅ Test order cleaned up successfully');
    } catch (cleanupError) {
      console.log('   ⚠️ Could not clean up test order:', cleanupError.message);
    }

    console.log('\n🎉 staff Order Test PASSED!');
    console.log('✅ staff orders are being stored correctly in the database.');
    
  } catch (error) {
    console.error('\n❌ staff Order Test FAILED!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
teststaffOrder();
