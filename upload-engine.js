'use strict';

/**
 * upload-engine.js — WaitNot Staff Software Phase 4
 *
 * Uploads pending offline orders to the server when connectivity is available.
 *
 * ─── CRITICAL DESIGN: UNKNOWN state handling ──────────────────────────────────
 * The server has NO idempotency support (verified in inspection).
 * If a network timeout occurs AFTER the server creates the order, retrying
 * would create a duplicate. Therefore:
 *
 *   queue.status = IN_PROGRESS  →  request sent, response not yet received
 *   queue.status = UNKNOWN      →  timeout: server state unknown (may have created it)
 *   queue.status = DONE         →  server confirmed creation
 *   queue.status = FAILED       →  server returned error (safe to retry)
 *
 * On restart:
 *   IN_PROGRESS items: treated as UNKNOWN (we never got a response)
 *   UNKNOWN items:     query server to check if order already exists
 *                      If found → mark DONE (avoid duplicate)
 *                      If not   → retry upload
 *
 * ─── Upload flow ──────────────────────────────────────────────────────────────
 *  1. Read PENDING queue items
 *  2. For each item: mark IN_PROGRESS, attempt upload
 *  3a. Success (201/200): mark DONE, set server_id on offline_orders
 *  3b. Server error (4xx): mark FAILED (safe to retry with backoff)
 *  3c. Timeout/network error: mark UNKNOWN (query server before retry)
 *  4. UNKNOWN recovery: GET /api/orders/restaurant/:id?customerName=...&createdAt=...
 *     Match by (restaurantId + tableNumber + totalAmount + createdAt within ±60s)
 *     If matched: mark DONE with server's _id
 *     If not found: re-queue as PENDING (retry the upload)
 */

const https  = require('https');

const API_HOST           = 'waitnot-restaurant.onrender.com';
const UPLOAD_TIMEOUT_MS  = 12000;   // 12 seconds — timeout → UNKNOWN
const UPLOAD_INTERVAL_MS = 30000;   // check queue every 30 seconds
const MAX_PARALLEL       = 3;       // upload at most 3 orders at once

let offlineDb   = null;
let mainWindow  = null;
let uploadTimer = null;
let uploading   = false;

// ─── HTTPS helpers ────────────────────────────────────────────────────────────

function nodePost(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req  = https.request({
      hostname: API_HOST,
      path,
      method : 'POST',
      headers: {
        'Content-Type'  : 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Accept'        : 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      rejectUnauthorized: false,
    }, (res) => {
      let responseBody = '';
      res.on('data', c => { responseBody += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });

    req.on('error', (err) => reject({ type: 'network', message: err.message }));
    req.setTimeout(UPLOAD_TIMEOUT_MS, () => {
      req.destroy();
      reject({ type: 'timeout', message: `Upload timed out after ${UPLOAD_TIMEOUT_MS}ms` });
    });

    req.write(data);
    req.end();
  });
}

function nodeGet(path, token) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: API_HOST,
      path,
      method : 'GET',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      rejectUnauthorized: false,
    }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body: null }); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ─── Session helper ────────────────────────────────────────────────────────────
async function getSession() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  try {
    return await Promise.race([
      mainWindow.webContents.executeJavaScript(`
        (function(){
          try {
            const sd = localStorage.getItem('staffData');
            const tk = localStorage.getItem('staffToken');
            if (!sd||!tk) return null;
            const s = JSON.parse(sd);
            return s.restaurant_id ? { rid:s.restaurant_id, tk } : null;
          } catch { return null; }
        })()
      `).catch(() => null),
      new Promise(r => setTimeout(() => r(null), 2500)),
    ]);
  } catch { return null; }
}

// ─── UNKNOWN recovery ──────────────────────────────────────────────────────────
// Query the server to check if an order was actually created.
// Match by restaurantId + tableNumber + totalAmount + createdAt within ±90s.
async function recoverUnknownOrder(queueItem, rid, tk) {
  try {
    const payload    = JSON.parse(queueItem.payload_json || '{}');
    const order      = payload.order;
    if (!order) return 'retry'; // no payload — safe to retry

    console.log(`[upload] UNKNOWN recovery for ${queueItem.entity_id.substring(0,8)}... querying server`);

    const result = await nodeGet(`/api/orders/restaurant/${rid}?status=active`, tk);
    if (!result || result.status !== 200 || !Array.isArray(result.body)) {
      console.log('[upload] UNKNOWN recovery: could not reach server — stay UNKNOWN');
      return 'unknown'; // keep as UNKNOWN, retry next cycle
    }

    const serverOrders = result.body;
    const createdAt    = new Date(order.createdAt).getTime();
    const now          = Date.now();

    // Match by tableNumber + totalAmount + createdAt within 90 seconds
    const match = serverOrders.find(s => {
      const ageMs      = Math.abs(new Date(s.createdAt).getTime() - createdAt);
      const tableMatch = s.tableNumber === order.tableNumber;
      const totalMatch = Math.abs((s.totalAmount || s.total || 0) - order.totalAmount) < 1;
      return tableMatch && totalMatch && ageMs < 90000;
    });

    if (match) {
      console.log(`[upload] UNKNOWN recovered: server order found ${match._id}`);
      offlineDb.setServerOrderId(queueItem.entity_id, match._id);
      offlineDb.appendSyncLog('up', 'order', queueItem.entity_id, 'UNKNOWN_RECOVERED', 'ok', match._id);
      return 'done';
    }

    // Not found — safe to retry
    console.log('[upload] UNKNOWN recovery: order not on server — safe to retry');
    offlineDb.appendSyncLog('up', 'order', queueItem.entity_id, 'UNKNOWN_NOT_FOUND', 'ok', 'will retry');
    return 'retry';

  } catch (err) {
    console.error('[upload] UNKNOWN recovery error:', err.message);
    return 'unknown'; // stay UNKNOWN
  }
}

// ─── Upload one order ──────────────────────────────────────────────────────────
async function uploadOrder(queueItem, rid, tk) {
  const shortId = queueItem.entity_id.substring(0, 8);
  console.log(`[upload] Uploading order ${shortId}... (attempt ${queueItem.attempt_count + 1})`);

  // Mark IN_PROGRESS immediately (crash safety)
  offlineDb.markQueueItem(queueItem.id, 'IN_PROGRESS');
  offlineDb.updateOfflineOrderStatus(queueItem.entity_id, 'PENDING_UPLOAD');

  let payload;
  try {
    payload = JSON.parse(queueItem.payload_json || '{}');
  } catch {
    offlineDb.markQueueItem(queueItem.id, 'FAILED', null, 'Invalid payload JSON');
    return;
  }

  const order = payload.order;
  const items = payload.items || [];

  // Build server request body from saved payload
  const serverBody = {
    restaurantId  : order.restaurantId,
    tableNumber   : order.tableNumber   ?? undefined,
    roomNumber    : order.roomNumber    ?? undefined,
    orderType     : order.orderType     ?? 'dine-in',
    customerName  : order.customerName  ?? '',
    customerPhone : order.customerPhone ?? undefined,
    deliveryAddress: order.deliveryAddress ?? undefined,
    items         : items.map(i => ({
      menuItemId: i.menuItemId ?? undefined,
      name      : i.nameSnapshot,
      price     : i.priceSnapshot,   // historical price — what was charged offline
      quantity  : i.quantity,
    })),
    totalAmount   : order.totalAmount,
    packagingCharge: order.packagingCharge ?? undefined,
    deliveryCharge : order.deliveryCharge  ?? undefined,
    paymentMethod  : order.paymentMethod  ?? 'cash',
    paymentStatus  : 'pending',
    status         : 'pending',
    source         : 'staff',
  };

  try {
    const result = await nodePost('/api/orders', serverBody, tk);

    if (result.status >= 200 && result.status < 300) {
      // ✅ Success
      const serverId = result.body?._id;
      console.log(`[upload] ✅ Order ${shortId} → server ${serverId} (#${result.body?.orderNumber})`);
      offlineDb.setServerOrderId(queueItem.entity_id, serverId);
      offlineDb.markQueueItem(queueItem.id, 'DONE', JSON.stringify({ serverId, orderNumber: result.body?.orderNumber }));
      offlineDb.appendSyncLog('up', 'order', queueItem.entity_id, 'CREATE', 'ok', serverId);

    } else if (result.status >= 400 && result.status < 500) {
      // ❌ Client error — safe to mark failed (server rejected it)
      const errMsg = result.body?.error || result.body?.message || `HTTP ${result.status}`;
      console.warn(`[upload] ❌ Order ${shortId} rejected: ${errMsg}`);
      offlineDb.markQueueItem(queueItem.id, 'FAILED', JSON.stringify(result.body), errMsg);
      offlineDb.updateOfflineOrderStatus(queueItem.entity_id, 'UPLOAD_FAILED');
      offlineDb.appendSyncLog('up', 'order', queueItem.entity_id, 'CREATE', 'error', errMsg);

    } else {
      // ⚠️ Server error (5xx) — treat as UNKNOWN, may have been created
      const errMsg = `HTTP ${result.status}`;
      console.warn(`[upload] ⚠ Order ${shortId} server error: ${errMsg} → UNKNOWN`);
      offlineDb.markQueueItem(queueItem.id, 'UNKNOWN', JSON.stringify(result.body), errMsg);
      offlineDb.updateOfflineOrderStatus(queueItem.entity_id, 'UPLOAD_UNKNOWN');
      offlineDb.appendSyncLog('up', 'order', queueItem.entity_id, 'CREATE', 'unknown', errMsg);
    }

  } catch (err) {
    if (err.type === 'timeout') {
      // ⚠️ Timeout — server state unknown, MAY have created order
      console.warn(`[upload] ⚠ Order ${shortId} TIMEOUT → UNKNOWN (server state unknown)`);
      offlineDb.markQueueItem(queueItem.id, 'UNKNOWN', null, err.message);
      offlineDb.updateOfflineOrderStatus(queueItem.entity_id, 'UPLOAD_UNKNOWN');
      offlineDb.appendSyncLog('up', 'order', queueItem.entity_id, 'CREATE', 'unknown', 'timeout');

    } else {
      // Network error — offline, safe to retry
      console.warn(`[upload] Network error: ${err.message} — will retry`);
      offlineDb.markQueueItem(queueItem.id, 'FAILED', null, err.message);
      offlineDb.updateOfflineOrderStatus(queueItem.entity_id, 'PENDING_UPLOAD');
      offlineDb.appendSyncLog('up', 'order', queueItem.entity_id, 'CREATE', 'error', err.message);
    }
  }
}

// ─── Process UNKNOWN items ─────────────────────────────────────────────────────
async function processUnknownItems(rid, tk) {
  if (!offlineDb.isReady()) return;

  // Also recover IN_PROGRESS items from a previous crashed session
  const Database = require('./node_modules/better-sqlite3');
  // Use offlineDb internal — get stale IN_PROGRESS items
  const staleItems = [];
  try {
    // Access via offlineDb.getQueueItem equivalent for IN_PROGRESS
    // We need raw access — use the markQueueItem approach
    // Mark all IN_PROGRESS → UNKNOWN (they were in-flight when app crashed)
    const dbPath = require('path').join(
      require('electron').app.getPath('userData'),
      'waitnot-offline.db'
    );
    const db = new Database(dbPath);
    const inProgress = db.prepare("SELECT * FROM sync_queue WHERE status='IN_PROGRESS'").all();
    if (inProgress.length > 0) {
      console.log(`[upload] Recovering ${inProgress.length} IN_PROGRESS items from previous session`);
      db.prepare("UPDATE sync_queue SET status='UNKNOWN', error_message='App restarted during upload', updated_at=? WHERE status='IN_PROGRESS'")
        .run(new Date().toISOString());
    }
    db.close();
  } catch {}

  // Process UNKNOWN items
  const unknownItems = [];
  try {
    const dbPath = require('path').join(
      require('electron').app.getPath('userData'),
      'waitnot-offline.db'
    );
    const db = new Database(dbPath);
    const rows = db.prepare("SELECT * FROM sync_queue WHERE status='UNKNOWN' ORDER BY id LIMIT 10").all();
    unknownItems.push(...rows);
    db.close();
  } catch {}

  for (const item of unknownItems) {
    const decision = await recoverUnknownOrder(item, rid, tk);
    if (decision === 'done') {
      offlineDb.markQueueItem(item.id, 'DONE', null, null);
    } else if (decision === 'retry') {
      // Reset to PENDING so next cycle picks it up
      offlineDb.markQueueItem(item.id, 'PENDING', null, null);
      offlineDb.updateOfflineOrderStatus(item.entity_id, 'PENDING_UPLOAD');
    }
    // 'unknown' → leave as UNKNOWN, retry in next cycle
  }
}

// ─── Main upload cycle ─────────────────────────────────────────────────────────
async function runUploadCycle() {
  if (uploading) return;
  if (!offlineDb || !offlineDb.isReady()) return;

  const session = await getSession();
  if (!session) return; // not logged in

  const { rid, tk } = session;
  uploading = true;

  try {
    // 1. Recover UNKNOWN/IN_PROGRESS items first (crash safety)
    await processUnknownItems(rid, tk);

    // 2. Upload PENDING items (up to MAX_PARALLEL)
    const pending = offlineDb.getPendingQueue().filter(q => q.entity_type === 'order');
    if (pending.length === 0) return;

    console.log(`[upload] ${pending.length} orders pending upload`);

    // Upload sequentially to avoid race conditions on same table
    const batch = pending.slice(0, MAX_PARALLEL);
    for (const item of batch) {
      await uploadOrder(item, rid, tk);
      // Small gap between requests to avoid hammering server
      await new Promise(r => setTimeout(r, 300));
    }

    const remaining = offlineDb.getPendingQueue().filter(q => q.entity_type === 'order').length;
    if (remaining > 0) {
      console.log(`[upload] ${remaining} orders still pending`);
    } else {
      console.log('[upload] ✅ All orders uploaded');
    }

  } catch (err) {
    console.error('[upload] Cycle error:', err.message);
  } finally {
    uploading = false;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

function init(db, win) {
  offlineDb   = db;
  mainWindow  = win;

  // Run upload cycle 10 seconds after startup (let sync complete first)
  setTimeout(() => runUploadCycle(), 10000);

  // Then every 30 seconds as the base interval
  uploadTimer = setInterval(() => runUploadCycle(), UPLOAD_INTERVAL_MS);

  // Fast-retry loop: every 5 seconds, but ONLY when there are pending items.
  // This ensures orders placed offline upload within seconds of reconnection.
  setInterval(() => {
    if (!offlineDb || !offlineDb.isReady()) return;
    const pending = offlineDb.getPendingQueue().filter(q => q.entity_type === 'order');
    if (pending.length > 0) {
      runUploadCycle();
    }
  }, 5000);

  console.log('[upload] Engine initialised — checking every 30s (fast-retry every 5s when pending)');
}

/**
 * Returns true if there are orders waiting to be uploaded.
 * Used by main.js to decide whether to run an immediate cycle.
 */
function hasPending() {
  if (!offlineDb || !offlineDb.isReady()) return false;
  try {
    return offlineDb.getPendingQueue().some(q => q.entity_type === 'order');
  } catch { return false; }
}

function stop() {
  if (uploadTimer) { clearInterval(uploadTimer); uploadTimer = null; }
}

async function triggerUpload() {
  return runUploadCycle();
}

function getQueueStatus() {
  if (!offlineDb || !offlineDb.isReady()) return { pending:0, unknown:0, done:0, failed:0 };
  try {
    const Database = require('./node_modules/better-sqlite3');
    const dbPath = require('path').join(
      require('electron').app.getPath('userData'),
      'waitnot-offline.db'
    );
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare(`
      SELECT
        SUM(CASE WHEN status IN ('PENDING','IN_PROGRESS') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'UNKNOWN'  THEN 1 ELSE 0 END) as unknown,
        SUM(CASE WHEN status = 'DONE'     THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status = 'FAILED'   THEN 1 ELSE 0 END) as failed
      FROM sync_queue WHERE entity_type = 'order'
    `).get();
    db.close();
    return { pending: row.pending||0, unknown: row.unknown||0, done: row.done||0, failed: row.failed||0 };
  } catch { return { pending:0, unknown:0, done:0, failed:0 }; }
}

module.exports = { init, stop, triggerUpload, getQueueStatus, hasPending };
