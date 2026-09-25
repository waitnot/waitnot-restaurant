/**
 * Firebase Cloud Messaging utility.
 * Sends push notifications to staff devices even when app is closed.
 *
 * Requires FIREBASE_SERVICE_ACCOUNT env var (JSON string of serviceAccountKey.json)
 * OR FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY env vars.
 */

import { createRequire } from 'module';

let messaging = null;

function initFirebase() {
  if (messaging) return messaging;
  try {
    const require = createRequire(import.meta.url);
    const admin = require('firebase-admin');

    if (admin.apps.length > 0) {
      messaging = admin.messaging();
      return messaging;
    }

    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } else if (process.env.FIREBASE_PROJECT_ID) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      });
    } else {
      console.log('⚠️ Firebase not configured — push notifications disabled');
      return null;
    }

    admin.initializeApp({ credential });
    messaging = admin.messaging();
    console.log('✅ Firebase Admin initialized');
    return messaging;
  } catch (e) {
    console.warn('Firebase init failed:', e.message);
    return null;
  }
}

/**
 * Send a push notification to one or more FCM tokens.
 * Silent fail — never throws, never breaks order flow.
 */
export async function sendPushNotification(tokens, { title, body, data = {} }) {
  if (!tokens || tokens.length === 0) return;
  const msg = initFirebase();
  if (!msg) return;

  const validTokens = tokens.filter(t => t && t.length > 10);
  if (validTokens.length === 0) return;

  try {
    const message = {
      notification: { title, body },
      data: { title, body, ...data },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'waitnot_orders',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      tokens: validTokens,
    };
    const response = await msg.sendEachForMulticast(message);
    console.log(`📱 Push sent: ${response.successCount} ok, ${response.failureCount} failed`);
  } catch (e) {
    console.warn('FCM send error:', e.message);
  }
}
