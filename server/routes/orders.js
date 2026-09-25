import express from 'express';
import { getRestaurantFcmTokens } from '../routes/devices.js';
import { sendPushNotification } from '../fcm.js';
import { orderDB } from '../db.js';
import { query, withTransaction } from '../database/connection.js';

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
        io.to(`restaurant-${order.restaurantId}`).emit('new-order', order);
        io.to('admin-room').emit('new-order', order);
        // Signal the print-server device to print KOT
        io.to(`restaurant-${order.restaurantId}`).emit('print-kot', { order });
        console.log('📡 Real-time notification sent to restaurant and admin');

        // Send FCM push to all staff devices (works when app is closed)
        getRestaurantFcmTokens(order.restaurantId).then(tokens => {
          if (tokens.length === 0) return;
          const slot = order.orderType === 'room' ? `Room ${order.roomNumber}`
            : order.tableNumber ? `Table ${order.tableNumber}`
            : order.orderType === 'takeaway' ? 'Takeaway'
            : order.orderType === 'delivery' ? 'Delivery' : 'New Order';
          const itemCount = (order.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
          const itemNames = (order.items || []).slice(0, 2).map(i => i.name).join(', ');
          sendPushNotification(tokens, {
            title: `🍽 New Order — ${slot}`,
            body: `${itemCount} item${itemCount !== 1 ? 's' : ''}: ${itemNames}`,
            data: {
              orderId: order._id || '',
              restaurantId: order.restaurantId || '',
              tableInfo: `Rs. ${order.totalAmount || 0}`,
              type: 'new_order',
            }
          });
        }).catch(() => {});
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

    // Single order — just batch-update, no merge needed
    if (orderIds.length === 1) {
      await orderDB.batchUpdate(orderIds, {
        status: 'completed',
        payment_method: paymentMethod || 'cash',
        payment_status: 'paid',
        ...(paymentSubType ? { payment_sub_type: paymentSubType } : {}),
        ...(utrNumber ? { utr_number: utrNumber } : {}),
      });
      const io = req.app.get('io');
      if (io) {
        io.to(`restaurant-${restaurantId}`).emit('orders-updated', { orderIds, updateData: { status: 'completed' } });
        io.to('admin-room').emit('orders-updated', { orderIds, updateData: { status: 'completed' } });
      }
      return res.json({ success: true, merged: false });
    }

    // Multiple orders — merge into one in a single transaction
    const mergedOrder = await withTransaction(async (client) => {
      // Fetch all order items
      const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(',');
      const itemsResult = await client.query(
        `SELECT oi.name, oi.price, oi.quantity, oi.menu_item_id
         FROM order_items oi
         WHERE oi.order_id IN (${placeholders})`,
        orderIds
      );

      // Merge items, combining duplicates by name
      const itemMap = {};
      let totalAmount = 0;
      itemsResult.rows.forEach(row => {
        const key = row.name;
        if (itemMap[key]) {
          itemMap[key].quantity += row.quantity;
        } else {
          itemMap[key] = { name: row.name, price: parseFloat(row.price), quantity: row.quantity, menuItemId: row.menu_item_id };
        }
        totalAmount += parseFloat(row.price) * row.quantity;
      });
      const mergedItems = Object.values(itemMap);

      // Get next order number
      const numResult = await client.query(
        `SELECT COALESCE(MAX(order_number), 0) + 1 AS next_num FROM orders WHERE restaurant_id = $1`,
        [restaurantId]
      );
      const orderNumber = numResult.rows[0].next_num;

      // Insert merged order
      const orderResult = await client.query(`
        INSERT INTO orders (
          restaurant_id, order_number, table_number, room_number, customer_name,
          order_type, status, payment_method, payment_status, total_amount,
          source, payment_sub_type, utr_number
        ) VALUES ($1,$2,$3,$4,$5,$6,'completed',$7,'paid',$8,'staff',$9,$10)
        RETURNING *
      `, [
        restaurantId,
        orderNumber,
        tableNumber || null,
        roomNumber || null,
        customerName || null,
        orderType || 'dine-in',
        paymentMethod || 'cash',
        totalAmount,
        paymentSubType || null,
        utrNumber || null,
      ]);

      const newOrder = orderResult.rows[0];

      // Insert merged items
      if (mergedItems.length > 0) {
        const itemPlaceholders = mergedItems.map((_, i) => {
          const o = i * 5;
          return `($${o+1},$${o+2},$${o+3},$${o+4},$${o+5})`;
        }).join(',');
        const itemValues = [];
        mergedItems.forEach(item => {
          itemValues.push(newOrder.id, item.menuItemId || null, item.name, item.price, item.quantity);
        });
        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, name, price, quantity) VALUES ${itemPlaceholders}`,
          itemValues
        );
      }

      // Delete original order items and orders
      await client.query(`DELETE FROM order_items WHERE order_id IN (${placeholders})`, orderIds);
      await client.query(`DELETE FROM orders WHERE id IN (${placeholders})`, orderIds);

      return { ...newOrder, items: mergedItems };
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant-${restaurantId}`).emit('orders-merged', { orderIds, mergedOrder });
      io.to('admin-room').emit('orders-merged', { orderIds, mergedOrder });
      // Signal print-server device to print Bill
      io.to(`restaurant-${restaurantId}`).emit('print-bill', { order: mergedOrder, orders: [mergedOrder] });
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
