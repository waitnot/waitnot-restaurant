import express from 'express';
import { orderDB } from '../db.js';

const router = express.Router();

// Create order
router.post('/', async (req, res) => {
  try {
    const order = await orderDB.create(req.body);
    
    const io = req.app.get('io');
    io.to(`restaurant-${order.restaurantId}`).emit('new-order', order);
    
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
