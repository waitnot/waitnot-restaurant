import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { adminDB, restaurantDB } from '../db.js';
import { query } from '../database/connection.js';

const router = express.Router();

// Admin login
router.post('/login', async (req, res) => {
  try {
    console.log('Admin login attempt:', req.body.username || req.body.email);
    
    const { username, email, password } = req.body;
    
    // Find admin by username or email
    const admin = await adminDB.findOne(
      username ? { username } : { email }
    );
    
    if (!admin) {
      console.log('Admin not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('Admin found:', admin.username);
    
    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      console.log('Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: admin._id, role: 'admin' },
      process.env.JWT_SECRET || 'admin_secret',
      { expiresIn: '24h' }
    );
    
    console.log('Admin login successful:', admin.username);
    
    const { password: _, ...adminData } = admin;
    res.json({ token, admin: adminData });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create restaurant (admin only)
router.post('/restaurants', async (req, res) => {
  try {
    console.log('Admin creating restaurant:', req.body.name);
    
    // Verify admin token (basic check - you might want middleware)
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'admin_secret');
      if (decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
    } catch (tokenError) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
    
    // Check if restaurant email already exists
    const existingRestaurant = await restaurantDB.findOne({ email: req.body.email });
    if (existingRestaurant) {
      return res.status(400).json({ error: 'Restaurant with this email already exists' });
    }
    
    const restaurant = await restaurantDB.create(req.body);
    console.log('Restaurant created by admin:', restaurant.name);
    
    const { password: _, ...restaurantData } = restaurant;
    res.status(201).json(restaurantData);
  } catch (error) {
    console.error('Admin restaurant creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all restaurants (admin only)
router.get('/restaurants', async (req, res) => {
  try {
    // Verify admin token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'admin_secret');
      if (decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
    } catch (tokenError) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
    
    const restaurants = await restaurantDB.findAll();
    
    // Remove passwords from response and ensure features are included
    const safeRestaurants = restaurants.map(r => {
      const { password, ...rest } = r;
      return {
        ...rest,
        features: rest.features || {}
      };
    });
    
    console.log('Admin fetching restaurants, count:', safeRestaurants.length);
    if (safeRestaurants.length > 0) {
      console.log('First restaurant features:', safeRestaurants[0].features);
    }
    
    res.json(safeRestaurants);
  } catch (error) {
    console.error('Admin get restaurants error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update restaurant (admin only)
router.put('/restaurants/:id', async (req, res) => {
  try {
    // Verify admin token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'admin_secret');
      if (decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
    } catch (tokenError) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
    
    const restaurant = await restaurantDB.update(req.params.id, req.body);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    const { password: _, ...restaurantData } = restaurant;
    res.json(restaurantData);
  } catch (error) {
    console.error('Admin restaurant update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get restaurant features (admin only)
router.get('/restaurants/:id/features', async (req, res) => {
  try {
    // Verify admin token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'admin_secret');
      if (decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
    } catch (tokenError) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
    
    // Get restaurant features
    const result = await query(`
      SELECT id, name, features
      FROM restaurants 
      WHERE id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    const restaurant = result.rows[0];
    
    res.json({
      id: restaurant.id,
      name: restaurant.name,
      features: restaurant.features || {}
    });
    
  } catch (error) {
    console.error('Admin restaurant features get error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update restaurant features (admin only)
router.put('/restaurants/:id/features', async (req, res) => {
  try {
    // Verify admin token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'admin_secret');
      if (decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
    } catch (tokenError) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
    
    const { features } = req.body;
    
    // Update restaurant features
    const result = await query(`
      UPDATE restaurants 
      SET features = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [JSON.stringify(features), req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    const restaurant = result.rows[0];
    const { password: _, ...restaurantData } = restaurant;
    
    res.json({
      ...restaurantData,
      features: restaurant.features
    });
    
  } catch (error) {
    console.error('Admin restaurant features update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle QR ordering for restaurant (admin only)
router.put('/restaurants/:id/qr-ordering', async (req, res) => {
  try {
    // Verify admin token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'admin_secret');
      if (decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
    } catch (tokenError) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
    
    const { enabled } = req.body;
    
    // Update QR ordering status
    const result = await query(`
      UPDATE restaurants 
      SET features = jsonb_set(features, '{qrOrderingEnabled}', $1::jsonb),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, features->'qrOrderingEnabled' as qr_ordering_enabled
    `, [JSON.stringify(enabled), req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    const restaurant = result.rows[0];
    
    console.log(`Admin ${enabled ? 'enabled' : 'disabled'} QR ordering for restaurant: ${restaurant.name}`);
    
    res.json({
      success: true,
      message: `QR ordering ${enabled ? 'enabled' : 'disabled'} for ${restaurant.name}`,
      restaurantId: restaurant.id,
      qrOrderingEnabled: restaurant.qr_ordering_enabled
    });
    
  } catch (error) {
    console.error('Admin QR ordering toggle error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard stats (admin only)
router.get('/stats', async (req, res) => {
  try {
    // Verify admin token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'admin_secret');
      if (decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
    } catch (tokenError) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
    
    // Get basic stats
    const restaurants = await restaurantDB.findAll();
    const totalRestaurants = restaurants.length;
    const activeRestaurants = restaurants.filter(r => r.isDeliveryAvailable).length;
    
    // You can add more stats here like total orders, revenue, etc.
    
    res.json({
      totalRestaurants,
      activeRestaurants,
      inactiveRestaurants: totalRestaurants - activeRestaurants,
      // Add more stats as needed
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recent orders from all restaurants (admin only)
router.get('/recent-orders', async (req, res) => {
  try {
    // Verify admin token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET || 'admin_secret');
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get recent orders from all restaurants (last 50 orders)
    const result = await query(`
      SELECT o.*, r.name as restaurant_name
      FROM orders o
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      ORDER BY o.created_at DESC
      LIMIT 50
    `);

    const orders = result.rows.map(row => ({
      _id: row.id,
      restaurantId: row.restaurant_id,
      restaurantName: row.restaurant_name,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      tableNumber: row.table_number,
      items: row.items,
      totalAmount: row.total_amount,
      status: row.status,
      orderType: row.order_type,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json(orders);
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;