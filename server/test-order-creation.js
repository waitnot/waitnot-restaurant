import { initDB, orderDB, restaurantDB } from './db.js';

async function testOrderCreation() {
  try {
    console.log('🔍 Testing order creation...');
    
    await initDB();
    
    // Get a test restaurant
    const restaurant = await restaurantDB.findOne({ email: 'king@gmail.com' });
    if (!restaurant) {
      console.log('❌ Test restaurant not found');
      return;
    }
    
    console.log('✅ Found restaurant:', restaurant.name);
    console.log('   Restaurant ID:', restaurant._id);
    
    // Create a test order
    const testOrderData = {
      restaurantId: restaurant._id,
      tableNumber: 5,
      customerName: 'Test Customer',
      customerPhone: '1234567890',
      type: 'dine-in',
      status: 'pending',
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      total: 150,
      items: [
        {
          name: 'Test Item 1',
          price: 100,
          quantity: 1
        },
        {
          name: 'Test Item 2', 
          price: 50,
          quantity: 1
        }
      ]
    };
    
    console.log('\n🔄 Creating test order...');
    console.log('Order data:', JSON.stringify(testOrderData, null, 2));
    
    const createdOrder = await orderDB.create(testOrderData);
    
    if (createdOrder) {
      console.log('\n✅ Order created successfully!');
      console.log('📝 Order details:');
      console.log('   Order ID:', createdOrder._id);
      console.log('   Restaurant ID:', createdOrder.restaurantId);
      console.log('   Customer:', createdOrder.customerName);
      console.log('   Table:', createdOrder.tableNumber);
      console.log('   Total:', createdOrder.total);
      console.log('   Items:', createdOrder.items.length);
      console.log('   Status:', createdOrder.status);
      console.log('   Created:', createdOrder.createdAt);
      
      // Verify order can be retrieved
      console.log('\n🔍 Verifying order retrieval...');
      const retrievedOrder = await orderDB.findById(createdOrder._id);
      
      if (retrievedOrder) {
        console.log('✅ Order retrieval successful');
        console.log('   Retrieved order ID:', retrievedOrder._id);
        console.log('   Items count:', retrievedOrder.items?.length || 0);
      } else {
        console.log('❌ Order retrieval failed');
      }
      
      // Test restaurant orders list
      console.log('\n🔍 Testing restaurant orders list...');
      const restaurantOrders = await orderDB.findByRestaurant(restaurant._id);
      console.log('✅ Restaurant has', restaurantOrders.length, 'orders');
      
    } else {
      console.log('❌ Order creation failed - no order returned');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error stack:', error.stack);
  }
  
  process.exit(0);
}

testOrderCreation();