import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { restaurantDB } from '../db.js';

const router = express.Router();

// Restaurant login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const restaurant = await restaurantDB.findOne({ email });
    
    if (!restaurant) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, restaurant.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: restaurant._id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    const { password: _, ...restaurantData } = restaurant;
    res.json({ token, restaurant: restaurantData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restaurant register
router.post('/register', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const restaurant = await restaurantDB.create({
      ...req.body,
      password: hashedPassword
    });
    
    const token = jwt.sign(
      { id: restaurant._id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    const { password: _, ...restaurantData } = restaurant;
    res.status(201).json({ token, restaurant: restaurantData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
