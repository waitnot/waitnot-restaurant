/**
 * Kitchen Display System — API Routes
 *
 * Reuses existing order statuses: pending → preparing → ready → completed
 * Reuses existing staff JWT auth from staff.js
 * Does NOT change invoice numbers, payment records, or analytics
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../database/connection.js';
import { orderDB } from '../db.js';

const router = express.Router();

// ─── Auth middleware (mirrors staff.js verifyStaffToken) ─────────────────────
const verifyKitchenStaff = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    const sessionResult = await query(
      'SELECT * FROM staff_sessions WHERE session_token = $1 AND expires_at > NOW()',
      [token]
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired' });

    const staffResult = await query(
      'SELECT * FROM staff WHERE id = $1 AND is_active = true',
      [decoded.staffId]
    );
    if (staffResult.rows.length === 0) return res.status(401).json({ error: 'Staff not found' });

    const staff = staffResult.rows[0];

    // Kitchen and manager roles can access KDS
    if (staff.role !== 'kitchen' && staff.role !== 'manager') {
      return res.status(403).json({ error: 'Kitchen or manager role required' });
    }

    req.staff = staff;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── Valid status transitions ─────────────────────────────────────────────────
const ALLOWED_TRANSITIONS = {
  pending:    ['preparing'],
  preparing:  ['ready'],
  ready:      ['completed'],
  completed:  [], // terminal from kitchen perspective
};

// ─── GET /api/kitchen/orders/:restaurantId ────────────────────────────────────
// Returns active kitchen orders (pending + preparing + ready)
// Also accepts ?status=pending|preparing|ready|completed for tab filtering
// Completed is bounded to last 30 for display
router.get('/orders/:restaurantId', verifyKitchenStaff, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { status } = req.query;

    // Restaurant isolation: staff must belong to this restaurant
    if (String(req.staff.restaurant_id) !== String(restaurantId)) {
      return res.status(403).json({ error: 'Access denied to this restaurant' });
    }

    let statusFilter;
    let limitClause = '';

    if (status === 'completed') {
      statusFilter = `o.status = 'completed'`;
      limitClause = 'LIMIT 30';
    } else if (status && ALLOWED_TRANSITIONS[status] !== undefined) {
      statusFilter = `o.status = '${status}'`;
    } else {
      // Default: all active kitchen statuses
      statusFilter = `o.status IN ('pending', 'preparing', 'ready')`;
    }

    const result = await query(`
      SELECT o.*,
        COALESCE(
          json_agg(
            json_build_object(
              '_id', oi.id,
              'name', oi.name,
              'price', oi.price,
              'quantity', oi.quantity,
              'printed_to_kitchen', oi.printed_to_kitchen
            ) ORDER BY oi.created_at
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.restaurant_id = $1
        AND (o.archived IS NULL OR o.archived = false)
        AND o.status != 'cancelled'
        AND ${statusFilter}
      GROUP BY o.id
      ORDER BY o.created_at ASC
      ${limitClause}
    `, [restaurantId]);

    const orders = result.rows.map(row => ({
      _id:           row.id,
      restaurantId:  row.restaurant_id,
      orderNumber:   row.order_number,
      invoiceNumber: row.invoice_number,
      tableNumber:   row.table_number,
      roomNumber:    row.room_number,
      customerName:  row.customer_name,
      orderType:     row.order_type,
      status:        row.status,
      source:        row.source,
      specialInstructions: row.special_instructions,
      items:         row.items || [],
      totalAmount:   parseFloat(row.total_amount),
      createdAt:     row.created_at,
      updatedAt:     row.updated_at,
    }));

    res.json(orders);
  } catch (error) {
    console.error('KDS GET orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── PATCH /api/kitchen/orders/:orderId/status ────────────────────────────────
// Validated status transition — persists first, then broadcasts
router.patch('/orders/:orderId/status', verifyKitchenStaff, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status: newStatus, restaurantId } = req.body;

    // Restaurant isolation
    if (String(req.staff.restaurant_id) !== String(restaurantId)) {
      return res.status(403).json({ error: 'Access denied to this restaurant' });
    }

    // Fetch current order
    const currentResult = await query(
      `SELECT id, status, restaurant_id FROM orders WHERE id = $1 AND (archived IS NULL OR archived = false)`,
      [orderId]
    );
    if (currentResult.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const current = currentResult.rows[0];

    // Verify order belongs to same restaurant
    if (String(current.restaurant_id) !== String(restaurantId)) {
      return res.status(403).json({ error: 'Order does not belong to this restaurant' });
    }

    // Validate transition
    const allowed = ALLOWED_TRANSITIONS[current.status] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        error: `Invalid transition: ${current.status} → ${newStatus}`,
        allowed,
      });
    }

    // Persist
    const updated = await orderDB.update(orderId, { status: newStatus });
    if (!updated) return res.status(404).json({ error: 'Order not found after update' });

    // Broadcast via existing socket infrastructure
    const io = req.app.get('io');
    if (io) {
      // Reuse existing order-updated event (RestaurantDashboard already listens)
      io.to(`restaurant-${restaurantId}`).emit('order-updated', updated);
      // New KDS-specific event for targeted kitchen sync
      io.to(`restaurant-${restaurantId}`).emit('kitchen-status-update', {
        orderId,
        status:      newStatus,
        restaurantId,
        updatedAt:   updated.updatedAt,
      });
      io.to('admin-room').emit('order-updated', updated);
    }

    res.json(updated);
  } catch (error) {
    console.error('KDS PATCH status error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
