import express from 'express';
import { restaurantDB } from '../db.js';

const router = express.Router();

// Search restaurants
router.get('/search', async (req, res) => {
  try {
    const { q, delivery } = req.query;
    let restaurants = await restaurantDB.search(q);
    
    if (delivery === 'true') {
      restaurants = restaurants.filter(r => r.isDeliveryAvailable);
    }
    
    // Remove password from response
    restaurants = restaurants.map(r => {
      const { password, ...rest } = r;
      return rest;
    });
    
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all restaurants
router.get('/', async (req, res) => {
  try {
    let restaurants = await restaurantDB.findAll();
    restaurants = restaurants.map(r => {
      const { password, ...rest } = r;
      return rest;
    });
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update table count (MUST be before GET /:id)
router.patch('/:id/tables', async (req, res) => {
  try {
    console.log('Updating table count for restaurant:', req.params.id);
    console.log('Request body:', req.body);
    
    const { tables } = req.body;
    
    if (typeof tables !== 'number' || tables < 0) {
      console.log('Invalid table count:', tables);
      return res.status(400).json({ error: 'Invalid table count' });
    }
    
    const restaurant = await restaurantDB.update(req.params.id, { tables });
    if (!restaurant) {
      console.log('Restaurant not found:', req.params.id);
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    console.log('Table count updated successfully:', restaurant.tables);
    
    const { password, ...rest } = restaurant;
    res.json(rest);
  } catch (error) {
    console.error('Error updating table count:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update restaurant profile
router.put('/:id', async (req, res) => {
  try {
    console.log('Updating restaurant profile:', req.params.id);
    console.log('Update data:', req.body);
    
    const restaurant = await restaurantDB.update(req.params.id, req.body);
    if (!restaurant) {
      console.log('Restaurant not found:', req.params.id);
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    console.log('Restaurant updated successfully:', restaurant.name);
    
    const { password, ...rest } = restaurant;
    res.json(rest);
  } catch (error) {
    console.error('Error updating restaurant:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get restaurant by ID
router.get('/:id', async (req, res) => {
  try {
    const restaurant = await restaurantDB.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    
    const { password, ...rest } = restaurant;
    res.json(rest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add menu item
router.post('/:id/menu', async (req, res) => {
  try {
    const restaurant = await restaurantDB.addMenuItem(req.params.id, req.body);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update menu item
router.put('/:id/menu/:menuId', async (req, res) => {
  try {
    const restaurant = await restaurantDB.updateMenuItem(req.params.id, req.params.menuId, req.body);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant or menu item not found' });
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete menu item
router.delete('/:id/menu/:menuId', async (req, res) => {
  try {
    console.log('🗑️ Delete menu item request:', req.params.menuId);
    
    const restaurant = await restaurantDB.deleteMenuItem(req.params.id, req.params.menuId);
    if (!restaurant) {
      console.log('❌ Restaurant or menu item not found');
      return res.status(404).json({ error: 'Restaurant or menu item not found' });
    }
    
    // Check if the item was soft deleted (marked as unavailable) or hard deleted
    const deletedItem = restaurant.menu.find(item => item._id === req.params.menuId);
    
    if (deletedItem && !deletedItem.available) {
      console.log('ℹ️ Menu item soft deleted (marked unavailable)');
      res.json({
        ...restaurant,
        message: 'Menu item has been removed from availability. It cannot be permanently deleted because it exists in order history.'
      });
    } else {
      console.log('✅ Menu item permanently deleted');
      res.json({
        ...restaurant,
        message: 'Menu item permanently deleted.'
      });
    }
  } catch (error) {
    console.error('❌ Error deleting menu item:', error);
    
    // Provide user-friendly error messages
    if (error.message.includes('foreign key constraint') || error.message.includes('violates')) {
      res.status(400).json({ 
        error: 'Cannot delete menu item because it exists in order history. The item has been marked as unavailable instead.',
        type: 'constraint_violation'
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

export default router;
