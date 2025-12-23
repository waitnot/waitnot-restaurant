import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { adminDB, restaurantDB } from '../db.js';

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
    
    // Remove passwords from response
    const safeRestaurants = restaurants.map(r => {
      const { password, ...rest } = r;
      return rest;
    });
    
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

export default router;