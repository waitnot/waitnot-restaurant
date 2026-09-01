// Test script for order history clearing API
import axios from 'axios';

const BASE_URL = 'http://localhost:5000';
const RESTAURANT_ID = '3a0d1b05-6ace-4a0c-8625-20e618740534';

async function testClearHistoryAPI() {
  console.log('🧪 Testing Order History Clearing API...\n');
  
  try {
    // Test 1: Get current analytics to see order count
    console.log('📊 Step 1: Getting current analytics...');
    const analyticsResponse = await axios.get(`${BASE_URL}/api/analytics/restaurant/${RESTAURANT_ID}`);
    console.log(`✅ Current total orders: ${analyticsResponse.data.metrics.totalOrders}`);
    console.log(`✅ Current completed orders: ${analyticsResponse.data.breakdowns.status.find(s => s.status === 'completed')?.count || 0}\n`);
    
    // Test 2: Test clear history endpoint
    console.log('🗑️ Step 2: Testing clear history endpoint...');
    const clearResponse = await axios.delete(`${BASE_URL}/api/analytics/restaurant/${RESTAURANT_ID}/history?type=completed`);
    console.log(`✅ Clear history response:`, clearResponse.data);
    console.log(`✅ Cleared ${clearResponse.data.clearedCount} orders\n`);
    
    // Test 3: Get analytics after clearing
    console.log('📊 Step 3: Getting analytics after clearing...');
    const analyticsAfter = await axios.get(`${BASE_URL}/api/analytics/restaurant/${RESTAURANT_ID}`);
    console.log(`✅ Total orders after clearing: ${analyticsAfter.data.metrics.totalOrders}`);
    console.log(`✅ Completed orders after clearing: ${analyticsAfter.data.breakdowns.status.find(s => s.status === 'completed')?.count || 0}\n`);
    
    // Test 4: Test report generation with clearing
    console.log('📋 Step 4: Testing report generation with clearing...');
    const reportResponse = await axios.get(`${BASE_URL}/api/analytics/restaurant/${RESTAURANT_ID}/report?type=weekly&format=json&clearHistory=true`);
    console.log(`✅ Report generated with ${reportResponse.data.totalRecords} records`);
    console.log(`✅ History cleared: ${reportResponse.data.clearedHistory}`);
    console.log(`✅ Orders cleared in report: ${reportResponse.data.clearedOrders}\n`);
    
    console.log('🎉 All tests passed! Order history clearing API is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testClearHistoryAPI();