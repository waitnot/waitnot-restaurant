import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addStaffManagement() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Adding staff management tables...');
    
    // Create staff table
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id SERIAL PRIMARY KEY,
        restaurant_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'staff',
        permissions JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create staff_sessions table for login tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_sessions (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER NOT NULL,
        session_token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
      )
    `);
    
    // Create staff_activity_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_activity_logs (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER NOT NULL,
        restaurant_id VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
      )
    `);
    
    // Add indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_restaurant_id ON staff(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
      CREATE INDEX IF NOT EXISTS idx_staff_sessions_token ON staff_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_staff_activity_restaurant ON staff_activity_logs(restaurant_id);
    `);
    
    console.log('✅ Staff management tables created successfully');
    
    // Add staff management feature to restaurants table
    await client.query(`
      UPDATE restaurants 
      SET features = COALESCE(features, '{}'::jsonb) || '{"staffManagement": true}'::jsonb
      WHERE features IS NULL OR NOT (features ? 'staffManagement')
    `);
    
    console.log('✅ Staff management feature enabled for all restaurants');
    
  } catch (error) {
    console.error('❌ Error adding staff management:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
addStaffManagement()
  .then(() => {
    console.log('🎉 Staff management setup completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });