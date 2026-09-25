/**
 * Device/FCM token management.
 * Staff devices register their FCM token here so the server can push notifications.
 */
import express from 'express';
import { query } from '../db.js';
import { verifyStaffToken } from '../middleware/auth.js';

const router = express.Router();

// Ensure table exists
async function ensureDeviceTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS staff_devices (
      id SERIAL PRIMARY KEY,
      staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
      restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
      fcm_token TEXT NOT NULL,
      platform VARCHAR(20) DEFAULT 'android',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(staff_id, fcm_token)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_staff_devices_restaurant ON staff_devices(restaurant_id)`);
}

ensureDeviceTable().catch(e => console.warn('Device table init:', e.message));

// Register or update FCM token for logged-in staff
router.post('/register', verifyStaffToken, async (req, res) => {
  try {
    const { fcmToken, platform = 'android' } = req.body;
    if (!fcmToken) return res.status(400).json({ error: 'fcmToken required' });

    const staffId = req.staff.id;
    const restaurantId = req.staff.restaurant_id;

    await query(`
      INSERT INTO staff_devices (staff_id, restaurant_id, fcm_token, platform, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (staff_id, fcm_token)
      DO UPDATE SET platform = $4, updated_at = NOW()
    `, [staffId, restaurantId, fcmToken, platform]);

    res.json({ success: true });
  } catch (e) {
    console.error('Device register error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get all FCM tokens for a restaurant
export async function getRestaurantFcmTokens(restaurantId) {
  try {
    const result = await query(
      `SELECT DISTINCT fcm_token FROM staff_devices WHERE restaurant_id = $1`,
      [restaurantId]
    );
    return result.rows.map(r => r.fcm_token);
  } catch (e) {
    console.warn('getRestaurantFcmTokens error:', e.message);
    return [];
  }
}

export default router;
