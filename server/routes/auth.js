import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { restaurantDB } from '../db.js';

const router = express.Router();

// Change password
router.post('/change-password', async (req, res) => {
  try {
    console.log('Password change request received');
    
    const { restaurantId, currentPassword, newPassword } = req.body;
    
    if (!restaurantId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }
    
    // Get restaurant
    const restaurant = await restaurantDB.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    console.log('Verifying current password for restaurant:', restaurant.name);
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, restaurant.password);
    if (!isCurrentPasswordValid) {
      console.log('Current password verification failed');
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    console.log('Current password verified, updating to new password');
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    const updatedRestaurant = await restaurantDB.update(restaurantId, { 
      password: hashedNewPassword 
    });
    
    if (updatedRestaurant) {
      console.log('Password updated successfully for:', restaurant.name);
      res.json({ message: 'Password changed successfully' });
    } else {
      res.status(500).json({ error: 'Failed to update password' });
    }
    
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check database contents
router.get('/debug', async (req, res) => {
  try {
    const restaurants = await restaurantDB.findAll();
    console.log('Debug: Found restaurants:', restaurants.length);
    
    const restaurantsWithoutPasswords = restaurants.map(r => ({
      _id: r._id,
      name: r.name,
      email: r.email,
      hasPassword: !!r.password,
      passwordLength: r.password ? r.password.length : 0,
      createdAt: r.createdAt
    }));
    
    res.json({
      count: restaurants.length,
      restaurants: restaurantsWithoutPasswords
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restaurant login
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt for email:', req.body.email);
    
    const { email, password } = req.body;
    const restaurant = await restaurantDB.findOne({ email });
    
    console.log('Restaurant found:', !!restaurant);
    if (restaurant) {
      console.log('Restaurant details:', {
        id: restaurant._id,
        name: restaurant.name,
        email: restaurant.email,
        hasPassword: !!restaurant.password
      });
    }
    
    if (!restaurant) {
      console.log('No restaurant found with email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('Comparing passwords...');
    const isValid = await bcrypt.compare(password, restaurant.password);
    console.log('Password valid:', isValid);
    
    if (!isValid) {
      console.log('Password comparison failed');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: restaurant._id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    console.log('Login successful for:', restaurant.name);
    const { password: _, ...restaurantData } = restaurant;
    res.json({ token, restaurant: restaurantData });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restaurant register
router.post('/register', async (req, res) => {
  try {
    console.log('Registration attempt for email:', req.body.email);
    
    // Check if restaurant already exists
    const existingRestaurant = await restaurantDB.findOne({ email: req.body.email });
    if (existingRestaurant) {
      console.log('Restaurant already exists with email:', req.body.email);
      return res.status(400).json({ error: 'Restaurant already exists with this email' });
    }
    
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    console.log('Password hashed, creating restaurant...');
    
    const restaurant = await restaurantDB.create({
      ...req.body,
      password: hashedPassword
    });
    
    console.log('Restaurant created successfully:', restaurant.name);
    
    const token = jwt.sign(
      { id: restaurant._id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    const { password: _, ...restaurantData } = restaurant;
    res.status(201).json({ token, restaurant: restaurantData });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
