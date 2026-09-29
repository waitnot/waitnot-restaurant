'use strict';

/**
 * offline-db.js — WaitNot Staff Software
 * Local SQLite database layer for offline-first operation.
 *
 * Architecture:
 *   - Single database file: %APPDATA%/waitnot-staff-dashboard/waitnot-offline.db
 *   - Schema versioned via PRAGMA user_version (migration runner)
 *   - All writes use transactions where multiple rows are involved
 *   - No raw SQL outside this file — caller uses exported repository functions
 *
 * Phase 1: Foundation (schema + migrations + device identity + sync metadata)
 * Phase 2: Menu/data sync (populated in sync-engine.js, read here)
 * Phase 3+: Offline orders, sync queue (schema ready, logic added later)
 */

const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

// ─── State ────────────────────────────────────────────────────────────────────
let db   = null;   // better-sqlite3 Database instance
let ready = false;
let dbPath = '';

// ─── Migration definitions ────────────────────────────────────────────────────
// Each migration has a version number and a function that receives the db.
// They run in order, each wrapped in a transaction automatically.
// NEVER modify existing migrations — only add new ones.

const MIGRATIONS = [
  {
    version: 1,
    description: 'Initial schema — all tables for Phase 1-4',
    up: (db) => {
      db.exec(`
        -- Device identity (singleton)
        CREATE TABLE IF NOT EXISTS device_identity (
          id         INTEGER PRIMARY KEY CHECK (id = 1),
          device_id  TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        -- Sync metadata per entity type
        CREATE TABLE IF NOT EXISTS sync_meta (
          entity_type        TEXT PRIMARY KEY,
          last_synced_at     TEXT,
          last_server_hash   TEXT,
          sync_count         INTEGER NOT NULL DEFAULT 0,
          last_error         TEXT
        );

        -- Cached restaurant records
        CREATE TABLE IF NOT EXISTS restaurants (
          id               TEXT PRIMARY KEY,
          name             TEXT NOT NULL,
          address          TEXT,
          phone            TEXT,
          email            TEXT,
          tables_count     INTEGER NOT NULL DEFAULT 0,
          rooms_count      INTEGER NOT NULL DEFAULT 0,
          is_delivery      INTEGER NOT NULL DEFAULT 0,
          features_json    TEXT,
          raw_json         TEXT,
          synced_at        TEXT NOT NULL
        );

        -- Menu items (price snapshot used for offline orders)
        CREATE TABLE IF NOT EXISTS menu_items (
          id              TEXT PRIMARY KEY,
          restaurant_id   TEXT NOT NULL,
          name            TEXT NOT NULL,
          price           REAL NOT NULL,
          category        TEXT,
          is_veg          INTEGER NOT NULL DEFAULT 0,
          description     TEXT,
          image_url       TEXT,
          available       INTEGER NOT NULL DEFAULT 1,
          display_order   INTEGER NOT NULL DEFAULT 0,
          synced_at       TEXT NOT NULL,
          FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
        );
        CREATE INDEX IF NOT EXISTS idx_menu_restaurant
          ON menu_items(restaurant_id, available);
        CREATE INDEX IF NOT EXISTS idx_menu_category
          ON menu_items(restaurant_id, category);

        -- Table/room configuration
        CREATE TABLE IF NOT EXISTS tables_config (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          restaurant_id   TEXT NOT NULL,
          table_number    INTEGER NOT NULL,
          table_type      TEXT NOT NULL DEFAULT 'dine-in',
          label           TEXT,
          is_active       INTEGER NOT NULL DEFAULT 1,
          synced_at       TEXT NOT NULL,
          FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
          UNIQUE (restaurant_id, table_number, table_type)
        );
        CREATE INDEX IF NOT EXISTS idx_tables_restaurant
          ON tables_config(restaurant_id);

        -- Offline orders (created without internet)
        CREATE TABLE IF NOT EXISTS offline_orders (
          id                   TEXT PRIMARY KEY,
          server_id            TEXT,
          restaurant_id        TEXT NOT NULL,
          table_number         INTEGER,
          room_number          INTEGER,
          order_type           TEXT NOT NULL DEFAULT 'dine-in',
          customer_name        TEXT,
          customer_phone       TEXT,
          delivery_address     TEXT,
          total_amount         REAL NOT NULL DEFAULT 0,
          packaging_charge     REAL NOT NULL DEFAULT 0,
          delivery_charge      REAL NOT NULL DEFAULT 0,
          payment_method       TEXT NOT NULL DEFAULT 'cash',
          payment_status       TEXT NOT NULL DEFAULT 'pending',
          source               TEXT NOT NULL DEFAULT 'staff',
          local_status         TEXT NOT NULL DEFAULT 'LOCAL_PENDING',
          created_by_staff_id  TEXT,
          created_at           TEXT NOT NULL,
          updated_at           TEXT NOT NULL,
          notes                TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_offline_orders_restaurant
          ON offline_orders(restaurant_id, local_status);
        CREATE INDEX IF NOT EXISTS idx_offline_orders_table
          ON offline_orders(restaurant_id, table_number);

        -- Order items — price snapshot is IMMUTABLE after creation
        CREATE TABLE IF NOT EXISTS offline_order_items (
          id               TEXT PRIMARY KEY,
          order_id         TEXT NOT NULL,
          menu_item_id     TEXT,
          name_snapshot    TEXT NOT NULL,
          price_snapshot   REAL NOT NULL,
          quantity         INTEGER NOT NULL DEFAULT 1,
          line_total       REAL NOT NULL,
          is_complimentary INTEGER NOT NULL DEFAULT 0,
          notes            TEXT,
          FOREIGN KEY (order_id) REFERENCES offline_orders(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_order_items_order
          ON offline_order_items(order_id);

        -- Durable sync queue (survives crash/restart)
        CREATE TABLE IF NOT EXISTS sync_queue (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type     TEXT NOT NULL,
          entity_id       TEXT NOT NULL,
          operation       TEXT NOT NULL,
          payload_json    TEXT,
          status          TEXT NOT NULL DEFAULT 'PENDING',
          attempt_count   INTEGER NOT NULL DEFAULT 0,
          last_attempt_at TEXT,
          next_attempt_at TEXT,
          server_response TEXT,
          error_message   TEXT,
          created_at      TEXT NOT NULL,
          updated_at      TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sync_queue_status
          ON sync_queue(status, next_attempt_at);

        -- Append-only sync audit log
        CREATE TABLE IF NOT EXISTS sync_log (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          direction   TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id   TEXT,
          operation   TEXT,
          result      TEXT NOT NULL,
          detail      TEXT,
          synced_at   TEXT NOT NULL
        );
      `);
    },
  },
  // Future migrations go here — NEVER modify migration 1
  // { version: 2, description: '...', up: (db) => { ... } },
];

// ─── Migration runner ─────────────────────────────────────────────────────────
function runMigrations(database) {
  const current = database.pragma('user_version', { simple: true });
  const pending  = MIGRATIONS.filter(m => m.version > current);

  if (pending.length === 0) {
    console.log(`[offline-db] Schema up to date (v${current})`);
    return;
  }

  for (const migration of pending) {
    console.log(`[offline-db] Running migration v${migration.version}: ${migration.description}`);
    const run = database.transaction(() => {
      migration.up(database);
      database.pragma(`user_version = ${migration.version}`);
    });
    run();
    console.log(`[offline-db] Migration v${migration.version} complete`);
  }
}

// ─── Device identity ──────────────────────────────────────────────────────────
function ensureDeviceId(database) {
  const existing = database.prepare('SELECT device_id FROM device_identity WHERE id = 1').get();
  if (existing) return existing.device_id;

  const deviceId = crypto.randomUUID();
  database.prepare(
    'INSERT INTO device_identity (id, device_id, created_at) VALUES (1, ?, ?)'
  ).run(deviceId, new Date().toISOString());

  console.log(`[offline-db] New device_id generated: ${deviceId}`);
  return deviceId;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise the database.
 * Must be called once during app startup (in app.whenReady).
 * Safe to call multiple times — idempotent.
 *
 * @param {string} userDataPath  app.getPath('userData')
 * @returns {{ success: boolean, dbPath: string, error?: string }}
 */
function init(userDataPath) {
  if (ready) return { success: true, dbPath };

  try {
    const Database = require('./node_modules/better-sqlite3');
    dbPath = path.join(userDataPath, 'waitnot-offline.db');

    console.log(`[offline-db] Opening database: ${dbPath}`);

    db = new Database(dbPath, {
      // verbose: process.env.NODE_ENV === 'development' ? console.log : null,
    });

    // Performance and safety settings
    db.pragma('journal_mode = WAL');       // Write-ahead log — faster + crash safe
    db.pragma('foreign_keys = ON');        // Enforce referential integrity
    db.pragma('synchronous = NORMAL');     // WAL-safe, faster than FULL
    db.pragma('cache_size = -4000');       // 4MB page cache

    runMigrations(db);
    ensureDeviceId(db);

    ready = true;
    console.log(`[offline-db] Ready ✅  schema v${db.pragma('user_version', { simple: true })}`);
    return { success: true, dbPath };

  } catch (err) {
    console.error('[offline-db] Init failed:', err.message);
    db    = null;
    ready = false;
    return { success: false, dbPath, error: err.message };
  }
}

/**
 * Close the database safely. Call before app quit.
 */
function close() {
  if (db) {
    try { db.close(); } catch {}
    db    = null;
    ready = false;
    console.log('[offline-db] Closed');
  }
}

/**
 * Returns current status for the offline:getStatus IPC handler.
 */
function getStatus() {
  if (!ready || !db) {
    return { ready: false, dbPath, schemaVersion: 0, deviceId: null };
  }

  const schemaVersion = db.pragma('user_version', { simple: true });
  const deviceId      = db.prepare('SELECT device_id FROM device_identity WHERE id = 1').get()?.device_id ?? null;
  const menuItemCount = db.prepare('SELECT COUNT(*) as c FROM menu_items').get()?.c ?? 0;
  const restaurantCount = db.prepare('SELECT COUNT(*) as c FROM restaurants').get()?.c ?? 0;
  const pendingOrders = db.prepare("SELECT COUNT(*) as c FROM offline_orders WHERE local_status IN ('LOCAL_PENDING','LOCAL_CONFIRMED','PENDING_UPLOAD','UPLOAD_FAILED','UPLOAD_UNKNOWN')").get()?.c ?? 0;
  const syncQueuePending = db.prepare("SELECT COUNT(*) as c FROM sync_queue WHERE status IN ('PENDING','IN_PROGRESS','FAILED')").get()?.c ?? 0;

  const syncMeta = {};
  const rows = db.prepare('SELECT * FROM sync_meta').all();
  for (const row of rows) syncMeta[row.entity_type] = row;

  return {
    ready: true,
    dbPath,
    schemaVersion,
    deviceId,
    menuItemCount,
    restaurantCount,
    pendingOrders,
    syncQueuePending,
    syncMeta,
  };
}

// ─── Device repository ────────────────────────────────────────────────────────

function getDeviceId() {
  if (!ready) return null;
  return db.prepare('SELECT device_id FROM device_identity WHERE id = 1').get()?.device_id ?? null;
}

// ─── Sync metadata repository ──────────────────────────────────────────────────

function getSyncMeta(entityType) {
  if (!ready) return null;
  return db.prepare('SELECT * FROM sync_meta WHERE entity_type = ?').get(entityType) ?? null;
}

function setSyncMeta(entityType, { lastSyncedAt, lastServerHash, error } = {}) {
  if (!ready) return;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO sync_meta (entity_type, last_synced_at, last_server_hash, sync_count, last_error)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(entity_type) DO UPDATE SET
      last_synced_at   = excluded.last_synced_at,
      last_server_hash = excluded.last_server_hash,
      sync_count       = sync_count + 1,
      last_error       = excluded.last_error
  `).run(entityType, lastSyncedAt ?? now, lastServerHash ?? null, error ?? null);
}

// ─── Restaurant repository ────────────────────────────────────────────────────

function upsertRestaurant(data) {
  if (!ready) throw new Error('offline-db not ready');
  db.prepare(`
    INSERT INTO restaurants
      (id, name, address, phone, email, tables_count, rooms_count,
       is_delivery, features_json, raw_json, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name          = excluded.name,
      address       = excluded.address,
      phone         = excluded.phone,
      email         = excluded.email,
      tables_count  = excluded.tables_count,
      rooms_count   = excluded.rooms_count,
      is_delivery   = excluded.is_delivery,
      features_json = excluded.features_json,
      raw_json      = excluded.raw_json,
      synced_at     = excluded.synced_at
  `).run(
    data.id || data._id,
    data.name,
    data.address   ?? null,
    data.phone     ?? null,
    data.email     ?? null,
    data.tables    ?? data.tables_count    ?? 0,
    data.rooms     ?? data.rooms_count     ?? 0,
    data.isDeliveryAvailable ? 1 : 0,
    JSON.stringify(data.features ?? {}),
    JSON.stringify(data),
    new Date().toISOString(),
  );
}

function getRestaurant(id) {
  if (!ready) return null;
  return db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id) ?? null;
}

// ─── Menu repository ──────────────────────────────────────────────────────────

/**
 * Replace all menu items for a restaurant in a single transaction.
 * Items present locally but absent from server array are marked available=0.
 */
function upsertMenuItems(restaurantId, items) {
  if (!ready) throw new Error('offline-db not ready');
  if (!Array.isArray(items) || items.length === 0) return;

  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO menu_items
      (id, restaurant_id, name, price, category, is_veg,
       description, image_url, available, display_order, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name          = excluded.name,
      price         = excluded.price,
      category      = excluded.category,
      is_veg        = excluded.is_veg,
      description   = excluded.description,
      image_url     = excluded.image_url,
      available     = excluded.available,
      display_order = excluded.display_order,
      synced_at     = excluded.synced_at
  `);

  const incomingIds = new Set(items.map(i => i._id || i.id));

  // Disable items that no longer appear in the server list
  const existingIds = db.prepare(
    'SELECT id FROM menu_items WHERE restaurant_id = ?'
  ).all(restaurantId).map(r => r.id);

  const disableStmt = db.prepare(
    "UPDATE menu_items SET available = 0, synced_at = ? WHERE id = ?"
  );

  const doAll = db.transaction(() => {
    for (const item of items) {
      upsert.run(
        item._id || item.id,
        restaurantId,
        item.name,
        parseFloat(item.price) || 0,
        item.category  ?? null,
        item.isVeg     ? 1 : 0,
        item.description ?? null,
        item.image     ?? item.imageUrl ?? null,
        item.available !== false ? 1 : 0,
        item.displayOrder ?? 0,
        now,
      );
    }
    // Mark removed items as unavailable
    for (const existingId of existingIds) {
      if (!incomingIds.has(existingId)) {
        disableStmt.run(now, existingId);
      }
    }
  });

  doAll();
}

function getMenuItems(restaurantId, { availableOnly = true } = {}) {
  if (!ready) return [];
  const sql = availableOnly
    ? 'SELECT * FROM menu_items WHERE restaurant_id = ? AND available = 1 ORDER BY category, display_order, name'
    : 'SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY category, display_order, name';
  return db.prepare(sql).all(restaurantId);
}

function getMenuCategories(restaurantId) {
  if (!ready) return [];
  return db.prepare(
    'SELECT DISTINCT category FROM menu_items WHERE restaurant_id = ? AND available = 1 AND category IS NOT NULL ORDER BY category'
  ).all(restaurantId).map(r => r.category);
}

function setMenuItemAvailable(id, available) {
  if (!ready) return;
  db.prepare('UPDATE menu_items SET available = ?, synced_at = ? WHERE id = ?')
    .run(available ? 1 : 0, new Date().toISOString(), id);
}

// ─── Tables config repository ─────────────────────────────────────────────────

/**
 * Generate table config rows from a count (e.g. restaurant.tables = 10).
 * Called during sync; existing rows are updated, new ones inserted.
 */
function upsertTablesConfig(restaurantId, tableCount, roomCount = 0) {
  if (!ready) throw new Error('offline-db not ready');
  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT INTO tables_config (restaurant_id, table_number, table_type, label, is_active, synced_at)
    VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT(restaurant_id, table_number, table_type) DO UPDATE SET
      is_active = 1,
      synced_at = excluded.synced_at
  `);

  const doAll = db.transaction(() => {
    for (let i = 1; i <= tableCount; i++) {
      upsert.run(restaurantId, i, 'dine-in', `Table ${i}`, now);
    }
    for (let i = 1; i <= roomCount; i++) {
      upsert.run(restaurantId, i, 'room', `Room ${i}`, now);
    }
  });

  doAll();
}

function getTablesConfig(restaurantId) {
  if (!ready) return [];
  return db.prepare(
    'SELECT * FROM tables_config WHERE restaurant_id = ? AND is_active = 1 ORDER BY table_type, table_number'
  ).all(restaurantId);
}

// ─── Offline orders repository (Phase 3) ─────────────────────────────────────
// Schema is ready; create/update logic added in Phase 3.

function createOfflineOrder(order, items) {
  if (!ready) throw new Error('offline-db not ready');
  // order = { id, restaurantId, tableNumber, orderType, customerName, totalAmount, ... }
  // items = [{ id, menuItemId, nameSnapshot, priceSnapshot, quantity, lineTotal }, ...]

  const insertOrder = db.prepare(`
    INSERT INTO offline_orders
      (id, server_id, restaurant_id, table_number, room_number, order_type,
       customer_name, customer_phone, delivery_address, total_amount,
       packaging_charge, delivery_charge, payment_method, payment_status,
       source, local_status, created_by_staff_id, created_at, updated_at, notes)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'LOCAL_PENDING', ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO offline_order_items
      (id, order_id, menu_item_id, name_snapshot, price_snapshot, quantity, line_total, is_complimentary, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const doAll = db.transaction(() => {
    insertOrder.run(
      order.id,
      order.restaurantId,
      order.tableNumber   ?? null,
      order.roomNumber    ?? null,
      order.orderType     ?? 'dine-in',
      order.customerName  ?? null,
      order.customerPhone ?? null,
      order.deliveryAddress ?? null,
      order.totalAmount   ?? 0,
      order.packagingCharge ?? 0,
      order.deliveryCharge  ?? 0,
      order.paymentMethod ?? 'cash',
      order.paymentStatus ?? 'pending',
      order.source        ?? 'staff',
      order.createdByStaffId ?? null,
      order.createdAt     ?? new Date().toISOString(),
      order.updatedAt     ?? new Date().toISOString(),
      order.notes         ?? null,
    );

    for (const item of items) {
      insertItem.run(
        item.id,
        order.id,
        item.menuItemId      ?? null,
        item.nameSnapshot,               // IMMUTABLE price snapshot
        item.priceSnapshot,
        item.quantity,
        item.lineTotal,
        item.isComplimentary ? 1 : 0,
        item.notes ?? null,
      );
    }
  });

  doAll();
  return order.id;
}

function getOfflineOrders(restaurantId, status = null) {
  if (!ready) return [];
  if (status) {
    return db.prepare(
      'SELECT * FROM offline_orders WHERE restaurant_id = ? AND local_status = ? ORDER BY created_at DESC'
    ).all(restaurantId, status);
  }
  return db.prepare(
    'SELECT * FROM offline_orders WHERE restaurant_id = ? ORDER BY created_at DESC'
  ).all(restaurantId);
}

/**
 * Get offline orders matching any of the given statuses (array).
 * Used by doPoll to show all in-flight orders while uploads are pending.
 */
function getOfflineOrdersByStatuses(restaurantId, statuses) {
  if (!ready) return [];
  if (!Array.isArray(statuses) || statuses.length === 0) return [];
  const placeholders = statuses.map(() => '?').join(', ');
  return db.prepare(
    `SELECT * FROM offline_orders WHERE restaurant_id = ? AND local_status IN (${placeholders}) ORDER BY created_at DESC`
  ).all(restaurantId, ...statuses);
}

function getOfflineOrderItems(orderId) {
  if (!ready) return [];
  return db.prepare(
    'SELECT * FROM offline_order_items WHERE order_id = ? ORDER BY rowid'
  ).all(orderId);
}

function updateOfflineOrderStatus(id, localStatus) {
  if (!ready) return;
  db.prepare(
    "UPDATE offline_orders SET local_status = ?, updated_at = ? WHERE id = ?"
  ).run(localStatus, new Date().toISOString(), id);
}

function setServerOrderId(localId, serverId) {
  if (!ready) return;
  db.prepare(
    "UPDATE offline_orders SET server_id = ?, local_status = 'UPLOADED', updated_at = ? WHERE id = ?"
  ).run(serverId, new Date().toISOString(), localId);
}

/**
 * Delete a single offline order (cancel) by its local UUID.
 * Also removes its items and any pending sync_queue entry.
 */
function deleteOfflineOrder(orderId) {
  if (!ready) throw new Error('offline-db not ready');
  const doAll = db.transaction(() => {
    db.prepare('DELETE FROM offline_order_items WHERE order_id = ?').run(orderId);
    db.prepare("DELETE FROM sync_queue WHERE entity_id = ? AND entity_type = 'order'").run(orderId);
    db.prepare('DELETE FROM offline_orders WHERE id = ?').run(orderId);
  });
  doAll();
}

/**
 * Mark offline orders for a table as COMPLETED_OFFLINE (clear table offline).
 * Instead of deleting, we:
 *   1. Update local_status → 'COMPLETED_OFFLINE' with payment info
 *   2. Enqueue a 'COMPLETE' operation so upload-engine can push to server
 * This ensures cleared offline orders appear in order history when back online.
 *
 * @returns {string[]} IDs of orders that were marked completed
 */
function completeOfflineTable(restaurantId, tableNumber, paymentMethod = 'cash') {
  if (!ready) throw new Error('offline-db not ready');
  const now = new Date().toISOString();

  // Find all non-uploaded orders for this table
  const orders = db.prepare(
    `SELECT id FROM offline_orders
     WHERE restaurant_id = ? AND table_number = ?
       AND local_status IN ('LOCAL_PENDING','LOCAL_CONFIRMED','PENDING_UPLOAD','UPLOAD_FAILED','UPLOAD_UNKNOWN')`
  ).all(restaurantId, String(tableNumber));

  const ids = orders.map(o => o.id);
  if (ids.length === 0) return ids;

  const doAll = db.transaction(() => {
    for (const id of ids) {
      // Update status and payment method
      db.prepare(
        `UPDATE offline_orders
         SET local_status = 'COMPLETED_OFFLINE', payment_method = ?, payment_status = 'paid', updated_at = ?
         WHERE id = ?`
      ).run(paymentMethod, now, id);

      // Remove any existing CREATE queue entry (we'll replace with COMPLETE)
      db.prepare(
        `DELETE FROM sync_queue WHERE entity_id = ? AND entity_type = 'order' AND operation = 'CREATE' AND status IN ('PENDING','FAILED')`
      ).run(id);

      // Enqueue COMPLETE operation — upload-engine will POST to server as completed order
      db.prepare(
        `INSERT INTO sync_queue
           (entity_type, entity_id, operation, payload_json, status, attempt_count, created_at, updated_at)
         VALUES ('order', ?, 'COMPLETE', ?, 'PENDING', 0, ?, ?)`
      ).run(id, JSON.stringify({ orderId: id, restaurantId, tableNumber: String(tableNumber), paymentMethod }), now, now);
    }
  });
  doAll();
  return ids;
}

/**
 * Delete ALL offline orders for a given table (hard cancel — no history).
 * Use only when the order was never placed and should leave no trace.
 * For "clear table" (checkout), use completeOfflineTable() instead.
 */
function clearOfflineTable(restaurantId, tableNumber) {
  if (!ready) throw new Error('offline-db not ready');
  const orders = db.prepare(
    "SELECT id FROM offline_orders WHERE restaurant_id = ? AND table_number = ? AND local_status IN ('LOCAL_PENDING','LOCAL_CONFIRMED','PENDING_UPLOAD','UPLOAD_FAILED')"
  ).all(restaurantId, String(tableNumber));
  const ids = orders.map(o => o.id);
  const doAll = db.transaction(() => {
    for (const id of ids) {
      db.prepare('DELETE FROM offline_order_items WHERE order_id = ?').run(id);
      db.prepare("DELETE FROM sync_queue WHERE entity_id = ? AND entity_type = 'order'").run(id);
      db.prepare('DELETE FROM offline_orders WHERE id = ?').run(id);
    }
  });
  doAll();
  return ids;
}

// ─── Sync queue repository (Phase 4) ─────────────────────────────────────────

function enqueue(entityType, entityId, operation, payloadJson) {
  if (!ready) throw new Error('offline-db not ready');
  const now = new Date().toISOString();
  return db.prepare(`
    INSERT INTO sync_queue
      (entity_type, entity_id, operation, payload_json, status,
       attempt_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'PENDING', 0, ?, ?)
  `).run(entityType, entityId, operation, payloadJson ?? null, now, now).lastInsertRowid;
}

function getPendingQueue() {
  if (!ready) return [];
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT * FROM sync_queue
    WHERE status IN ('PENDING', 'FAILED')
      AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
    ORDER BY id ASC
    LIMIT 50
  `).all(now);
}

function markQueueItem(id, status, serverResponse = null, errorMessage = null) {
  if (!ready) return;
  const now = new Date().toISOString();
  // Exponential backoff: 30s, 60s, 120s, 300s, 600s
  const backoffSeconds = [30, 60, 120, 300, 600];
  const item = db.prepare('SELECT attempt_count FROM sync_queue WHERE id = ?').get(id);
  const attempts = (item?.attempt_count ?? 0) + 1;
  const delay    = backoffSeconds[Math.min(attempts - 1, backoffSeconds.length - 1)];
  const nextAt   = status === 'FAILED'
    ? new Date(Date.now() + delay * 1000).toISOString()
    : null;

  db.prepare(`
    UPDATE sync_queue SET
      status          = ?,
      attempt_count   = ?,
      last_attempt_at = ?,
      next_attempt_at = ?,
      server_response = ?,
      error_message   = ?,
      updated_at      = ?
    WHERE id = ?
  `).run(status, attempts, now, nextAt, serverResponse, errorMessage, now, id);
}

function getQueueItem(id) {
  if (!ready) return null;
  return db.prepare('SELECT * FROM sync_queue WHERE id = ?').get(id) ?? null;
}

// ─── Sync log (append-only audit) ────────────────────────────────────────────

function appendSyncLog(direction, entityType, entityId, operation, result, detail = null) {
  if (!ready) return;
  db.prepare(`
    INSERT INTO sync_log (direction, entity_type, entity_id, operation, result, detail, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(direction, entityType, entityId ?? null, operation ?? null, result, detail ?? null, new Date().toISOString());
}

// ─── Staff credential cache (offline login) ──────────────────────────────────
// Stores a hashed token + staff data so login works without internet.
// Security: we store the JWT token (not the password) — same security level
// as localStorage where the token already lives.

function cacheStaffCredentials(staffData, token) {
  if (!ready) return;
  db.prepare(`
    INSERT INTO sync_meta (entity_type, last_synced_at, last_server_hash, sync_count, last_error)
    VALUES ('staff_cache_' || ?, ?, ?, 1, NULL)
    ON CONFLICT(entity_type) DO UPDATE SET
      last_synced_at   = excluded.last_synced_at,
      last_server_hash = excluded.last_server_hash,
      sync_count       = sync_count + 1
  `).run(
    staffData.email || staffData._id || 'unknown',
    new Date().toISOString(),
    JSON.stringify({ staffData, token }),
  );
}

function getCachedStaffCredentials(email) {
  if (!ready) return null;
  const key = 'staff_cache_' + email;
  const row = db.prepare('SELECT last_server_hash FROM sync_meta WHERE entity_type = ?').get(key);
  if (!row?.last_server_hash) return null;
  try { return JSON.parse(row.last_server_hash); } catch { return null; }
}

module.exports = {
  // Lifecycle
  init,
  close,
  getStatus,

  // Helpers
  isReady: () => ready,

  // Device
  getDeviceId,

  // Sync metadata
  getSyncMeta,
  setSyncMeta,

  // Restaurant
  upsertRestaurant,
  getRestaurant,

  // Menu
  upsertMenuItems,
  getMenuItems,
  getMenuCategories,
  setMenuItemAvailable,

  // Tables
  upsertTablesConfig,
  getTablesConfig,

  // Offline orders (Phase 3)
  createOfflineOrder,
  getOfflineOrders,
  getOfflineOrdersByStatuses,
  getOfflineOrderItems,
  updateOfflineOrderStatus,
  setServerOrderId,
  deleteOfflineOrder,
  clearOfflineTable,
  completeOfflineTable,

  // Sync queue (Phase 4)
  enqueue,
  getPendingQueue,
  markQueueItem,
  getQueueItem,

  // Audit log
  appendSyncLog,

  // Staff credential cache (offline login)
  cacheStaffCredentials,
  getCachedStaffCredentials,
};
