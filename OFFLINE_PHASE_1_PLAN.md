# OFFLINE_PHASE_1_PLAN.md
# Phase 1 — SQLite Local Database Foundation

## Objective

Establish a durable, versioned SQLite database that:
- Initialises on every app startup
- Runs migrations automatically
- Exposes typed repository functions to main.js
- Persists across application restarts and computer restarts
- Is the authoritative store for all offline-critical data going forward
- Does NOT break any existing online functionality

## Scope (Phase 1 only)

Phase 1 does NOT include:
- Synchronisation logic (Phase 2)
- Offline order creation (Phase 3)
- Upload/idempotency (Phase 4)

Phase 1 DOES include:
- SQLite installation and native rebuild for Electron 28
- Database file location and initialisation
- Schema for ALL tables needed across all phases
  (schema is created now; data population happens in later phases)
- Migration runner with version tracking
- Repository layer (typed functions, no raw SQL outside `offline-db.js`)
- Device identity generation
- Sync metadata table
- IPC handler: `offline:getStatus`
- Test: verify DB creates, persists, migrates correctly

---

## File Structure After Phase 1

```
restaurant-app/
├── main.js                    (modified — init DB on startup)
├── offline-db.js              (NEW — entire SQLite layer)
├── OFFLINE_IMPLEMENTATION_STATUS.md
├── OFFLINE_PHASE_1_PLAN.md
└── package.json               (modified — add better-sqlite3)
```

---

## Database Location

```
%APPDATA%\waitnot-staff-dashboard\waitnot-offline.db
```

Same directory as `waitnot-settings.json`. Uses `app.getPath('userData')`.

---

## Schema — All Tables (created in Phase 1, populated in later phases)

### `schema_version`
Tracks migration level. Uses SQLite `PRAGMA user_version`.

### `device_identity`
```sql
CREATE TABLE device_identity (
  id            INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton row
  device_id     TEXT NOT NULL,   -- UUID generated once, never changes
  created_at    TEXT NOT NULL
);
```

### `sync_meta`
```sql
CREATE TABLE sync_meta (
  entity_type        TEXT PRIMARY KEY,  -- 'restaurant'|'menu'|'orders'|...
  last_synced_at     TEXT,              -- ISO8601
  last_server_hash   TEXT,             -- etag / checksum for change detection
  sync_count         INTEGER DEFAULT 0,
  last_error         TEXT
);
```

### `restaurants`
```sql
CREATE TABLE restaurants (
  id               TEXT PRIMARY KEY,   -- server UUID
  name             TEXT NOT NULL,
  address          TEXT,
  phone            TEXT,
  email            TEXT,
  tables_count     INTEGER DEFAULT 0,
  rooms_count      INTEGER DEFAULT 0,
  is_delivery      INTEGER DEFAULT 0,  -- boolean
  features_json    TEXT,               -- JSON blob
  raw_json         TEXT,               -- full server response for forward-compat
  synced_at        TEXT NOT NULL
);
```

### `menu_items`
```sql
CREATE TABLE menu_items (
  id              TEXT PRIMARY KEY,    -- server UUID
  restaurant_id   TEXT NOT NULL REFERENCES restaurants(id),
  name            TEXT NOT NULL,
  price           REAL NOT NULL,
  category        TEXT,
  is_veg          INTEGER DEFAULT 0,
  description     TEXT,
  image_url       TEXT,
  available       INTEGER DEFAULT 1,  -- 0 = disabled
  display_order   INTEGER DEFAULT 0,
  synced_at       TEXT NOT NULL,
  UNIQUE(id, restaurant_id)
);
CREATE INDEX idx_menu_restaurant ON menu_items(restaurant_id, available);
CREATE INDEX idx_menu_category   ON menu_items(restaurant_id, category);
```

### `tables_config`
```sql
CREATE TABLE tables_config (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id   TEXT NOT NULL REFERENCES restaurants(id),
  table_number    INTEGER NOT NULL,
  table_type      TEXT DEFAULT 'dine-in',  -- 'dine-in'|'room'
  label           TEXT,
  is_active       INTEGER DEFAULT 1,
  synced_at       TEXT NOT NULL,
  UNIQUE(restaurant_id, table_number, table_type)
);
CREATE INDEX idx_tables_restaurant ON tables_config(restaurant_id);
```

### `offline_orders`
```sql
CREATE TABLE offline_orders (
  id                  TEXT PRIMARY KEY,     -- client-generated UUID
  server_id           TEXT,                 -- NULL until synced
  restaurant_id       TEXT NOT NULL,
  table_number        INTEGER,
  room_number         INTEGER,
  order_type          TEXT NOT NULL DEFAULT 'dine-in',
  customer_name       TEXT,
  customer_phone      TEXT,
  delivery_address    TEXT,
  total_amount        REAL NOT NULL DEFAULT 0,
  packaging_charge    REAL DEFAULT 0,
  delivery_charge     REAL DEFAULT 0,
  payment_method      TEXT DEFAULT 'cash',
  payment_status      TEXT DEFAULT 'pending',
  source              TEXT DEFAULT 'staff',
  local_status        TEXT NOT NULL DEFAULT 'LOCAL_PENDING',
  -- LOCAL_PENDING | LOCAL_CONFIRMED | PENDING_UPLOAD |
  -- UPLOADING | UPLOADED | UPLOAD_FAILED | UPLOAD_UNKNOWN
  created_by_staff_id TEXT,
  created_at          TEXT NOT NULL,        -- client timestamp ISO8601
  updated_at          TEXT NOT NULL,
  notes               TEXT
);
CREATE INDEX idx_offline_orders_restaurant ON offline_orders(restaurant_id, local_status);
CREATE INDEX idx_offline_orders_table      ON offline_orders(restaurant_id, table_number);
```

### `offline_order_items`
```sql
CREATE TABLE offline_order_items (
  id              TEXT PRIMARY KEY,   -- UUID
  order_id        TEXT NOT NULL REFERENCES offline_orders(id) ON DELETE CASCADE,
  menu_item_id    TEXT,               -- reference to menu_items.id (may be null if item removed)
  -- PRICE SNAPSHOT — immutable after creation
  name_snapshot   TEXT NOT NULL,      -- name at time of order
  price_snapshot  REAL NOT NULL,      -- price at time of order — NEVER changes
  quantity        INTEGER NOT NULL DEFAULT 1,
  line_total      REAL NOT NULL,      -- price_snapshot * quantity
  is_complimentary INTEGER DEFAULT 0,
  notes           TEXT
);
CREATE INDEX idx_order_items_order ON offline_order_items(order_id);
```

### `sync_queue`
```sql
CREATE TABLE sync_queue (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type     TEXT NOT NULL,      -- 'order'
  entity_id       TEXT NOT NULL,      -- offline_orders.id
  operation       TEXT NOT NULL,      -- 'CREATE'|'UPDATE'|'DELETE'
  payload_json    TEXT,               -- snapshot of data to send
  status          TEXT NOT NULL DEFAULT 'PENDING',
  -- PENDING | IN_PROGRESS | DONE | FAILED | UNKNOWN
  attempt_count   INTEGER DEFAULT 0,
  last_attempt_at TEXT,
  next_attempt_at TEXT,               -- for backoff scheduling
  server_response TEXT,               -- last response body (for debugging)
  error_message   TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX idx_sync_queue_status ON sync_queue(status, next_attempt_at);
```

### `sync_log`
```sql
CREATE TABLE sync_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  direction   TEXT NOT NULL,         -- 'up'|'down'
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  operation   TEXT,
  result      TEXT NOT NULL,         -- 'ok'|'error'|'skip'
  detail      TEXT,
  synced_at   TEXT NOT NULL
);
```

---

## Migration Strategy

Use `PRAGMA user_version` as migration counter:

```
PRAGMA user_version = 0   → no migrations run yet
PRAGMA user_version = 1   → migration 1 applied (initial schema)
PRAGMA user_version = 2   → future migration
```

On every startup:
1. Open DB (creates file if absent)
2. Read current `user_version`
3. Run any migrations with version > current
4. Each migration wrapped in a transaction
5. Update `user_version` after each migration
6. If any migration fails → log error, close DB safely, continue app without offline mode

---

## Repository API (exported from `offline-db.js`)

```js
// Lifecycle
offlineDb.init(userDataPath)   → opens DB, runs migrations, ensures device_id
offlineDb.close()              → closes DB safely
offlineDb.getStatus()          → { ready, dbPath, schemaVersion, deviceId, menuItemCount, ... }

// Device
offlineDb.getDeviceId()        → string UUID

// Restaurants
offlineDb.upsertRestaurant(data)
offlineDb.getRestaurant(id)

// Menu
offlineDb.upsertMenuItems(restaurantId, items[])   → transaction
offlineDb.getMenuItems(restaurantId)               → array
offlineDb.getMenuCategories(restaurantId)          → array of strings
offlineDb.setMenuItemAvailable(id, available)

// Tables
offlineDb.upsertTablesConfig(restaurantId, count, type)
offlineDb.getTablesConfig(restaurantId)

// Sync metadata
offlineDb.getSyncMeta(entityType)
offlineDb.setSyncMeta(entityType, { lastSyncedAt, lastServerHash })

// Offline orders (Phase 3)
offlineDb.createOfflineOrder(order, items[])   → transaction
offlineDb.getOfflineOrders(restaurantId, status?)
offlineDb.updateOfflineOrderStatus(id, status)
offlineDb.setServerOrderId(localId, serverId)

// Sync queue (Phase 4)
offlineDb.enqueue(entityType, entityId, operation, payload)
offlineDb.getPendingQueue()
offlineDb.markQueueItem(id, status, response?)
offlineDb.getQueueItem(id)
```

---

## IPC Handler (Phase 1)

```
offline:getStatus
→ { ready, dbPath, schemaVersion, deviceId, restaurantId?, menuItemCount, syncMeta }
```

---

## Acceptance Criteria — Phase 1

- [ ] `better-sqlite3` installs and loads without error in Electron 28
- [ ] `offlineDb.init()` creates `waitnot-offline.db` at correct path
- [ ] All tables exist after init
- [ ] `PRAGMA user_version` = 1 after first run
- [ ] DB file persists after app restart
- [ ] `getDeviceId()` returns same UUID on every restart
- [ ] Migration 1 runs exactly once; second startup skips it
- [ ] A second migration can be added and runs correctly
- [ ] `offline:getStatus` IPC returns valid status object
- [ ] No existing online functionality broken

---

## What Is NOT in Phase 1

- No data is written to menu/restaurant tables yet (Phase 2)
- No offline orders (Phase 3)
- No sync queue entries (Phase 4)
- No connectivity state machine (Phase 2)
- No UI changes

---

## Implementation Order

1. Install `better-sqlite3` + `electron-rebuild`
2. Write `offline-db.js` with schema + migrations + repositories
3. Call `offlineDb.init()` in `main.js` `app.whenReady()`
4. Add `offline:getStatus` IPC handler
5. Verify: launch app, inspect DB file, check tables, restart app, verify persistence
6. Commit
