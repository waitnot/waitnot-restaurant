/**
 * Firebase Cloud Messaging utility.
 * Sends push notifications to staff devices even when app is closed.
 *
 * Requires FIREBASE_SERVICE_ACCOUNT env var (JSON string of serviceAccountKey.json)
 * OR individual FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY vars.
 */

import { createRequire } from 'module';

let messaging = null;
let initError = null;

function parseServiceAccount(raw) {
  if (!raw) return null;
  // 1. Try as-is
  try { return JSON.parse(raw); } catch (_) {}
  // 2. Private key may contain literal \n (not escaped) — fix them
  try {
    const fixed = raw.replace(/("private_key"\s*:\s*")([\s\S]+?)(")/,
      (_, pre, key, post) => pre + key.replace(/\n/g, '\\n') + post
    );
    return JSON.parse(fixed);
  } catch (_) {}
  return null;
}

function initFirebase() {
  if (messaging) return messaging;
  if (initError) return null; // already failed, don't retry on every request

  try {
    const require = createRequire(import.meta.url);
    const admin = require('firebase-admin');

    if (admin.apps.length > 0) {
      messaging = admin.messaging();
      return messaging;
    }

    let credential;

    const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawEnv) {
      const sa = parseServiceAccount(rawEnv);
      if (sa) {
        credential = admin.credential.cert(sa);
        console.log('✅ Firebase: loaded from FIREBASE_SERVICE_ACCOUNT');
      } else {
        console.error('❌ Firebase: FIREBASE_SERVICE_ACCOUNT is set but could not be parsed as JSON');
        initError = 'bad_json';
        return null;
      }
    } else if (process.env.FIREBASE_PROJECT_ID) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      });
      console.log('✅ Firebase: loaded from individual env vars');
    } else {
      // Try local file for development
      try {
        const fs = require('fs');
        const path = require('path');
        const keyPath = path.join(process.cwd(), 'firebase-service-account.json');
        if (fs.existsSync(keyPath)) {
          const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
          credential = admin.credential.cert(sa);
          console.log('✅ Firebase: loaded from local firebase-service-account.json');
        } else {
          console.log('⚠️ Firebase not configured — push notifications disabled');
          initError = 'not_configured';
          return null;
        }
      } catch (fe) {
        console.log('⚠️ Firebase local file load failed:', fe.message);
        initError = 'not_configured';
        return null;
      }
    }

    admin.initializeApp({ credential });
    messaging = admin.messaging();
    console.log('✅ Firebase Admin SDK initialized — push notifications enabled');
    return messaging;
  } catch (e) {
    console.error('❌ Firebase init failed:', e.message);
    initError = e.message;
    return null;
  }
}

// Eagerly initialize at startup so errors appear in logs immediately
initFirebase();

/**
 * Send push notification to one or more FCM tokens.
 * Automatically removes stale/invalid tokens from DB.
 */
export async function sendPushNotification(tokens, { title, body, data = {} }) {
  if (!tokens || tokens.length === 0) return { sent: 0, failed: 0 };
  const msg = initFirebase();
  if (!msg) {
    console.warn('⚠️ Push skipped — Firebase not initialized. initError:', initError);
    return { sent: 0, failed: 0 };
  }

  const validTokens = tokens.filter(t => typeof t === 'string' && t.length > 20);
  if (validTokens.length === 0) return { sent: 0, failed: 0 };

  try {
    const message = {
      notification: { title, body },
      // data payload ensures delivery even when app is killed (data-only message handled by WaitNotFirebaseService)
      data: {
        title: String(title),
        body: String(body),
        ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      },
      android: {
        priority: 'high',
        ttl: 60 * 60 * 1000, // 1 hour TTL
        notification: {
          sound: 'default',
          channelId: 'waitnot_orders',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
          notificationCount: 1,
        },
      },
      tokens: validTokens,
    };

    const response = await msg.sendEachForMulticast(message);
    console.log(`📱 FCM: ${response.successCount}/${validTokens.length} delivered, ${response.failureCount} failed`);

    // Log failures for debugging
    if (response.failureCount > 0) {
      response.responses.forEach((r, i) => {
        if (!r.success) {
          console.warn(`  Token[${i}] failed: ${r.error?.code} — ${r.error?.message}`);
        }
      });
    }

    return { sent: response.successCount, failed: response.failureCount };
  } catch (e) {
    console.error('❌ FCM sendEachForMulticast error:', e.message);
    return { sent: 0, failed: validTokens.length };
  }
}

export function getFcmStatus() {
  return {
    initialized: !!messaging,
    initError,
    configured: !!(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_PROJECT_ID),
  };
}
