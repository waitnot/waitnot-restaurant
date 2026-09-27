# OFFLINE_IMPLEMENTATION_STATUS.md
# WaitNot Staff Software — Offline Feature Inspection

Generated: 2026-09-27  
Codebase: waitnot-staff-dashboard v2.5.0 (Electron 28.3.3, Node 24)  
Backend: https://waitnot-restaurant.onrender.com

---

## 1. What Already Exists (Reusable)

### Desktop (Electron / main.js + renderer)

| Component | Location | Status |
|---|---|---|
| UUID-based order IDs | Server-generated UUIDs on all records | ✅ UUID format confirmed |
| Restaurant/menu cache | `localStorage['restaurant_cache_${id}']` | ✅ Exists, temporary solution |
| Staff credentials | `localStorage['staffData']`, `localStorage['staffToken']` | ✅ Exists |
| Settings persistence | `waitnot-settings.json` via custom `store` object | ✅ Works across restarts |
| Offline printing (KOT/Bill) | `printer.js` — Node `COPY /B` → Windows print queue | ✅ Fully offline-capable |
| 3s Node.js order polling | `doPoll()` in `main.js` — no CORS, no browser | ✅ Runs from Node |
| Connectivity check | Implicit — poll succeeds = online, fails = offline | ⚠️ Partial — no explicit state machine |
| `safeExecJS()` helper | `main.js` — JS with timeout, never hangs | ✅ Solid pattern |
| `nodeGet()` helper | `main.js` — Node HTTPS GET with timeout | ✅ Reusable for sync |

### React Renderer (StaffDashboard)

| Component | Status | Notes |
|---|---|---|
| Table occupied state from orders | ✅ Computed | `z.filter(t => dine-in && tableNumber === e)` |
| Order cart (se state) | ✅ In-memory | Items with price snapshots built at add-time |
| `__wn_setOrders` global | ✅ Exposed | Patched into Me() success handler |
| `__wn_refreshOrders` global | ✅ Exposed | Calls Me() re-fetch |
| Price snapshot in items | ✅ Partial | Items carry `price` at time of add, not re-read |

---

## 2. What Can Be Reused

- `nodeGet()` → use for all sync HTTP requests
- `store` (JSON settings) → keep for printer/UI settings, NOT for orders
- `printer.js` → unchanged, works offline already
- `doPoll()` → extend to write received orders into SQLite
- UUID IDs → use as basis for offline order client IDs
- `safeExecJS()` → use for all renderer communication
- Existing Axios/React order flow → untouched for online path

---

## 3. What Needs Modification

| File | Change Required |
|---|---|
| `main.js` | Add SQLite init on startup, pass DB to poll/sync |
| `main.js` `doPoll()` | Write synced orders to SQLite after fetch |
| `main.js` `startOrderPolling()` | Read from SQLite when offline instead of server |
| `main.js` IPC handlers | Add offline-order IPC handlers (Phase 3) |
| `package.json` | Add `better-sqlite3` dependency |
| `package.json` build | Add `electron-rebuild` for native module |

---

## 4. What Needs To Be Built

### Phase 1 — SQLite Foundation
- `offline-db.js` — DB init, schema, migrations, repositories
- Migration versioning (user_version pragma)
- Tables: `restaurants`, `menu_items`, `tables_config`, `sync_meta`, `sync_log`
- Tables for Phase 3+: `offline_orders`, `offline_order_items`, `sync_queue`
- Device identity (`device_id` UUID, generated once, stored in DB)
- IPC: `offline:getStatus`, `offline:getMenu`, `offline:getTables`

### Phase 2 — Server → Desktop Sync
- Full initial sync (download restaurant + menu + tables)
- Incremental sync using `updatedAt` cursor (see Backend Gaps below)
- Sync state machine: ONLINE / SYNCING / OFFLINE / SYNC_ERROR
- Sync metadata per entity type
- Product enable/disable handling
- Tombstone/soft-delete handling (requires backend change — see §6)

### Phase 3 — Offline Order Creation
- Offline order creation IPC handler
- Write to `offline_orders` + `offline_order_items` SQLite tables
- Price snapshot captured at creation time (immutable thereafter)
- Local order states: `LOCAL_PENDING` → `PENDING_UPLOAD` → `SYNCED` / `UPLOAD_FAILED`
- Surface offline orders in React via `pushOrdersToUI`

### Phase 4 — Offline Order Upload + Idempotency
- Upload engine with idempotency safeguards (see §5 — critical gap)
- Sync queue with retry + exponential backoff
- UNKNOWN state handling for network timeouts
- Crash recovery: on restart, check in-flight operations

### Phase 5+ — Conflict handling, auth hardening, monitoring

---

## 5. Backend Changes Required (Critical Gaps)

### GAP 1 — No Idempotency Support ⛔ CRITICAL

**Finding:** The server does NOT support idempotent order creation.

Tests performed:
- Same POST body sent twice → two different orders, different UUIDs, different orderNumbers
- `_id` field in request body → server ignores it, generates its own UUID
- `X-Idempotency-Key` HTTP header → server ignores it

**Risk:** A network timeout after server successfully created an order causes an
UNKNOWN result. If the client retries, a duplicate order is created.

**Required backend change:**

```
POST /api/orders
Accept: application/json
Idempotency-Key: <client-generated UUID>   ← NEW required header

Behaviour:
- First call: create order, store (Idempotency-Key → orderId), return 201
- Retry with same key: return existing order, return 200 (or 201 — idempotent)
- Key expires after: 24 hours (configurable)
- Key scope: per restaurantId
```

OR equivalently:

```
POST /api/orders
{
  ...existing fields...,
  "clientOrderId": "<UUID>"    ← NEW optional field
}

Server behaviour:
- If clientOrderId already exists for this restaurant → return existing order (200)
- If not → create, store clientOrderId → orderId mapping, return 201
```

Until this backend change is made:
- Phase 4 upload will be implemented defensively
- Network timeouts treated as UNKNOWN (not failed)
- Duplicate detection via orderNumber+tableNumber+timestamp heuristic
- Staff will be warned of UNKNOWN state; manual resolution UI in Phase 5

### GAP 2 — No Incremental Sync Support ⚠️ MODERATE

**Finding:** `?updatedAfter=` query parameter is silently ignored.
All orders are returned regardless.

**Impact:** For Phase 2, the desktop must download the full restaurant object
(194 menu items + settings) on every sync cycle. At ~300KB this is acceptable
for Phase 2 but must be fixed for production scale.

**Required backend change (deferred to Phase 6):**

```
GET /api/restaurants/:id?updatedAfter=<ISO8601>
→ Returns only fields that changed after that timestamp

GET /api/orders/restaurant/:id?updatedAfter=<ISO8601>&limit=100
→ Returns only orders updated after that timestamp (paginated)
```

**Phase 2 workaround:** Full download on each sync. Store `etag` or `updatedAt`
of restaurant record; skip processing if unchanged.

### GAP 3 — No Tombstone/Deletion Events ⚠️ MODERATE

**Finding:** No `deleted_at` or `is_deleted` field in any returned objects.
If a menu item is deleted server-side, the client has no way to know.

**Phase 2 workaround:** On each full sync, compare local menu items to server
list; items no longer present are marked `available = false` locally.

---

## 6. Database Changes Required

No schema changes to the server database are required for Phase 1 or Phase 2.

The new local SQLite database is client-side only.

For Phase 4 (idempotency), the server database needs:
- `orders.client_order_id` VARCHAR(36) UNIQUE per restaurant (nullable)
- or a separate `idempotency_keys` table

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Duplicate orders on network timeout | HIGH | Defensive UNKNOWN state; manual resolution UI |
| better-sqlite3 native rebuild fails | MEDIUM | Pin exact version; use electron-rebuild in build script |
| SQLite file corruption on crash | LOW | WAL mode; backup before migration |
| Price changed server-side during offline order | LOW | Snapshot price at order creation (immutable) |
| Full menu download too large | LOW | 194 items × ~200 bytes ≈ 40KB — acceptable |
| Multiple devices conflict on same table | MEDIUM | Document conflict strategy; Phase 5 |
| Staff JWT expires during offline period | MEDIUM | Store expiry; warn before expiry; Phase 6 |

---

## 8. Dependencies

```
better-sqlite3    ^9.4.3    Native SQLite binding for Node.js/Electron
electron-rebuild  ^3.6.0    Rebuild native modules for Electron ABI
```

No other new dependencies required for Phase 1–2.

---

## 9. Summary Table

| Capability | Status |
|---|---|
| Local SQLite database | ❌ Not built |
| Menu data persists offline | ⚠️ localStorage only (fragile) |
| Orders persists offline | ❌ Not built |
| Sync queue | ❌ Not built |
| Offline order creation | ❌ Not built |
| Offline printing | ✅ Already works |
| Idempotent upload | ❌ Backend gap |
| Incremental sync | ❌ Backend gap |
| Connectivity state machine | ⚠️ Implicit only |
| Offline authentication | ⚠️ Token stored in localStorage |
