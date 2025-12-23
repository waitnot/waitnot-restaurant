import express from 'express';
import { orderDB } from '../db.js';

const router = express.Router();

// Create order
router.post('/', async (req, res) => {
  try {
    console.log('📝 Order creation request received');
    console.log('Order data:', JSON.stringify(req.body, null, 2));
    
    // Validate required fields
    const { restaurantId, items, total, totalAmount } = req.body;
    
    if (!restaurantId) {
      console.log('❌ Missing restaurantId');
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log('❌ Missing or empty items array');
      return res.status(400).json({ error: 'Order items are required' });
    }
    
    if (!total && !totalAmount) {
      console.log('❌ Missing total amount');
      return res.status(400).json({ error: 'Order total is required' });
    }
    
    console.log('✅ Order validation passed, creating order...');
    
    const order = await orderDB.create(req.body);
    
    console.log('✅ Order created successfully:', order._id);
    
    // Send real-time notification
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`restaurant-${order.restaurantId}`).emit('new-order', order);
        console.log('📡 Real-time notification sent to restaurant');
      }
    } catch (socketError) {
      console.log('⚠️ Socket notification failed:', socketError.message);
      // Don't fail the order creation if socket fails
    }
    
    res.status(201).json(order);
  } catch (error) {
    console.error('❌ Order creation failed:', error);
    console.error('Error stack:', error.stack);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to place order';
    
    if (error.message.includes('connect')) {
      errorMessage = 'Database connection error. Please try again.';
    } else if (error.message.includes('violates')) {
      errorMessage = 'Invalid order data. Please check your order details.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout. Please try again.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get orders by restaurant
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    const orders = await orderDB.findByRestaurant(req.params.restaurantId);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const order = await orderDB.update(req.params.id, { status: req.body.status });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    const io = req.app.get('io');
    io.to(`restaurant-${order.restaurantId}`).emit('order-updated', order);
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update payment status
router.patch('/:id/payment', async (req, res) => {
  try {
    const order = await orderDB.update(req.params.id, {
      paymentStatus: 'paid',
      paymentMethod: req.body.paymentMethod
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order items (for kitchen printing status)
router.patch('/:id/items', async (req, res) => {
  try {
    const order = await orderDB.update(req.params.id, {
      items: req.body.items
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    const io = req.app.get('io');
    io.to(`restaurant-${order.restaurantId}`).emit('order-updated', order);
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
