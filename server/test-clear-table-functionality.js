#!/usr/bin/env node

// Test script to verify Clear Table functionality
import { orderDB, restaurantDB } from './db.js';

async function testClearTableFunctionality() {
  try {
    console.log('🧪 Testing Clear Table Functionality...\n');

    // Get restaurant ID
    console.log('1️⃣ Finding restaurant...');
    const restaurant = await restaurantDB.findOne({ email: 'king@gmail.com' });
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }
    console.log(`   ✅ Found restaurant: ${restaurant.name} (ID: ${restaurant._id})`);

    // Create multiple test orders for the same table (simulating multiple orders from same customer)
    console.log('\n2️⃣ Creating multiple orders for Table 3...');
    
    const order1Data = {
      restaurantId: restaurant._id,
      customerName: 'John Doe',
      customerPhone: '+91-9876543210',
      orderType: 'dine-in',
      tableNumber: 3,
      items: [
        { name: 'Chicken Curry', price: 250, quantity: 1 },
        { name: 'Rice', price: 80, quantity: 2 }
      ],
      totalAmount: 410,
      source: 'staff',
      status: 'pending'
    };

    const order2Data = {
      restaurantId: restaurant._id,
      customerName: 'John Doe',
      customerPhone: '+91-9876543210',
      orderType: 'dine-in',
      tableNumber: 3,
      items: [
        { name: 'Naan', price: 60, quantity: 2 },
        { name: 'Lassi', price: 80, quantity: 1 }
      ],
      totalAmount: 200,
      source: 'staff',
      status: 'pending'
    };

    const createdOrder1 = await orderDB.create(order1Data);
    const createdOrder2 = await orderDB.create(order2Data);
    
    console.log(`   ✅ Order 1 created: ${createdOrder1._id} (₹${createdOrder1.totalAmount})`);
    console.log(`   ✅ Order 2 created: ${createdOrder2._id} (₹${createdOrder2.totalAmount})`);

    // Check orders appear in Table Orders
    console.log('\n3️⃣ Checking Table Orders visibility...');
    const allOrders = await orderDB.findByRestaurant(restaurant._id);
    const table3Orders = allOrders.filter(order => 
      order.tableNumber === 3 && order.status !== 'completed'
    );
    
    console.log(`   📊 Table 3 active orders: ${table3Orders.length}`);
    console.log(`   💰 Total amount for table: ₹${table3Orders.reduce((sum, order) => sum + order.totalAmount, 0)}`);

    // Simulate Clear Table action (mark orders as completed)
    console.log('\n4️⃣ Simulating Clear Table action...');
    console.log('   🧹 Marking all Table 3 orders as completed (saving to Order History)...');
    
    for (const order of table3Orders) {
      await orderDB.update(order._id, { status: 'completed' });
      console.log(`      ✅ Order ${order._id} marked as completed`);
    }

    // Verify orders moved to Order History
    console.log('\n5️⃣ Verifying orders moved to Order History...');
    const updatedOrders = await orderDB.findByRestaurant(restaurant._id);
    
    const activeTable3Orders = updatedOrders.filter(order => 
      order.tableNumber === 3 && order.status !== 'completed'
    );
    
    const completedTable3Orders = updatedOrders.filter(order => 
      order.tableNumber === 3 && order.status === 'completed'
    );

    console.log(`   📊 Results:`);
    console.log(`      - Active Table 3 orders: ${activeTable3Orders.length} (should be 0)`);
    console.log(`      - Completed Table 3 orders: ${completedTable3Orders.length} (should be 2)`);
    console.log(`      - Total completed orders: ${updatedOrders.filter(o => o.status === 'completed').length}`);

    // Verify badge counts
    const activeDineInOrders = updatedOrders.filter(order => 
      (order.orderType === 'dine-in' || (order.source === 'staff' && order.orderType === 'dine-in')) &&
      order.status !== 'completed'
    );

    console.log(`   🏷️ Badge counts:`);
    console.log(`      - Active dine-in orders: ${activeDineInOrders.length}`);

    // Test results
    if (activeTable3Orders.length === 0 && completedTable3Orders.length === 2) {
      console.log('\n🎉 Clear Table Functionality Test PASSED!');
      console.log('✅ Orders successfully moved from Table Orders to Order History');
      console.log('✅ Table cleared and ready for next customer');
    } else {
      throw new Error('Clear Table functionality not working correctly');
    }
    
  } catch (error) {
    console.error('\n❌ Clear Table Functionality Test FAILED!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testClearTableFunctionality();
