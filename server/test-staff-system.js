import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testStaffSystem() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing staff management system...');
    
    // Get a restaurant ID
    const restaurantResult = await client.query('SELECT id FROM restaurants LIMIT 1');
    
    if (restaurantResult.rows.length === 0) {
      console.log('❌ No restaurants found. Please create a restaurant first.');
      return;
    }
    
    const restaurantId = restaurantResult.rows[0].id;
    console.log(`📍 Using restaurant ID: ${restaurantId}`);
    
    // Create sample staff members
    const staffMembers = [
      {
        name: 'John Manager',
        email: 'manager@restaurant.com',
        phone: '+1234567890',
        password: 'password123',
        role: 'manager'
      },
      {
        name: 'Sarah Cashier',
        email: 'cashier@restaurant.com',
        phone: '+1234567891',
        password: 'password123',
        role: 'cashier'
      },
      {
        name: 'Mike Waiter',
        email: 'waiter@restaurant.com',
        phone: '+1234567892',
        password: 'password123',
        role: 'waiter'
      },
      {
        name: 'Chef David',
        email: 'kitchen@restaurant.com',
        phone: '+1234567893',
        password: 'password123',
        role: 'kitchen'
      }
    ];
    
    // Staff roles and permissions
    const STAFF_ROLES = {
      manager: {
        permissions: {
          orders: { view: true, edit: true, delete: true },
          menu: { view: true, edit: true, delete: true },
          staff: { view: true, edit: true, delete: true },
          analytics: { view: true },
          settings: { view: true, edit: true }
        }
      },
      cashier: {
        permissions: {
          orders: { view: true, edit: true, delete: false },
          menu: { view: true, edit: false, delete: false },
          staff: { view: false, edit: false, delete: false },
          analytics: { view: false },
          settings: { view: false, edit: false }
        }
      },
      waiter: {
        permissions: {
          orders: { view: true, edit: true, delete: false },
          menu: { view: true, edit: false, delete: false },
          staff: { view: false, edit: false, delete: false },
          analytics: { view: false },
          settings: { view: false, edit: false }
        }
      },
      kitchen: {
        permissions: {
          orders: { view: true, edit: true, delete: false },
          menu: { view: true, edit: false, delete: false },
          staff: { view: false, edit: false, delete: false },
          analytics: { view: false },
          settings: { view: false, edit: false }
        }
      }
    };
    
    for (const staff of staffMembers) {
      try {
        // Check if staff already exists
        const existingStaff = await client.query(
          'SELECT id FROM staff WHERE email = $1',
          [staff.email]
        );
        
        if (existingStaff.rows.length > 0) {
          console.log(`⚠️  Staff member ${staff.email} already exists, skipping...`);
          continue;
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(staff.password, 10);
        
        // Get role permissions
        const permissions = STAFF_ROLES[staff.role].permissions;
        
        // Insert staff member
        const result = await client.query(`
          INSERT INTO staff (restaurant_id, name, email, phone, password, role, permissions)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, name, email, role
        `, [restaurantId, staff.name, staff.email, staff.phone, hashedPassword, staff.role, JSON.stringify(permissions)]);
        
        console.log(`✅ Created staff member: ${result.rows[0].name} (${result.rows[0].role})`);
      } catch (error) {
        console.error(`❌ Error creating staff member ${staff.name}:`, error.message);
      }
    }
    
    // Display login credentials
    console.log('\n🔑 Staff Login Credentials:');
    console.log('==========================');
    for (const staff of staffMembers) {
      console.log(`${staff.role.toUpperCase()}: ${staff.email} / password123`);
    }
    
    console.log('\n🎉 Staff system test completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Visit http://localhost:3000/staff-login');
    console.log('2. Login with any of the credentials above');
    console.log('3. Test the staff dashboard functionality');
    console.log('4. Visit restaurant dashboard to manage staff');
    
  } catch (error) {
    console.error('❌ Error testing staff system:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the test
testStaffSystem()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });