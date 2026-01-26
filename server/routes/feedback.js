import express from 'express';
import { feedbackDB } from '../db.js';

const router = express.Router();

// Get all feedback for a restaurant
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    const feedback = await feedbackDB.findByRestaurant(req.params.restaurantId);
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching restaurant feedback:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get feedback statistics for a restaurant
router.get('/restaurant/:restaurantId/stats', async (req, res) => {
  try {
    const stats = await feedbackDB.getStats(req.params.restaurantId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new feedback
router.post('/', async (req, res) => {
  try {
    console.log('📝 Feedback submission request received');
    console.log('Feedback data:', JSON.stringify(req.body, null, 2));
    
    // Validate required fields
    const { restaurantId, customerName, rating, feedbackText } = req.body;
    
    if (!restaurantId) {
      console.log('❌ Missing restaurantId');
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }
    
    if (!customerName) {
      console.log('❌ Missing customerName');
      return res.status(400).json({ error: 'Customer name is required' });
    }
    
    if (!rating || rating < 1 || rating > 5) {
      console.log('❌ Invalid rating');
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    if (!feedbackText || feedbackText.trim().length === 0) {
      console.log('❌ Missing feedback text');
      return res.status(400).json({ error: 'Feedback text is required' });
    }
    
    console.log('✅ Feedback validation passed, creating feedback...');
    
    const feedback = await feedbackDB.create(req.body);
    
    console.log('✅ Feedback created successfully:', feedback._id);
    
    // Send real-time notification to restaurant
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`restaurant-${feedback.restaurantId}`).emit('new-feedback', feedback);
        console.log('📡 Real-time feedback notification sent to restaurant');
      }
    } catch (socketError) {
      console.log('⚠️ Socket notification failed:', socketError.message);
      // Don't fail the feedback creation if socket fails
    }
    
    res.status(201).json(feedback);
  } catch (error) {
    console.error('❌ Feedback creation failed:', error);
    console.error('Error stack:', error.stack);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to submit feedback';
    
    if (error.message.includes('connect')) {
      errorMessage = 'Database connection error. Please try again.';
    } else if (error.message.includes('violates')) {
      errorMessage = 'Invalid feedback data. Please check your input.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout. Please try again.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update feedback (restaurant response)
router.patch('/:id/response', async (req, res) => {
  try {
    const { restaurantResponse } = req.body;
    
    if (!restaurantResponse || restaurantResponse.trim().length === 0) {
      return res.status(400).json({ error: 'Restaurant response is required' });
    }
    
    const feedback = await feedbackDB.update(req.params.id, {
      restaurantResponse: restaurantResponse.trim(),
      status: 'responded'
    });
    
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    
    // Send real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant-${feedback.restaurantId}`).emit('feedback-updated', feedback);
    }
    
    res.json(feedback);
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update feedback status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'archived', 'responded'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const feedback = await feedbackDB.update(req.params.id, { status });
    
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    
    // Send real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant-${feedback.restaurantId}`).emit('feedback-updated', feedback);
    }
    
    res.json(feedback);
  } catch (error) {
    console.error('Error updating feedback status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single feedback by ID
router.get('/:id', async (req, res) => {
  try {
    const feedback = await feedbackDB.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;