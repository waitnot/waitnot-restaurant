import express from 'express';
import { orderDB } from '../db.js';

const router = express.Router();

// In-memory rate limiter: max 1 order per session per 60 seconds
const orderRateLimit = new Map(); // key: sessionKey, value: timestamp

const checkOrderRateLimit = (req, res, next) => {
  // Build key from restaurantId + tableNumber/roomNumber + IP
  const { restaurantId, tableNumber, roomNumber, isQrOrder } = req.body;
  if (!isQrOrder) return next(); // Only limit QR/customer orders

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  const slot = roomNumber ? `room_${roomNumber}` : (tableNumber || 'notbl');
  const key = `${restaurantId}_${slot}_${ip}`;
  const now = Date.now();
  const LIMIT_MS = 60 * 1000; // 60 seconds

  const last = orderRateLimit.get(key);
  if (last && now - last < LIMIT_MS) {
    const waitSecs = Math.ceil((LIMIT_MS - (now - last)) / 1000);
    return res.status(429).json({
      error: `Order already placed recently. Please wait ${waitSecs} seconds before placing another order.`,
      retryAfter: waitSecs
    });
  }

  orderRateLimit.set(key, now);

  // Clean up old entries every 200 requests
  if (orderRateLimit.size > 200) {
    for (const [k, t] of orderRateLimit.entries()) {
      if (now - t > LIMIT_MS) orderRateLimit.delete(k);
    }
  }

  next();
};

// Create order
router.post('/', checkOrderRateLimit, async (req, res) => {
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
        // Notify the specific restaurant
        io.to(`restaurant-${order.restaurantId}`).emit('new-order', order);
        // Notify all admins
        io.to('admin-room').emit('new-order', order);
        console.log('📡 Real-time notification sent to restaurant and admin');
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
    const { status } = req.query;
    const orders = await orderDB.findByRestaurant(req.params.restaurantId, status);
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
    // Notify the specific restaurant
    io.to(`restaurant-${order.restaurantId}`).emit('order-updated', order);
    // Notify all admins
    io.to('admin-room').emit('order-updated', order);
    
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
      items: req.body.items,
      totalAmount: req.body.totalAmount
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    const io = req.app.get('io');
    io.to(`restaurant-${order.restaurantId}`).emit('order-updated', order);
    io.to('admin-room').emit('order-updated', order);
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update complete order (for staff order editing)
router.put('/:id', async (req, res) => {
  try {
    const { customerName, customerPhone, orderType, deliveryAddress, tableNumber, roomNumber, items, totalAmount, specialInstructions } = req.body;

    const order = await orderDB.update(req.params.id, {
      customerName,
      customerPhone,
      orderType,
      deliveryAddress,
      tableNumber,
      roomNumber,
      items,
      totalAmount,
      specialInstructions
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant-${order.restaurantId}`).emit('order-updated', order);
      io.to('admin-room').emit('order-updated', order);
    }

    res.json(order);
  } catch (error) {
    console.error('❌ Order update failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch update orders (e.g., clearing a table)
router.post('/batch-update', async (req, res) => {
  try {
    const { orderIds, status, paymentMethod, paymentSubType, utrNumber, paymentStatus } = req.body;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'Order IDs array is required' });
    }

    console.log('🔄 Batch updating orders:', orderIds.length);
    
    const updateData = {};
    if (status) updateData.status = status;
    if (paymentMethod) updateData.payment_method = paymentMethod;
    if (paymentStatus) updateData.payment_status = paymentStatus;
    if (paymentSubType) updateData.payment_sub_type = paymentSubType;
    if (utrNumber) updateData.utr_number = utrNumber;
    
    await orderDB.batchUpdate(orderIds, updateData);

    // Emit socket updates for each order (optimized)
    const io = req.app.get('io');
    if (io) {
      // Just fetch the first order to get the restaurantId, assuming all orders belong to the same restaurant
      const firstOrder = await orderDB.findById(orderIds[0]);
      if (firstOrder) {
        // Emit a single 'orders-updated' event for efficiency
        io.to(`restaurant-${firstOrder.restaurantId}`).emit('orders-updated', { orderIds, updateData });
        io.to('admin-room').emit('orders-updated', { orderIds, updateData });
      }
    }

    res.json({ success: true, count: orderIds.length });
  } catch (error) {
    console.error('❌ Batch update failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Merge multiple orders into one combined completed order, delete originals
router.post('/merge-and-complete', async (req, res) => {
  try {
    const { orderIds, paymentMethod, paymentSubType, utrNumber, restaurantId, tableNumber, roomNumber, orderType, customerName } = req.body;

    if (!orderIds || orderIds.length === 0) {
      return res.status(400).json({ error: 'orderIds required' });
    }

    // If only one order, just do a regular batch-update
    if (orderIds.length === 1) {
      await orderDB.batchUpdate(orderIds, {
        status: 'completed',
        payment_method: paymentMethod || 'cash',
        payment_status: 'paid',
        ...(paymentSubType && { payment_sub_type: paymentSubType }),
        ...(utrNumber && { utr_number: utrNumber }),
      });
      const updated = await orderDB.findById(orderIds[0]);
      const io = req.app.get('io');
      if (io && updated) {
        io.to(`restaurant-${updated.restaurantId}`).emit('order-updated', updated);
        io.to('admin-room').emit('order-updated', updated);
      }
      return res.json({ success: true, merged: false, orderId: orderIds[0] });
    }

    // Fetch all orders
    const orders = await Promise.all(orderIds.map(id => orderDB.findById(id)));
    const validOrders = orders.filter(Boolean);

    // Merge all items, combining duplicates by name
    const itemMap = {};
    let totalAmount = 0;
    validOrders.forEach(order => {
      totalAmount += parseFloat(order.totalAmount || 0);
      (order.items || []).forEach(item => {
        if (itemMap[item.name]) {
          itemMap[item.name].quantity += item.quantity;
        } else {
          itemMap[item.name] = { ...item };
        }
      });
    });
    const mergedItems = Object.values(itemMap);

    // Create the merged completed order
    const mergedOrder = await orderDB.create({
      restaurantId,
      tableNumber: tableNumber || validOrders[0]?.tableNumber,
      roomNumber: roomNumber || validOrders[0]?.roomNumber,
      orderType: orderType || validOrders[0]?.orderType || 'dine-in',
      customerName: customerName || validOrders[0]?.customerName,
      items: mergedItems.map(i => ({ menuItemId: i._id || i.menuItemId, name: i.name, price: i.price, quantity: i.quantity })),
      totalAmount,
      status: 'completed',
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: 'paid',
      paymentSubType: paymentSubType || null,
      utrNumber: utrNumber || null,
      source: 'staff',
    });

    // Delete the original orders
    await orderDB.deleteMultiple(orderIds);

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant-${restaurantId}`).emit('orders-merged', { orderIds, mergedOrder });
      io.to('admin-room').emit('orders-merged', { orderIds, mergedOrder });
    }

    res.json({ success: true, merged: true, order: mergedOrder });
  } catch (error) {
    console.error('❌ Merge and complete failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a single order by ID
router.delete('/:id', async (req, res) => {
  try {
    const order = await orderDB.delete(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const io = req.app.get('io');
    if (io) {
      // DB returns snake_case — use restaurant_id directly
      const restaurantId = order.restaurant_id || order.restaurantId;
      io.to(`restaurant-${restaurantId}`).emit('order-deleted', { orderId: req.params.id });
      io.to('admin-room').emit('order-deleted', { orderId: req.params.id });
    }

    res.json({ success: true, orderId: req.params.id });
  } catch (error) {
    console.error('❌ Order delete failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
