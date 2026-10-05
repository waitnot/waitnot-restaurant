import express from 'express';
import { query } from '../database/connection.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware to verify restaurant token
const verifyRestaurantToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.restaurantId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all discounts for a restaurant
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    const result = await query(`
      SELECT d.*, 
             COALESCE(du.total_usage, 0) as current_usage
      FROM discounts d
      LEFT JOIN (
        SELECT discount_id, COUNT(*) as total_usage
        FROM discount_usage
        GROUP BY discount_id
      ) du ON d.id = du.discount_id
      WHERE d.restaurant_id = $1
      ORDER BY d.created_at DESC
    `, [req.params.restaurantId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching discounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get active discounts for QR ordering
router.get('/active/:restaurantId', async (req, res) => {
  try {
    const isQrOrder = req.query.qr === 'true';
    
    const result = await query(`
      SELECT d.*, 
             COALESCE(du.total_usage, 0) as current_usage
      FROM discounts d
      LEFT JOIN (
        SELECT discount_id, COUNT(*) as total_usage
        FROM discount_usage
        GROUP BY discount_id
      ) du ON d.id = du.discount_id
      WHERE d.restaurant_id = $1
        AND d.is_active = true
        AND (d.start_date IS NULL OR d.start_date <= NOW())
        AND (d.end_date IS NULL OR d.end_date >= NOW())
        AND (d.usage_limit IS NULL OR COALESCE(du.total_usage, 0) < d.usage_limit)
        AND ($2 = false OR d.is_qr_exclusive = false OR ($2 = true AND d.is_qr_exclusive = true))
      ORDER BY d.discount_value DESC
    `, [req.params.restaurantId, isQrOrder]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching active discounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get active banner discounts for QR ordering display
router.get('/banners/:restaurantId', async (req, res) => {
  try {
    const result = await query(`
      SELECT d.*, 
             COALESCE(du.total_usage, 0) as current_usage
      FROM discounts d
      LEFT JOIN (
        SELECT discount_id, COUNT(*) as total_usage
        FROM discount_usage
        GROUP BY discount_id
      ) du ON d.id = du.discount_id
      WHERE d.restaurant_id = $1
        AND d.is_active = true
        AND d.show_banner = true
        AND d.banner_image IS NOT NULL
        AND d.banner_image != ''
        AND (d.start_date IS NULL OR d.start_date <= NOW())
        AND (d.end_date IS NULL OR d.end_date >= NOW())
        AND (d.usage_limit IS NULL OR COALESCE(du.total_usage, 0) < d.usage_limit)
      ORDER BY d.created_at DESC
      LIMIT 3
    `, [req.params.restaurantId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching banner discounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new discount
router.post('/', verifyRestaurantToken, async (req, res) => {
  try {
    const {
      name,
      description,
      discount_type,
      discount_value,
      min_order_amount,
      max_discount_amount,
      is_qr_exclusive,
      start_date,
      end_date,
      usage_limit,
      applicable_categories,
      banner_image,
      banner_title,
      banner_subtitle,
      show_banner,
      banner_link_text
    } = req.body;

    const result = await query(`
      INSERT INTO discounts (
        restaurant_id, name, description, discount_type, discount_value,
        min_order_amount, max_discount_amount, is_active, is_qr_exclusive,
        start_date, end_date, usage_limit, applicable_categories,
        banner_image, banner_title, banner_subtitle, show_banner, banner_link_text
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      req.restaurantId, name, description, discount_type, discount_value,
      min_order_amount, max_discount_amount, true, is_qr_exclusive,
      start_date, end_date, usage_limit, applicable_categories,
      banner_image, banner_title, banner_subtitle, show_banner, banner_link_text
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating discount:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update discount
router.put('/:id', verifyRestaurantToken, async (req, res) => {
  try {
    const {
      name,
      description,
      discount_type,
      discount_value,
      min_order_amount,
      max_discount_amount,
      is_active,
      is_qr_exclusive,
      start_date,
      end_date,
      usage_limit,
      applicable_categories,
      banner_image,
      banner_title,
      banner_subtitle,
      show_banner,
      banner_link_text
    } = req.body;

    const result = await query(`
      UPDATE discounts SET
        name = $1,
        description = $2,
        discount_type = $3,
        discount_value = $4,
        min_order_amount = $5,
        max_discount_amount = $6,
        is_active = $7,
        is_qr_exclusive = $8,
        start_date = $9,
        end_date = $10,
        usage_limit = $11,
        applicable_categories = $12,
        banner_image = $13,
        banner_title = $14,
        banner_subtitle = $15,
        show_banner = $16,
        banner_link_text = $17,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $18 AND restaurant_id = $19
      RETURNING *
    `, [
      name, description, discount_type, discount_value,
      min_order_amount, max_discount_amount, is_active, is_qr_exclusive,
      start_date, end_date, usage_limit, applicable_categories,
      banner_image, banner_title, banner_subtitle, show_banner, banner_link_text,
      req.params.id, req.restaurantId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Discount not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating discount:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete discount
router.delete('/:id', verifyRestaurantToken, async (req, res) => {
  try {
    const result = await query(`
      DELETE FROM discounts 
      WHERE id = $1 AND restaurant_id = $2
      RETURNING *
    `, [req.params.id, req.restaurantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Discount not found' });
    }

    res.json({ message: 'Discount deleted successfully' });
  } catch (error) {
    console.error('Error deleting discount:', error);
    res.status(500).json({ error: error.message });
  }
});

// Apply discount to order
router.post('/apply', async (req, res) => {
  try {
    const { discountId, orderAmount, items, isQrOrder } = req.body;

    // Get discount details
    const discountResult = await query(`
      SELECT d.*, COALESCE(du.total_usage, 0) as current_usage
      FROM discounts d
      LEFT JOIN (
        SELECT discount_id, COUNT(*) as total_usage
        FROM discount_usage
        GROUP BY discount_id
      ) du ON d.id = du.discount_id
      WHERE d.id = $1 AND d.is_active = true
    `, [discountId]);

    if (discountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Discount not found or inactive' });
    }

    const discount = discountResult.rows[0];

    // Validate discount conditions
    if (discount.start_date && new Date(discount.start_date) > new Date()) {
      return res.status(400).json({ error: 'Discount not yet active' });
    }

    if (discount.end_date && new Date(discount.end_date) < new Date()) {
      return res.status(400).json({ error: 'Discount has expired' });
    }

    if (discount.usage_limit && discount.current_usage >= discount.usage_limit) {
      return res.status(400).json({ error: 'Discount usage limit reached' });
    }

    if (orderAmount < discount.min_order_amount) {
      return res.status(400).json({ 
        error: `Minimum order amount of ₹${discount.min_order_amount} required` 
      });
    }

    if (discount.is_qr_exclusive && !isQrOrder) {
      return res.status(400).json({ error: 'This discount is exclusive to QR orders' });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discount.discount_type === 'percentage') {
      discountAmount = (orderAmount * discount.discount_value) / 100;
    } else {
      discountAmount = discount.discount_value;
    }

    // Apply maximum discount limit
    if (discount.max_discount_amount && discountAmount > discount.max_discount_amount) {
      discountAmount = discount.max_discount_amount;
    }

    const finalAmount = Math.max(0, orderAmount - discountAmount);

    res.json({
      discount,
      originalAmount: orderAmount,
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalAmount: Math.round(finalAmount * 100) / 100,
      savings: Math.round(discountAmount * 100) / 100
    });

  } catch (error) {
    console.error('Error applying discount:', error);
    res.status(500).json({ error: error.message });
  }
});

// Record discount usage
router.post('/use', async (req, res) => {
  try {
    const { discountId, orderId, customerPhone, discountAmount, originalAmount, finalAmount } = req.body;

    // Record usage
    await query(`
      INSERT INTO discount_usage (
        discount_id, order_id, customer_phone, discount_amount, original_amount, final_amount
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [discountId, orderId, customerPhone, discountAmount, originalAmount, finalAmount]);

    // Update usage count
    await query(`
      UPDATE discounts 
      SET usage_count = usage_count + 1 
      WHERE id = $1
    `, [discountId]);

    res.json({ message: 'Discount usage recorded successfully' });
  } catch (error) {
    console.error('Error recording discount usage:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get discount analytics
router.get('/analytics/:restaurantId', verifyRestaurantToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        d.name,
        d.discount_type,
        d.discount_value,
        COUNT(du.id) as total_uses,
        SUM(du.discount_amount) as total_discount_given,
        SUM(du.original_amount) as total_original_amount,
        SUM(du.final_amount) as total_final_amount,
        AVG(du.discount_amount) as avg_discount_amount
      FROM discounts d
      LEFT JOIN discount_usage du ON d.id = du.discount_id
      WHERE d.restaurant_id = $1
      GROUP BY d.id, d.name, d.discount_type, d.discount_value
      ORDER BY total_uses DESC
    `, [req.params.restaurantId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching discount analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;