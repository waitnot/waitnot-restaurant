import axios from 'axios';

const API_BASE = 'http://localhost:5000';

async function testOrderEdit() {
  try {
    console.log('🧪 Testing Order Edit API...');
    
    // First, let's get all orders to find one to edit
    console.log('📋 Fetching orders...');
    const ordersResponse = await axios.get(`${API_BASE}/api/orders`);
    const orders = ordersResponse.data;
    
    if (orders.length === 0) {
      console.log('❌ No orders found to test with');
      return;
    }
    
    // Find a staff order to edit
    const staffOrder = orders.find(order => order.source === 'staff');
    
    if (!staffOrder) {
      console.log('❌ No staff orders found to test with');
      console.log('Available orders:', orders.map(o => ({ id: o._id, source: o.source })));
      return;
    }
    
    console.log('✅ Found staff order to edit:', staffOrder._id);
    console.log('Current order:', {
      customerName: staffOrder.customerName,
      totalAmount: staffOrder.totalAmount,
      itemCount: staffOrder.items.length
    });
    
    // Test the PUT endpoint
    const updateData = {
      customerName: staffOrder.customerName + ' (EDITED)',
      customerPhone: staffOrder.customerPhone || '9999999999',
      orderType: staffOrder.orderType,
      deliveryAddress: staffOrder.deliveryAddress || '',
      tableNumber: staffOrder.tableNumber || 1,
      items: staffOrder.items,
      totalAmount: staffOrder.totalAmount,
      specialInstructions: (staffOrder.specialInstructions || '') + ' - EDITED VIA API TEST'
    };
    
    console.log('🔄 Testing PUT /api/orders/' + staffOrder._id);
    const updateResponse = await axios.put(`${API_BASE}/api/orders/${staffOrder._id}`, updateData);
    
    console.log('✅ Order updated successfully!');
    console.log('Updated order:', {
      customerName: updateResponse.data.customerName,
      totalAmount: updateResponse.data.totalAmount,
      specialInstructions: updateResponse.data.specialInstructions
    });
    
    console.log('🎉 Order edit API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Order edit test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testOrderEdit();