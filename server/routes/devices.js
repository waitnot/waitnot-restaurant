/**
 * Device/FCM token management.
 * Staff devices register their FCM token here so the server can push notifications.
 */
import express from 'express';
import { query } from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Ensure table exists
async function ensureDeviceTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS staff_devices (
      id SERIAL PRIMARY KEY,
      staff_id INTEGER,
      restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
      fcm_token TEXT NOT NULL,
      platform VARCHAR(20) DEFAULT 'android',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(restaurant_id, fcm_token)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_staff_devices_restaurant ON staff_devices(restaurant_id)`);
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

    await query(`
      INSERT INTO staff_devices (staff_id, restaurant_id, fcm_token, platform, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (restaurant_id, fcm_token)
      DO UPDATE SET platform = $4, updated_at = NOW()
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

    // Use 0 as placeholder staffId if not authenticated
    await query(`
      INSERT INTO staff_devices (staff_id, restaurant_id, fcm_token, platform, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (restaurant_id, fcm_token)
      DO UPDATE SET platform = $4, updated_at = NOW()
    `, [staffId || 0, restaurantId, fcmToken, platform]);

    console.log(`📱 FCM token registered directly: restaurant=${restaurantId} platform=${platform}`);
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
