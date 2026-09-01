import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

async function testDiscountSystem() {
  try {
    console.log('🎉 Testing Discount System...');
    
    // First, login as restaurant to get token
    const loginResponse = await axios.post(`${API_BASE}/auth/restaurant/login`, {
      email: 'king@gmail.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.token;
    const restaurantId = loginResponse.data.restaurant.id;
    
    console.log('✅ Logged in successfully');
    console.log('🏪 Restaurant ID:', restaurantId);
    
    // Create a test discount
    const discountData = {
      name: 'Diwali Special',
      description: 'Special discount for Diwali festival - QR exclusive!',
      discount_type: 'percentage',
      discount_value: 20,
      min_order_amount: 100,
      max_discount_amount: 200,
      is_qr_exclusive: true,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      usage_limit: 100
    };
    
    const createResponse = await axios.post(`${API_BASE}/discounts`, discountData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Discount created:', createResponse.data);
    
    // Test fetching active discounts for QR orders
    const activeDiscountsResponse = await axios.get(`${API_BASE}/discounts/active/${restaurantId}?qr=true`);
    console.log('✅ Active QR discounts:', activeDiscountsResponse.data);
    
    // Test applying discount
    const applyResponse = await axios.post(`${API_BASE}/discounts/apply`, {
      discountId: createResponse.data.id,
      orderAmount: 500,
      items: [
        { name: 'Test Item 1', price: 200, quantity: 1 },
        { name: 'Test Item 2', price: 300, quantity: 1 }
      ],
      isQrOrder: true
    });
    
    console.log('✅ Discount applied:', applyResponse.data);
    console.log('💰 Original Amount:', applyResponse.data.originalAmount);
    console.log('🎉 Discount Amount:', applyResponse.data.discountAmount);
    console.log('💵 Final Amount:', applyResponse.data.finalAmount);
    console.log('💸 Savings:', applyResponse.data.savings);
    
    // Test fetching all discounts for restaurant
    const allDiscountsResponse = await axios.get(`${API_BASE}/discounts/restaurant/${restaurantId}`);
    console.log('✅ All restaurant discounts:', allDiscountsResponse.data.length, 'discounts found');
    
    console.log('🎉 Discount system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testDiscountSystem();