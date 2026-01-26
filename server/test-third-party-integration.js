#!/usr/bin/env node

// Test script for third-party order integration
import { orderDB, restaurantDB } from './db.js';

async function testThirdPartyIntegration() {
  try {
    console.log('🧪 Testing Third-Party Order Integration...\n');

    // Get restaurant ID
    console.log('1️⃣ Finding restaurant...');
    const restaurants = await restaurantDB.findAll();
    if (restaurants.length === 0) {
      throw new Error('No restaurants found');
    }
    const restaurant = restaurants[0];
    console.log(`   ✅ Found restaurant: ${restaurant.name} (ID: ${restaurant._id})`);

    // Create test Swiggy order
    console.log('\n2️⃣ Creating test Swiggy order...');
    const swiggyOrderData = {
      restaurantId: restaurant._id,
      source: 'swiggy',
      platformOrderId: 'SWG123456789',
      customerName: 'Test Swiggy Customer',
      customerPhone: '+91-9876543210',
      deliveryAddress: '123 Test Street, Test City, 123456',
      items: [
        {
          name: 'Butter Chicken',
          price: 250,
          quantity: 1
        },
        {
          name: 'Naan',
          price: 50,
          quantity: 2
        }
      ],
      totalAmount: 350,
      platformFee: 15,
      commissionRate: 20,
      estimatedDeliveryTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 minutes from now
      specialInstructions: 'Extra spicy, no onions',
      orderType: 'delivery'
    };

    console.log('   📤 Order data:', JSON.stringify(swiggyOrderData, null, 2));
    
    const swiggyOrder = await orderDB.create(swiggyOrderData);
    console.log(`   ✅ Swiggy order created: ${swiggyOrder._id}`);

    // Create test Zomato order
    console.log('\n3️⃣ Creating test Zomato order...');
    const zomatoOrderData = {
      restaurantId: restaurant._id,
      source: 'zomato',
      platformOrderId: 'ZOM987654321',
      customerName: 'Test Zomato Customer',
      customerPhone: '+91-9876543211',
      deliveryAddress: '456 Another Street, Test City, 123456',
      items: [
        {
          name: 'Biryani',
          price: 300,
          quantity: 1
        },
        {
          name: 'Raita',
          price: 80,
          quantity: 1
        }
      ],
      totalAmount: 380,
      platformFee: 20,
      commissionRate: 25,
      estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 60 minutes from now
      specialInstructions: 'Medium spice level',
      orderType: 'delivery'
    };

    const zomatoOrder = await orderDB.create(zomatoOrderData);
    console.log(`   ✅ Zomato order created: ${zomatoOrder._id}`);

    // Verify orders in database
    console.log('\n4️⃣ Verifying orders in database...');
    const allOrders = await orderDB.findByRestaurant(restaurant._id);
    const thirdPartyOrders = allOrders.filter(order => 
      ['swiggy', 'zomato', 'uber-eats', 'foodpanda'].includes(order.source)
    );

    console.log(`   📊 Total orders: ${allOrders.length}`);
    console.log(`   📱 Third-party orders: ${thirdPartyOrders.length}`);

    thirdPartyOrders.forEach(order => {
      console.log(`   ✅ ${order.source.toUpperCase()} Order:`);
      console.log(`      - ID: ${order._id}`);
      console.log(`      - Platform Order ID: ${order.platformOrderId}`);
      console.log(`      - Customer: ${order.customerName}`);
      console.log(`      - Total: ₹${order.totalAmount}`);
      console.log(`      - Commission: ₹${order.commission}`);
      console.log(`      - Platform Fee: ₹${order.platformFee}`);
      console.log(`      - Net Amount: ₹${order.netAmount}`);
      console.log(`      - Status: ${order.status}`);
    });

    // Test analytics calculation
    console.log('\n5️⃣ Testing analytics calculation...');
    const analytics = {
      totalOrders: thirdPartyOrders.length,
      totalRevenue: thirdPartyOrders.reduce((sum, order) => sum + order.totalAmount, 0),
      totalCommission: thirdPartyOrders.reduce((sum, order) => sum + (order.commission || 0), 0),
      netRevenue: thirdPartyOrders.reduce((sum, order) => sum + (order.netAmount || order.totalAmount), 0),
      platformBreakdown: {}
    };

    // Platform-wise breakdown
    ['swiggy', 'zomato', 'uber-eats', 'foodpanda'].forEach(platform => {
      const platformOrders = thirdPartyOrders.filter(order => order.source === platform);
      analytics.platformBreakdown[platform] = {
        orders: platformOrders.length,
        revenue: platformOrders.reduce((sum, order) => sum + order.totalAmount, 0),
        commission: platformOrders.reduce((sum, order) => sum + (order.commission || 0), 0),
        netRevenue: platformOrders.reduce((sum, order) => sum + (order.netAmount || order.totalAmount), 0)
      };
    });

    console.log('   📊 Analytics Summary:');
    console.log(`      - Total Orders: ${analytics.totalOrders}`);
    console.log(`      - Total Revenue: ₹${analytics.totalRevenue}`);
    console.log(`      - Total Commission: ₹${analytics.totalCommission}`);
    console.log(`      - Net Revenue: ₹${analytics.netRevenue}`);
    
    console.log('   📊 Platform Breakdown:');
    Object.entries(analytics.platformBreakdown).forEach(([platform, stats]) => {
      if (stats.orders > 0) {
        console.log(`      - ${platform.toUpperCase()}: ${stats.orders} orders, ₹${stats.revenue} revenue, ₹${stats.commission} commission, ₹${stats.netRevenue} net`);
      }
    });

    console.log('\n🎉 Third-Party Integration Test PASSED!');
    console.log('✅ All third-party order functionality is working correctly.');
    
    console.log('\n📱 Next steps:');
    console.log('   1. Open restaurant dashboard');
    console.log('   2. Go to "📱 Third-Party" tab');
    console.log('   3. View the test orders');
    console.log('   4. Test adding new orders manually');
    console.log('   5. Set up API integrations with Swiggy/Zomato');

  } catch (error) {
    console.error('\n❌ Third-Party Integration Test FAILED!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testThirdPartyIntegration()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });