import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../database/connection.js';

const router = express.Router();

// Staff roles and permissions
const STAFF_ROLES = {
  manager: {
    name: 'Manager',
    permissions: {
      orders: { view: true, edit: true, delete: true },
      menu: { view: true, edit: true, delete: true },
      staff: { view: true, edit: true, delete: true },
      analytics: { view: true },
      settings: { view: true, edit: true }
    }
  },
  waiter: {
    name: 'Waiter',
    permissions: {
      orders: { view: true, edit: true, delete: false },
      menu: { view: true, edit: false, delete: false },
      staff: { view: false, edit: false, delete: false },
      settings: { view: false, edit: false }
    }
  },
  kitchen: {
    name: 'Kitchen Staff',
    permissions: {
      orders: { view: true, edit: true, delete: false },
      menu: { view: true, edit: false, delete: false },
      staff: { view: false, edit: false, delete: false },
      analytics: { view: false },
      settings: { view: false, edit: false }
    }
  }
};

// Middleware to verify staff token
const verifyStaffToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if session is still valid
    const sessionResult = await query(
      'SELECT * FROM staff_sessions WHERE session_token = $1 AND expires_at > NOW()',
      [token]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired' });
    }
    
    // Get staff details
    const staffResult = await query(
      'SELECT * FROM staff WHERE id = $1 AND is_active = true',
      [decoded.staffId]
    );
    
    if (staffResult.rows.length === 0) {
      return res.status(401).json({ error: 'Staff not found or inactive' });
    }
    
    req.staff = staffResult.rows[0];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Check permissions middleware
const checkPermission = (resource, action) => {
  return (req, res, next) => {
    const staff = req.staff;
    const rolePermissions = STAFF_ROLES[staff.role]?.permissions || {};
    const resourcePermissions = rolePermissions[resource] || {};
    
    if (!resourcePermissions[action]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

// Log staff activity
const logActivity = async (staffId, restaurantId, action, details = {}) => {
  try {
    await query(
      'INSERT INTO staff_activity_logs (staff_id, restaurant_id, action, details) VALUES ($1, $2, $3, $4)',
      [staffId, restaurantId, action, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

// Get all staff for a restaurant (no auth required for restaurant owners)
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    const result = await query(`
      SELECT 
        id, 
        name, 
        email, 
        phone, 
        role, 
        permissions,
        waiter_number,
        is_active,
        created_at,
        updated_at
      FROM staff 
      WHERE restaurant_id = $1 
      ORDER BY created_at DESC
    `, [restaurantId]);
    
    // Add role details
    const staffWithRoles = result.rows.map(staff => ({
      ...staff,
      roleDetails: STAFF_ROLES[staff.role] || null
    }));
    
    res.json(staffWithRoles);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Add new staff member (no auth required for restaurant owners)
router.post('/', async (req, res) => {
  try {
    const { restaurantId, name, email, phone, password, role } = req.body;
    
    // Validate required fields
    if (!restaurantId || !name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate role
    if (!STAFF_ROLES[role]) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Check if email already exists
    const existingStaff = await query(
      'SELECT id FROM staff WHERE email = $1',
      [email]
    );
    
    if (existingStaff.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Get role permissions
    const permissions = STAFF_ROLES[role].permissions;
    
    // Generate waiter number if role is waiter
    let waiterNumber = null;
    if (role === 'waiter') {
      // Get count of existing waiters for this restaurant
      const waiterCount = await query(
        'SELECT COUNT(*) FROM staff WHERE restaurant_id = $1 AND role = $2',
        [restaurantId, 'waiter']
      );
      const nextNumber = parseInt(waiterCount.rows[0].count) + 1;
      waiterNumber = `W${String(nextNumber).padStart(2, '0')}`;
    }
    
    // Insert new staff member
    const result = await query(`
      INSERT INTO staff (restaurant_id, name, email, phone, password, role, permissions, waiter_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, email, phone, role, permissions, waiter_number, is_active, created_at
    `, [restaurantId, name, email, phone, hashedPassword, role, JSON.stringify(permissions), waiterNumber]);
    
    const newStaff = result.rows[0];
    
    res.status(201).json({
      ...newStaff,
      roleDetails: STAFF_ROLES[role]
    });
  } catch (error) {
    console.error('Error adding staff:', error);
    res.status(500).json({ error: 'Failed to add staff member' });
  }
});

// Staff login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find staff member
    const result = await query(
      'SELECT * FROM staff WHERE email = $1 AND is_active = true',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const staff = result.rows[0];
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, staff.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { staffId: staff.id, restaurantId: staff.restaurant_id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    // Store session
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    await query(
      'INSERT INTO staff_sessions (staff_id, session_token, expires_at) VALUES ($1, $2, $3)',
      [staff.id, token, expiresAt]
    );
    
    // Log login activity
    await logActivity(staff.id, staff.restaurant_id, 'login');
    
    // Remove password from response
    const { password: _, ...staffData } = staff;
    
    res.json({
      token,
      staff: {
        ...staffData,
        roleDetails: STAFF_ROLES[staff.role]
      }
    });
  } catch (error) {
    console.error('Error during staff login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Staff logout
router.post('/logout', verifyStaffToken, async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    // Remove session
    await query(
      'DELETE FROM staff_sessions WHERE session_token = $1',
      [token]
    );
    
    // Log logout activity
    await logActivity(req.staff.id, req.staff.restaurant_id, 'logout');
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Update staff member
router.put('/:id', verifyStaffToken, checkPermission('staff', 'edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, isActive } = req.body;
    
    // Validate role if provided
    if (role && !STAFF_ROLES[role]) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Check if email already exists (excluding current staff)
    if (email) {
      const existingStaff = await query(
        'SELECT id FROM staff WHERE email = $1 AND id != $2',
        [email, id]
      );
      
      if (existingStaff.rows.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }
    
    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    
    if (email) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    
    if (role) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
      updates.push(`permissions = $${paramCount++}`);
      values.push(JSON.stringify(STAFF_ROLES[role].permissions));
    }
    
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    values.push(req.staff.restaurant_id);
    
    const result = await query(`
      UPDATE staff 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND restaurant_id = $${paramCount + 1}
      RETURNING id, name, email, phone, role, permissions, is_active, created_at, updated_at
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    const updatedStaff = result.rows[0];
    
    // Log activity
    await logActivity(req.staff.id, req.staff.restaurant_id, 'staff_updated', { 
      updatedStaffId: id,
      changes: { name, email, phone, role, isActive }
    });
    
    res.json({
      ...updatedStaff,
      roleDetails: STAFF_ROLES[updatedStaff.role]
    });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

// Update staff member (for restaurant owners - no auth required)
router.put('/restaurant/:restaurantId/staff/:id', async (req, res) => {
  try {
    const { id, restaurantId } = req.params;
    const { name, email, phone, role, isActive } = req.body;
    
    // Validate role if provided
    if (role && !STAFF_ROLES[role]) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Check if email already exists (excluding current staff)
    if (email) {
      const existingStaff = await query(
        'SELECT id FROM staff WHERE email = $1 AND id != $2',
        [email, id]
      );
      
      if (existingStaff.rows.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }
    
    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    
    if (email) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    
    if (role) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
      updates.push(`permissions = $${paramCount++}`);
      values.push(JSON.stringify(STAFF_ROLES[role].permissions));
    }
    
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    values.push(restaurantId);
    
    const result = await query(`
      UPDATE staff 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND restaurant_id = $${paramCount + 1}
      RETURNING id, name, email, phone, role, permissions, is_active, created_at, updated_at
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    const updatedStaff = result.rows[0];
    
    res.json({
      ...updatedStaff,
      roleDetails: STAFF_ROLES[updatedStaff.role]
    });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

// Delete staff member
router.delete('/:id', verifyStaffToken, checkPermission('staff', 'delete'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get staff details before deletion
    const staffResult = await query(
      'SELECT name FROM staff WHERE id = $1 AND restaurant_id = $2',
      [id, req.staff.restaurant_id]
    );
    
    if (staffResult.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    const staffName = staffResult.rows[0].name;
    
    // Delete staff member (this will cascade delete sessions and activity logs)
    await query(
      'DELETE FROM staff WHERE id = $1 AND restaurant_id = $2',
      [id, req.staff.restaurant_id]
    );
    
    // Log activity
    await logActivity(req.staff.id, req.staff.restaurant_id, 'staff_deleted', { 
      deletedStaffId: id,
      deletedStaffName: staffName
    });
    
    res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ error: 'Failed to delete staff member' });
  }
});

// Delete staff member (for restaurant owners - no auth required)
router.delete('/restaurant/:restaurantId/staff/:id', async (req, res) => {
  try {
    const { id, restaurantId } = req.params;
    
    // Get staff details before deletion
    const staffResult = await query(
      'SELECT name FROM staff WHERE id = $1 AND restaurant_id = $2',
      [id, restaurantId]
    );
    
    if (staffResult.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    const staffName = staffResult.rows[0].name;
    
    // Delete staff member (this will cascade delete sessions and activity logs)
    await query(
      'DELETE FROM staff WHERE id = $1 AND restaurant_id = $2',
      [id, restaurantId]
    );
    
    res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ error: 'Failed to delete staff member' });
  }
});

// Get staff activity logs
router.get('/activity/:restaurantId', verifyStaffToken, checkPermission('staff', 'view'), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await query(`
      SELECT 
        sal.*,
        s.name as staff_name,
        s.role as staff_role
      FROM staff_activity_logs sal
      JOIN staff s ON sal.staff_id = s.id
      WHERE sal.restaurant_id = $1
      ORDER BY sal.created_at DESC
      LIMIT $2 OFFSET $3
    `, [restaurantId, limit, offset]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// Get staff activity logs (for restaurant owners - no auth required)
router.get('/restaurant/:restaurantId/activity', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await query(`
      SELECT 
        sal.*,
        s.name as staff_name,
        s.role as staff_role
      FROM staff_activity_logs sal
      JOIN staff s ON sal.staff_id = s.id
      WHERE sal.restaurant_id = $1
      ORDER BY sal.created_at DESC
      LIMIT $2 OFFSET $3
    `, [restaurantId, limit, offset]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// Get available roles
router.get('/roles', (req, res) => {
  res.json(STAFF_ROLES);
});

// Change password
router.put('/change-password', verifyStaffToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, req.staff.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await query(
      'UPDATE staff SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.staff.id]
    );
    
    // Log activity
    await logActivity(req.staff.id, req.staff.restaurant_id, 'password_changed');
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;