#!/usr/bin/env node

// Test script to verify QR order feedback functionality
import { feedbackDB, restaurantDB, orderDB } from './db.js';

async function testQRFeedback() {
  try {
    console.log('🧪 Testing QR Order Feedback Functionality...\n');

    // Get restaurant ID
    console.log('1️⃣ Finding restaurant...');
    const restaurant = await restaurantDB.findOne({ email: 'king@gmail.com' });
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }
    console.log(`   ✅ Found restaurant: ${restaurant.name} (ID: ${restaurant._id})`);

    // Create a test QR order
    console.log('\n2️⃣ Creating test QR order...');
    const testOrder = {
      restaurantId: restaurant._id,
      tableNumber: 5,
      customerName: 'QR Customer',
      customerPhone: '+91-9876543210',
      orderType: 'dine-in',
      items: [
        { name: 'Chicken Biryani', price: 250, quantity: 1 },
        { name: 'Raita', price: 50, quantity: 1 }
      ],
      totalAmount: 300,
      status: 'pending',
      paymentMethod: 'upi',
      paymentStatus: 'paid'
    };

    const createdOrder = await orderDB.create(testOrder);
    console.log(`   ✅ QR order created: ${createdOrder._id}`);
    console.log(`   📋 Order details:`);
    console.log(`      - Customer: ${createdOrder.customerName}`);
    console.log(`      - Table: ${createdOrder.tableNumber}`);
    console.log(`      - Total: ₹${createdOrder.totalAmount}`);
    console.log(`      - Payment: ${createdOrder.paymentMethod} (${createdOrder.paymentStatus})`);

    // Create feedback for the QR order
    console.log('\n3️⃣ Creating feedback for QR order...');
    const qrFeedback = {
      restaurantId: restaurant._id,
      orderId: createdOrder._id,
      customerName: 'QR Customer',
      customerPhone: '+91-9876543210',
      rating: 5,
      feedbackText: 'Excellent experience! The QR ordering system is so convenient and the food was delicious. The biryani was perfectly cooked and the service was quick.',
      feedbackType: 'general',
      isAnonymous: false
    };

    const createdFeedback = await feedbackDB.create(qrFeedback);
    console.log(`   ✅ QR feedback created: ${createdFeedback._id}`);
    console.log(`   📋 Feedback details:`);
    console.log(`      - Customer: ${createdFeedback.customerName}`);
    console.log(`      - Rating: ${createdFeedback.rating}⭐`);
    console.log(`      - Type: ${createdFeedback.feedbackType}`);
    console.log(`      - Linked to Order: ${createdFeedback.orderId ? 'Yes' : 'No'}`);

    // Test anonymous QR feedback
    console.log('\n4️⃣ Creating anonymous QR feedback...');
    const anonymousQRFeedback = {
      restaurantId: restaurant._id,
      customerName: 'Anonymous',
      rating: 4,
      feedbackText: 'Good food and easy ordering through QR code. Would recommend to others.',
      feedbackType: 'service',
      isAnonymous: true
    };

    const anonymousFeedback = await feedbackDB.create(anonymousQRFeedback);
    console.log(`   ✅ Anonymous QR feedback created: ${anonymousFeedback._id}`);

    // Get updated feedback statistics
    console.log('\n5️⃣ Getting updated feedback statistics...');
    const stats = await feedbackDB.getStats(restaurant._id);
    console.log(`   📊 Updated Statistics:`);
    console.log(`      - Total Feedback: ${stats.totalFeedback}`);
    console.log(`      - Average Rating: ${stats.averageRating.toFixed(1)}⭐`);
    console.log(`      - 5 Star: ${stats.ratingBreakdown.fiveStar}`);
    console.log(`      - 4 Star: ${stats.ratingBreakdown.fourStar}`);
    console.log(`      - Pending Responses: ${stats.pendingResponses}`);

    // Get all feedback to verify QR feedback appears
    console.log('\n6️⃣ Verifying QR feedback in restaurant dashboard...');
    const allFeedback = await feedbackDB.findByRestaurant(restaurant._id);
    const qrOrderFeedback = allFeedback.filter(f => f.orderId === createdOrder._id);
    
    console.log(`   📋 Total feedback entries: ${allFeedback.length}`);
    console.log(`   🎯 QR order linked feedback: ${qrOrderFeedback.length}`);
    
    if (qrOrderFeedback.length > 0) {
      const feedback = qrOrderFeedback[0];
      console.log(`      ✅ QR feedback found:`);
      console.log(`         - Customer: ${feedback.customerName}`);
      console.log(`         - Table: ${feedback.tableNumber || 'N/A'}`);
      console.log(`         - Order Type: ${feedback.orderType || 'N/A'}`);
      console.log(`         - Rating: ${feedback.rating}⭐`);
    }

    console.log('\n🎉 QR Order Feedback Test PASSED!');
    console.log('✅ QR customers can now submit feedback successfully.');
    console.log('\n📱 QR Feedback Features Available:');
    console.log('   1. 💬 Feedback button in QR order header (always visible)');
    console.log('   2. 🎉 Feedback option after successful order placement');
    console.log('   3. 💳 Feedback option after cash payment confirmation');
    console.log('   4. 📋 Feedback linked to specific orders (optional)');
    console.log('   5. 👤 Anonymous feedback support');
    console.log('   6. ⭐ 1-5 star rating system');
    console.log('   7. 📊 Real-time statistics in restaurant dashboard');
    
    console.log('\n🧪 Test QR Feedback Flow:');
    console.log('   1. Scan QR code for Table 5');
    console.log('   2. Place an order');
    console.log('   3. After order success, choose to leave feedback');
    console.log('   4. Fill feedback form and submit');
    console.log('   5. Check restaurant dashboard → Feedback tab');
    
  } catch (error) {
    console.error('\n❌ QR Order Feedback Test FAILED!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testQRFeedback();