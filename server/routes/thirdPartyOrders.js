import express from 'express';
import { orderDB } from '../db.js';

const router = express.Router();

// Create third-party order (Swiggy/Zomato)
router.post('/', async (req, res) => {
  try {
    console.log('📱 Third-party order creation request received');
    console.log('Order data:', JSON.stringify(req.body, null, 2));
    
    const {
      restaurantId,
      platform, // 'swiggy', 'zomato', 'uber-eats', etc.
      platformOrderId,
      customerName,
      customerPhone,
      items,
      totalAmount,
      deliveryAddress,
      specialInstructions,
      platformFee,
      commissionRate,
      estimatedDeliveryTime,
      orderType = 'delivery'
    } = req.body;
    
    // Validate required fields
    if (!restaurantId || !platform || !platformOrderId || !customerName || !items || !totalAmount) {
      return res.status(400).json({ 
        error: 'Missing required fields: restaurantId, platform, platformOrderId, customerName, items, totalAmount' 
      });
    }
    
    // Calculate net amount after platform commission
    const commission = commissionRate ? (totalAmount * commissionRate / 100) : 0;
    const netAmount = totalAmount - commission - (platformFee || 0);
    
    // Create order data
    const orderData = {
      restaurantId,
      customerName,
      customerPhone: customerPhone || 'Not provided',
      deliveryAddress: deliveryAddress || '',
      orderType,
      items: items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        menuItemId: item.menuItemId || null
      })),
      totalAmount,
      specialInstructions: specialInstructions || '',
      source: platform.toLowerCase(), // 'swiggy', 'zomato', etc.
      status: 'pending',
      paymentStatus: 'paid', // Third-party orders are usually pre-paid
      paymentMethod: 'online',
      platformOrderId,
      platformFee: platformFee || 0,
      commission,
      commissionRate: commissionRate || 0,
      netAmount,
      estimatedDeliveryTime: estimatedDeliveryTime || null
    };
    
    console.log('✅ Creating third-party order...');
    const order = await orderDB.create(orderData);
    
    // Send real-time notification to restaurant
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant-${restaurantId}`).emit('new-order', order);
      console.log('📡 Real-time notification sent to restaurant');
    }
    
    console.log('✅ Third-party order created successfully:', order._id);
    
    res.status(201).json({
      success: true,
      order,
      message: `${platform.charAt(0).toUpperCase() + platform.slice(1)} order created successfully`
    });
    
  } catch (error) {
    console.error('❌ Third-party order creation failed:', error);
    res.status(500).json({ 
      error: 'Failed to create third-party order',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get third-party orders for a restaurant
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { platform, status, startDate, endDate } = req.query;
    
    let orders = await orderDB.findByRestaurant(restaurantId);
    
    // Filter third-party orders
    const thirdPartyPlatforms = ['swiggy', 'zomato', 'uber-eats', 'foodpanda'];
    orders = orders.filter(order => thirdPartyPlatforms.includes(order.source));
    
    // Apply filters
    if (platform) {
      orders = orders.filter(order => order.source === platform.toLowerCase());
    }
    
    if (status) {
      orders = orders.filter(order => order.status === status);
    }
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      orders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= start && orderDate <= end;
      });
    }
    
    // Calculate analytics
    const analytics = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
      totalCommission: orders.reduce((sum, order) => sum + (order.commission || 0), 0),
      netRevenue: orders.reduce((sum, order) => sum + (order.netAmount || order.totalAmount), 0),
      platformBreakdown: {}
    };
    
    // Platform-wise breakdown
    thirdPartyPlatforms.forEach(platform => {
      const platformOrders = orders.filter(order => order.source === platform);
      analytics.platformBreakdown[platform] = {
        orders: platformOrders.length,
        revenue: platformOrders.reduce((sum, order) => sum + order.totalAmount, 0),
        commission: platformOrders.reduce((sum, order) => sum + (order.commission || 0), 0),
        netRevenue: platformOrders.reduce((sum, order) => sum + (order.netAmount || order.totalAmount), 0)
      };
    });
    
    res.json({
      orders,
      analytics
    });
    
  } catch (error) {
    console.error('Error fetching third-party orders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update third-party order status
router.patch('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'picked-up', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        validStatuses 
      });
    }
    
    const order = await orderDB.update(orderId, { status });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Send real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant-${order.restaurantId}`).emit('order-updated', order);
    }
    
    res.json({
      success: true,
      order,
      message: `Order status updated to ${status}`
    });
    
  } catch (error) {
    console.error('Error updating third-party order status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoint for Swiggy orders
router.post('/webhook/swiggy', async (req, res) => {
  try {
    console.log('📱 Swiggy webhook received:', req.body);
    
    // Verify webhook signature (implement based on Swiggy's documentation)
    // const signature = req.headers['x-swiggy-signature'];
    // if (!verifySwiggySignature(req.body, signature)) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }
    
    const swiggyOrder = req.body;
    
    // Transform Swiggy order format to our format
    const orderData = {
      restaurantId: swiggyOrder.restaurant_id, // You'll need to map this
      platform: 'swiggy',
      platformOrderId: swiggyOrder.order_id,
      customerName: swiggyOrder.customer.name,
      customerPhone: swiggyOrder.customer.phone,
      deliveryAddress: swiggyOrder.delivery_address,
      items: swiggyOrder.items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      totalAmount: swiggyOrder.total_amount,
      platformFee: swiggyOrder.platform_fee,
      commissionRate: swiggyOrder.commission_rate,
      estimatedDeliveryTime: swiggyOrder.estimated_delivery_time,
      specialInstructions: swiggyOrder.special_instructions
    };
    
    // Create order
    const order = await orderDB.create(orderData);
    
    // Send notification
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant-${orderData.restaurantId}`).emit('new-order', order);
    }
    
    res.json({ success: true, orderId: order._id });
    
  } catch (error) {
    console.error('Swiggy webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Webhook endpoint for Zomato orders
router.post('/webhook/zomato', async (req, res) => {
  try {
    console.log('📱 Zomato webhook received:', req.body);
    
    // Verify webhook signature (implement based on Zomato's documentation)
    // const signature = req.headers['x-zomato-signature'];
    // if (!verifyZomatoSignature(req.body, signature)) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }
    
    const zomatoOrder = req.body;
    
    // Transform Zomato order format to our format
    const orderData = {
      restaurantId: zomatoOrder.restaurant_id, // You'll need to map this
      platform: 'zomato',
      platformOrderId: zomatoOrder.order_id,
      customerName: zomatoOrder.customer.name,
      customerPhone: zomatoOrder.customer.phone,
      deliveryAddress: zomatoOrder.delivery_address,
      items: zomatoOrder.items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      totalAmount: zomatoOrder.total_amount,
      platformFee: zomatoOrder.platform_fee,
      commissionRate: zomatoOrder.commission_rate,
      estimatedDeliveryTime: zomatoOrder.estimated_delivery_time,
      specialInstructions: zomatoOrder.special_instructions
    };
    
    // Create order
    const order = await orderDB.create(orderData);
    
    // Send notification
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant-${orderData.restaurantId}`).emit('new-order', order);
    }
    
    res.json({ success: true, orderId: order._id });
    
  } catch (error) {
    console.error('Zomato webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;