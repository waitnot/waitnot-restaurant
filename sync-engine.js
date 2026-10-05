'use strict';

/**
 * sync-engine.js — WaitNot Staff Software Phase 2
 *
 * Server → Desktop synchronisation engine.
 *
 * Backend constraints (from inspection):
 *   - No ?updatedAfter filtering (silently ignored)
 *   - No tombstones/deleted_at fields
 *   - No incremental patch API
 *   → Strategy: Full download on each sync cycle, but only process
 *     if restaurant.updatedAt has changed (cheap check via sync_meta).
 *     Menu/table changes detected by MD5 hash comparison.
 *
 * Sync cycle (runs on startup + every SYNC_INTERVAL_MS):
 *   1. Check connectivity (HTTP GET to backend)
 *   2. Fetch restaurant record (includes menu array)
 *   3. Compare restaurant.updatedAt to sync_meta cursor
 *   4. If changed: upsert restaurant, upsert menu items, upsert tables
 *   5. Update sync_meta cursor with new updatedAt + menu hash
 *   6. Emit status event to renderer
 *
 * Connectivity states:
 *   UNKNOWN → initial state before first check
 *   ONLINE  → last connectivity check succeeded
 *   OFFLINE → last connectivity check failed
 *   SYNCING → sync cycle in progress
 *   SYNC_ERROR → last sync failed with an error
 */

const https        = require('https');
const crypto       = require('crypto');
const remoteConfig = require('./remote-config');

// ─── Configuration ────────────────────────────────────────────────────────────
// API_HOST is now dynamic — always call remoteConfig.getApiHost() at request time
const SYNC_INTERVAL_MS  = 5 * 60 * 1000;   // 5 minutes
const CONNECT_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 15000;

// ─── State ─────────────────────────────────────────────────────────────────────
let offlineDb      = null;
let mainWindow     = null;
let syncTimer      = null;
let syncRunning    = false;

const state = {
  connectivity  : 'UNKNOWN',   // UNKNOWN | ONLINE | OFFLINE | SYNCING | SYNC_ERROR
  lastSyncAt    : null,        // ISO8601
  lastError     : null,        // string | null
  syncCount     : 0,
  menuItemCount : 0,
};

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function nodeGet(path, { timeout = REQUEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: remoteConfig.getApiHost(),
      path,
      method: 'GET',
      headers: { Accept: 'application/json' },
      rejectUnauthorized: false,
    }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); }
          catch { reject(new Error(`JSON parse error for ${path}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode} for ${path}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error(`Timeout after ${timeout}ms for ${path}`));
    });
    req.end();
  });
}

// ─── MD5 hash helper ──────────────────────────────────────────────────────────
function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

// ─── State broadcasting ───────────────────────────────────────────────────────
function broadcastState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(
    `window.dispatchEvent(new CustomEvent('__wn_sync_status__', { detail: ${JSON.stringify(state)} }))`
  ).catch(() => {});
}

function setState(patch) {
  Object.assign(state, patch);
  broadcastState();
}

// ─── Connectivity check ───────────────────────────────────────────────────────
async function checkConnectivity() {
  try {
    await nodeGet('/api/restaurants', { timeout: CONNECT_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

// ─── Main sync function ───────────────────────────────────────────────────────
async function syncRestaurant(restaurantId, staffToken) {
  if (syncRunning) {
    console.log('[sync] Already running — skipping');
    return { skipped: true };
  }
  syncRunning = true;
  setState({ connectivity: 'SYNCING', lastError: null });

  try {
    // ── 1. Fetch full restaurant record (includes menu) ────────────────────
    console.log(`[sync] Fetching restaurant ${restaurantId}...`);
    const restaurant = await nodeGet(`/api/restaurants/${restaurantId}`);

    const serverUpdatedAt  = restaurant.updatedAt || restaurant.createdAt;
    const serverMenuHash   = md5(JSON.stringify(restaurant.menu || []));

    // ── 2. Compare with stored cursor ─────────────────────────────────────
    const meta = offlineDb.getSyncMeta('restaurant');
    const storedUpdatedAt = meta?.last_synced_at;
    const storedMenuHash  = meta?.last_server_hash;

    const restaurantChanged = storedUpdatedAt !== serverUpdatedAt;
    const menuChanged       = storedMenuHash  !== serverMenuHash;

    if (!restaurantChanged && !menuChanged) {
      console.log('[sync] No changes detected — skipping upsert');
      setState({
        connectivity : 'ONLINE',
        lastSyncAt   : new Date().toISOString(),
        syncCount    : state.syncCount + 1,
      });
      offlineDb.setSyncMeta('restaurant', {
        lastSyncedAt   : new Date().toISOString(),
        lastServerHash : storedMenuHash,
      });
      offlineDb.appendSyncLog('down', 'restaurant', restaurantId, 'check', 'skip', 'no changes');
      return { changed: false };
    }

    console.log(`[sync] Changes detected — restaurant: ${restaurantChanged}, menu: ${menuChanged}`);

    // ── 3. Upsert restaurant record ────────────────────────────────────────
    offlineDb.upsertRestaurant({
      _id              : restaurant._id,
      name             : restaurant.name,
      address          : restaurant.address,
      phone            : restaurant.phone,
      email            : restaurant.email,
      tables           : restaurant.tables || 0,
      rooms            : restaurant.rooms  || 0,
      isDeliveryAvailable: restaurant.isDeliveryAvailable || false,
      features         : restaurant.features || {},
    });
    offlineDb.appendSyncLog('down', 'restaurant', restaurantId, 'upsert', 'ok', null);

    // ── 4. Upsert menu items (transactional) ───────────────────────────────
    const menuItems = restaurant.menu || [];
    if (menuItems.length > 0) {
      offlineDb.upsertMenuItems(restaurantId, menuItems);
      console.log(`[sync] Menu synced: ${menuItems.length} items`);
      offlineDb.appendSyncLog('down', 'menu', restaurantId, 'upsert', 'ok', `${menuItems.length} items`);
    }

    // ── 5. Upsert tables/rooms config ──────────────────────────────────────
    const tableCount = restaurant.tables || 0;
    const roomCount  = restaurant.rooms  || 0;
    if (tableCount > 0 || roomCount > 0) {
      offlineDb.upsertTablesConfig(restaurantId, tableCount, roomCount);
      console.log(`[sync] Tables synced: ${tableCount} tables, ${roomCount} rooms`);
      offlineDb.appendSyncLog('down', 'tables', restaurantId, 'upsert', 'ok', `${tableCount}t ${roomCount}r`);
    }

    // ── 6. Update sync cursor ──────────────────────────────────────────────
    offlineDb.setSyncMeta('restaurant', {
      lastSyncedAt   : serverUpdatedAt,
      lastServerHash : serverMenuHash,
    });

    const menuItemCount = offlineDb.getMenuItems(restaurantId).length;
    setState({
      connectivity  : 'ONLINE',
      lastSyncAt    : new Date().toISOString(),
      lastError     : null,
      syncCount     : state.syncCount + 1,
      menuItemCount,
    });

    console.log(`[sync] ✅ Complete — ${menuItems.length} menu items, ${tableCount} tables`);
    return { changed: true, menuItems: menuItems.length, tables: tableCount };

  } catch (err) {
    console.error('[sync] ❌ Error:', err.message);
    const isConnErr = err.message.includes('Timeout') || err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND');
    setState({
      connectivity : isConnErr ? 'OFFLINE' : 'SYNC_ERROR',
      lastError    : err.message,
    });
    offlineDb.appendSyncLog('down', 'restaurant', restaurantId || 'unknown', 'sync', 'error', err.message);
    return { error: err.message };

  } finally {
    syncRunning = false;
  }
}

// ─── Session-aware sync ───────────────────────────────────────────────────────
// Gets staff credentials from renderer, then syncs their restaurant.
async function syncFromSession(win) {
  const mw = win || mainWindow;
  if (!mw || mw.isDestroyed()) return;

  let info = null;
  try {
    info = await Promise.race([
      mw.webContents.executeJavaScript(`
        (function() {
          try {
            const sd = localStorage.getItem('staffData');
            const tk = localStorage.getItem('staffToken');
            if (!sd || !tk) return null;
            const staff = JSON.parse(sd);
            return staff.restaurant_id ? { rid: staff.restaurant_id, tk } : null;
          } catch(e) { return null; }
        })()
      `).catch(() => null),
      new Promise(r => setTimeout(() => r(null), 2500)),
    ]);
  } catch { info = null; }

  if (!info || !info.rid) {
    // Not logged in — still mark connectivity
    const online = await checkConnectivity();
    setState({ connectivity: online ? 'ONLINE' : 'OFFLINE' });
    return;
  }

  await syncRestaurant(info.rid, info.tk);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise the sync engine.
 * Call once after offlineDb.init() and mainWindow is created.
 */
function init(db, win) {
  offlineDb  = db;
  mainWindow = win;

  console.log('[sync] Engine initialised');

  // Run initial sync after a short delay (let the window load first)
  setTimeout(() => syncFromSession(), 4000);

  // Schedule periodic sync
  syncTimer = setInterval(() => syncFromSession(), SYNC_INTERVAL_MS);
  console.log(`[sync] Periodic sync every ${SYNC_INTERVAL_MS / 60000} minutes`);
}

/**
 * Stop the sync engine (call on app quit).
 */
function stop() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  console.log('[sync] Engine stopped');
}

/**
 * Trigger an immediate sync (e.g. from IPC handler).
 */
async function triggerSync() {
  return syncFromSession();
}

/**
 * Get the current sync/connectivity state.
 */
function getState() {
  return { ...state };
}

/**
 * Check if we have a valid offline dataset for a restaurant.
 * Phase 2: true if menu + restaurant data is in SQLite.
 */
function isOfflineReady(restaurantId) {
  if (!offlineDb || !offlineDb.isReady()) return false;
  const rest  = offlineDb.getRestaurant(restaurantId);
  const items = offlineDb.getMenuItems(restaurantId);
  return !!(rest && items.length > 0);
}

module.exports = {
  init,
  stop,
  triggerSync,
  getState,
  isOfflineReady,
  // exported for testing
  _syncRestaurant: syncRestaurant,
  _checkConnectivity: checkConnectivity,
};
