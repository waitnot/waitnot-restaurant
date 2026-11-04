import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// DATABASE_URL is set automatically by Domain India App Platform.
// For local dev create a .env file with DATABASE_URL=postgres://...
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set. Add it in your .env or platform config.');
  process.exit(1);
}

const isLocalDB = process.env.DATABASE_URL.includes('localhost') ||
                  process.env.DATABASE_URL.includes('127.0.0.1');
const isNeon    = process.env.DATABASE_URL.includes('neon.tech');

// Database configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDB ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: isNeon ? 15000 : 5000,
  query_timeout: 60000,
  statement_timeout: 60000,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to Neon PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Keepalive ping every 4 minutes to prevent Neon cold starts
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    // silent — next real query will reconnect
  }
}, 4 * 60 * 1000);

// Clean up expired staff sessions daily (prevents unbounded table growth)
async function cleanExpiredSessions() {
  try {
    const result = await pool.query(
      `DELETE FROM staff_sessions WHERE expires_at < NOW() - INTERVAL '1 day'`
    );
    if (result.rowCount > 0) {
      console.log(`Cleaned ${result.rowCount} expired staff sessions`);
    }
  } catch (_) {}
}
cleanExpiredSessions();
setInterval(cleanExpiredSessions, 24 * 60 * 60 * 1000);


// Initialize database (create tables if they don't exist)
export async function initDatabase() {
  try {
    const client = await pool.connect();
    
    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    // Create admins table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create restaurants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        image TEXT,
        rating DECIMAL(2,1) DEFAULT 0,
        delivery_time VARCHAR(50),
        cuisine TEXT[],
        address TEXT,
        phone VARCHAR(20),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_delivery_available BOOLEAN DEFAULT true,
        tables INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create menu_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(100),
        is_veg BOOLEAN DEFAULT true,
        description TEXT,
        image TEXT,
        available BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
        order_number INTEGER,
        table_number INTEGER,
        customer_name VARCHAR(255),
        customer_phone VARCHAR(20),
        delivery_address TEXT,
        order_type VARCHAR(20) DEFAULT 'dine-in',
        status VARCHAR(20) DEFAULT 'pending',
        payment_method VARCHAR(20) DEFAULT 'cash',
        payment_status VARCHAR(20) DEFAULT 'pending',
        total_amount DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add order_number column if it doesn't exist (migration for existing DBs)
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number INTEGER
    `);

    // Add payment details columns
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_sub_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS utr_number VARCHAR(100)
    `);
    
    // Create order_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id UUID REFERENCES menu_items(id),
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        printed_to_kitchen BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_restaurants_email ON restaurants(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)');

    // Migration: add features column if missing, then set defaults
    await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}'::jsonb`);
    await client.query(`
      UPDATE restaurants
      SET features = COALESCE(features, '{}'::jsonb)
        || '{"staffManagement": true}'::jsonb
        || '{"staffOrders": true}'::jsonb
        || '{"deliveryOrders": true}'::jsonb
      WHERE features IS NULL
         OR NOT (features ? 'staffManagement')
         OR NOT (features ? 'staffOrders')
         OR NOT (features ? 'deliveryOrders')
    `);

    // ── Invoice / Archive migrations ──────────────────────────────────────────
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number INTEGER`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE`);

    // ── Menu display_order migration ──────────────────────────────────────────
    await client.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true`);
    await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS rooms INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo TEXT`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS room_number INTEGER`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'direct'`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS special_instructions TEXT`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_order_id VARCHAR(255)`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission DECIMAL(10,2) DEFAULT 0`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 0`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10,2) DEFAULT 0`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_time INTEGER`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS packaging_charge DECIMAL(10,2) DEFAULT 0`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10,2) DEFAULT 0`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0`);
    // invoice_counter: track the last used invoice number per restaurant so resets are clean
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_counters (
        restaurant_id UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
        last_invoice_number INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // order_archives: permanent record of every order ever placed (never deleted)
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_archives (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        original_order_id UUID NOT NULL,
        restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
        invoice_number INTEGER,
        order_number INTEGER,
        order_data JSONB NOT NULL,
        archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        archive_reason VARCHAR(50) DEFAULT 'deleted'
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_order_archives_restaurant ON order_archives(restaurant_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_invoice ON orders(restaurant_id, invoice_number)`);

    // Create staff tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id SERIAL PRIMARY KEY,
        restaurant_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'waiter',
        permissions JSONB DEFAULT '{}',
        waiter_number VARCHAR(10),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS waiter_number VARCHAR(10)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_sessions (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
        session_token VARCHAR(512) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_activity_logs (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
        restaurant_id VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('CREATE INDEX IF NOT EXISTS idx_staff_restaurant_id ON staff(restaurant_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_staff_sessions_token ON staff_sessions(session_token)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_staff_activity_restaurant ON staff_activity_logs(restaurant_id)');

    // Printer settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS printer_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        settings JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(restaurant_id)
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_printer_settings_restaurant_id ON printer_settings(restaurant_id)');

    // ── Customer management ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(30),
        address TEXT,
        last_order_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        order_count INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_restaurant ON customers(restaurant_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(restaurant_id, phone) WHERE phone IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(restaurant_id, LOWER(name))`);

    // ── Seed customers from existing completed orders (one-time, idempotent) ─
    await client.query(`
      INSERT INTO customers (restaurant_id, name, phone, address, order_count, last_order_at)
      SELECT
        o.restaurant_id,
        o.customer_name,
        NULLIF(TRIM(o.customer_phone), ''),
        NULLIF(TRIM(o.delivery_address), ''),
        COUNT(*),
        MAX(o.created_at)
      FROM orders o
      WHERE o.order_type IN ('delivery', 'takeaway')
        AND o.customer_name IS NOT NULL
        AND o.customer_name != ''
        AND o.customer_name NOT LIKE 'Waiter%'
        AND o.customer_name NOT LIKE 'Guest%'
        AND LENGTH(TRIM(o.customer_name)) > 1
        AND NOT EXISTS (
          SELECT 1 FROM customers c
          WHERE c.restaurant_id = o.restaurant_id
            AND (
              (c.phone IS NOT NULL AND c.phone != '' AND c.phone = NULLIF(TRIM(o.customer_phone),''))
              OR (LOWER(c.name) = LOWER(o.customer_name) AND (c.phone IS NULL OR c.phone = ''))
            )
        )
      GROUP BY o.restaurant_id, o.customer_name, o.customer_phone, o.delivery_address
    `).catch(() => {}); // ignore if already seeded

    // ── Phase 2: Staff username + PIN auth ───────────────────────────────────
    // Add username column to staff (nullable for backward compat)
    await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS username VARCHAR(50)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_username ON staff(username) WHERE username IS NOT NULL`);

    // Staff PIN credentials (hashed with bcrypt, never plaintext)
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_pins (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
        restaurant_id VARCHAR(255) NOT NULL,
        pin_hash VARCHAR(255) NOT NULL,
        failed_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(staff_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_staff_pins_staff_id ON staff_pins(staff_id)`);

    // ── Phase 3: WebAuthn / Passkeys ─────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
        restaurant_id VARCHAR(255) NOT NULL,
        credential_id TEXT UNIQUE NOT NULL,
        public_key TEXT NOT NULL,
        counter BIGINT DEFAULT 0,
        device_name VARCHAR(100) DEFAULT 'My Device',
        aaguid VARCHAR(36),
        transports JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_used TIMESTAMP WITH TIME ZONE
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webauthn_staff_id ON webauthn_credentials(staff_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webauthn_credential_id ON webauthn_credentials(credential_id)`);

    // WebAuthn challenge store (short-lived, cleaned up after use)
    await client.query(`
      CREATE TABLE IF NOT EXISTS webauthn_challenges (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
        challenge TEXT NOT NULL,
        type VARCHAR(20) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── Phase 4: Trusted devices ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS trusted_devices (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
        restaurant_id VARCHAR(255) NOT NULL,
        device_fingerprint VARCHAR(255) NOT NULL,
        device_name VARCHAR(100),
        device_type VARCHAR(50),
        last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_trusted BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trusted_devices_staff_id ON trusted_devices(staff_id)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_trusted_devices_fp ON trusted_devices(staff_id, device_fingerprint)`);

    // ── Phase 5: Refresh tokens ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) UNIQUE NOT NULL,
        device_name VARCHAR(100),
        ip_address VARCHAR(45),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE,
        revoked BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_staff_id ON refresh_tokens(staff_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)`);

    // ── Phase 6: Login audit log ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_audit_log (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(20) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        restaurant_id VARCHAR(255),
        ip_address VARCHAR(45),
        user_agent TEXT,
        session_id VARCHAR(255),
        success BOOLEAN NOT NULL DEFAULT true,
        failure_reason VARCHAR(100),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_login_audit_entity ON login_audit_log(entity_type, entity_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_login_audit_restaurant ON login_audit_log(restaurant_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_login_audit_created ON login_audit_log(created_at)`);

    // ── Phase 7: Admin TOTP (2FA) ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_totp (
        id SERIAL PRIMARY KEY,
        admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        secret_encrypted TEXT NOT NULL,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        activated_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(admin_id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_recovery_codes (
        id SERIAL PRIMARY KEY,
        admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        code_hash VARCHAR(255) NOT NULL,
        used BOOLEAN DEFAULT false,
        used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_admin_totp_admin ON admin_totp(admin_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_recovery_codes_admin ON admin_recovery_codes(admin_id)`);

    client.release();
    console.log('✅ Database tables created successfully');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// Query helper function
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text: text.substring(0, 100) + '...', duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Transaction helper
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Get a client from the pool
export async function getClient() {
  return await pool.connect();
}

// Close the pool
export async function closePool() {
  await pool.end();
}

export default pool;