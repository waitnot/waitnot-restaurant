/**
 * Device/FCM token management.
 * Staff devices register their FCM token here so the server can push notifications.
 */
import express from 'express';
import { query } from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Ensure table exists with correct constraints
async function ensureDeviceTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS staff_devices (
      id SERIAL PRIMARY KEY,
      staff_id INTEGER,
      restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
      fcm_token TEXT NOT NULL,
      platform VARCHAR(20) DEFAULT 'android',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_staff_devices_restaurant ON staff_devices(restaurant_id)`);
  // Add unique constraint if not present (safe to run multiple times)
  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'staff_devices_restaurant_id_fcm_token_key'
      ) THEN
        ALTER TABLE staff_devices ADD CONSTRAINT staff_devices_restaurant_id_fcm_token_key
          UNIQUE (restaurant_id, fcm_token);
      END IF;
    END $$;
  `);
}

ensureDeviceTable().catch(e => console.warn('Device table init:', e.message));

// Register or update FCM token for logged-in staff
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const { fcmToken, platform = 'android' } = req.body;
    if (!fcmToken) return res.status(400).json({ error: 'fcmToken required' });

    const staffId = req.user.staffId || req.user.id;
    const restaurantId = req.user.restaurantId || req.user.restaurant_id;

    if (!staffId || !restaurantId) {
      return res.status(400).json({ error: 'Invalid token — missing staffId or restaurantId', user: req.user });
    }

    await query(`DELETE FROM staff_devices WHERE restaurant_id = $1 AND fcm_token = $2`, [restaurantId, fcmToken]);
    await query(`
      INSERT INTO staff_devices (staff_id, restaurant_id, fcm_token, platform, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [staffId, restaurantId, fcmToken, platform]);

    console.log(`📱 FCM token registered: staff=${staffId} restaurant=${restaurantId} platform=${platform}`);
    res.json({ success: true, staffId, restaurantId });
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

// Direct register — no auth needed, uses restaurantId from body (for APK registration)
router.post('/register-direct', async (req, res) => {
  try {
    const { fcmToken, restaurantId, staffId = 0, platform = 'android' } = req.body;
    if (!fcmToken || !restaurantId) return res.status(400).json({ error: 'fcmToken and restaurantId required' });

    // Delete existing entry for this token first, then insert fresh — avoids constraint issues
    await query(`DELETE FROM staff_devices WHERE restaurant_id = $1 AND fcm_token = $2`, [restaurantId, fcmToken]);
    await query(`
      INSERT INTO staff_devices (staff_id, restaurant_id, fcm_token, platform, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [staffId || 0, restaurantId, fcmToken, platform]);

    console.log(`📱 FCM token registered: restaurant=${restaurantId} platform=${platform} token=${fcmToken.substring(0,20)}...`);
    res.json({ success: true });
  } catch (e) {
    console.error('Direct register error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Test endpoint — send a test push to all devices of a restaurant
router.post('/test-push/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const tokens = await getRestaurantFcmTokens(restaurantId);
    const { sendPushNotification, getFcmStatus } = await import('../fcm.js');
    const status = getFcmStatus();
    if (!status.initialized) {
      return res.json({ success: false, message: 'Firebase not initialized', status, tokens: tokens.length });
    }
    if (tokens.length === 0) {
      return res.json({ success: false, message: 'No devices registered for this restaurant', status, tokens: [] });
    }
    const result = await sendPushNotification(tokens, {
      title: '🧪 Test Notification',
      body: 'WaitNot push notifications are working!',
      data: { type: 'test' }
    });
    res.json({ success: result.sent > 0, tokenCount: tokens.length, ...result, status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// FCM status endpoint — check if Firebase is configured and working
router.get('/fcm-status', async (req, res) => {
  try {
    const { getFcmStatus } = await import('../fcm.js');
    const status = getFcmStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List registered devices for a restaurant (debug)
router.get('/list/:restaurantId', async (req, res) => {
  try {
    const result = await query(
      `SELECT staff_id, fcm_token, platform, updated_at FROM staff_devices WHERE restaurant_id = $1 ORDER BY updated_at DESC`,
      [req.params.restaurantId]
    );
    res.json({
      count: result.rows.length,
      devices: result.rows.map(r => ({
        staffId: r.staff_id,
        tokenPrefix: r.fcm_token?.substring(0, 20) + '...',
        platform: r.platform,
        updatedAt: r.updated_at
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
