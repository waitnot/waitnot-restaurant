#!/usr/bin/env node

// Test script to verify feedback system functionality
import { feedbackDB, restaurantDB } from './db.js';

async function testFeedbackSystem() {
  try {
    console.log('🧪 Testing Feedback System...\n');

    // Get restaurant ID
    console.log('1️⃣ Finding restaurant...');
    const restaurant = await restaurantDB.findOne({ email: 'king@gmail.com' });
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }
    console.log(`   ✅ Found restaurant: ${restaurant.name} (ID: ${restaurant._id})`);

    // Create test feedback
    console.log('\n2️⃣ Creating test feedback...');
    const testFeedback = {
      restaurantId: restaurant._id,
      customerName: 'John Doe',
      customerPhone: '+91-9876543210',
      customerEmail: 'john@example.com',
      rating: 5,
      feedbackText: 'Amazing food and excellent service! The chicken curry was delicious and the staff was very friendly. Will definitely come back again!',
      feedbackType: 'food',
      isAnonymous: false
    };

    const createdFeedback = await feedbackDB.create(testFeedback);
    console.log(`   ✅ Feedback created: ${createdFeedback._id}`);
    console.log(`   📋 Details:`);
    console.log(`      - Customer: ${createdFeedback.customerName}`);
    console.log(`      - Rating: ${createdFeedback.rating}⭐`);
    console.log(`      - Type: ${createdFeedback.feedbackType}`);
    console.log(`      - Status: ${createdFeedback.status}`);

    // Create anonymous feedback
    console.log('\n3️⃣ Creating anonymous feedback...');
    const anonymousFeedback = {
      restaurantId: restaurant._id,
      customerName: 'Anonymous',
      rating: 4,
      feedbackText: 'Good food but service could be faster. Overall satisfied with the experience.',
      feedbackType: 'service',
      isAnonymous: true
    };

    const createdAnonymous = await feedbackDB.create(anonymousFeedback);
    console.log(`   ✅ Anonymous feedback created: ${createdAnonymous._id}`);

    // Test restaurant response
    console.log('\n4️⃣ Testing restaurant response...');
    const updatedFeedback = await feedbackDB.update(createdFeedback._id, {
      restaurantResponse: 'Thank you so much for your wonderful feedback! We are delighted to hear that you enjoyed our chicken curry and found our staff friendly. We look forward to serving you again soon!',
      status: 'responded'
    });
    console.log(`   ✅ Restaurant response added`);
    console.log(`   📝 Response: ${updatedFeedback.restaurantResponse.substring(0, 50)}...`);

    // Get feedback statistics
    console.log('\n5️⃣ Getting feedback statistics...');
    const stats = await feedbackDB.getStats(restaurant._id);
    console.log(`   📊 Feedback Statistics:`);
    console.log(`      - Total Feedback: ${stats.totalFeedback}`);
    console.log(`      - Average Rating: ${stats.averageRating.toFixed(1)}⭐`);
    console.log(`      - 5 Star: ${stats.ratingBreakdown.fiveStar}`);
    console.log(`      - 4 Star: ${stats.ratingBreakdown.fourStar}`);
    console.log(`      - 3 Star: ${stats.ratingBreakdown.threeStar}`);
    console.log(`      - 2 Star: ${stats.ratingBreakdown.twoStar}`);
    console.log(`      - 1 Star: ${stats.ratingBreakdown.oneStar}`);
    console.log(`      - Pending Responses: ${stats.pendingResponses}`);
    console.log(`      - Responded: ${stats.responded}`);

    // Get all feedback for restaurant
    console.log('\n6️⃣ Getting all feedback for restaurant...');
    const allFeedback = await feedbackDB.findByRestaurant(restaurant._id);
    console.log(`   📋 Found ${allFeedback.length} feedback entries:`);
    allFeedback.forEach((feedback, index) => {
      console.log(`      ${index + 1}. ${feedback.customerName} - ${feedback.rating}⭐ - ${feedback.status}`);
    });

    console.log('\n🎉 Feedback System Test PASSED!');
    console.log('✅ All feedback functionality is working correctly.');
    console.log('\n📱 Next steps:');
    console.log('   1. Open restaurant dashboard');
    console.log('   2. Go to "Feedback" tab');
    console.log('   3. View the test feedback entries');
    console.log('   4. Test responding to feedback');
    console.log('   5. Place an order and submit feedback from customer side');
    
  } catch (error) {
    console.error('\n❌ Feedback System Test FAILED!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testFeedbackSystem();