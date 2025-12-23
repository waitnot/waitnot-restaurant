import { initDB, adminDB } from './db.js';

async function createDefaultAdmin() {
  try {
    console.log('🚀 Creating default admin account...');
    
    // Initialize database
    await initDB();
    
    // Check if admin already exists
    const existingAdmin = await adminDB.findOne({ username: 'admin' });
    if (existingAdmin) {
      console.log('✅ Default admin already exists');
      console.log('   Username:', existingAdmin.username);
      console.log('   Email:', existingAdmin.email);
      return;
    }
    
    // Create default admin
    const defaultAdmin = {
      username: 'admin',
      email: 'admin@waitnot.com',
      password: 'admin123',
      fullName: 'System Administrator',
      role: 'admin'
    };
    
    const admin = await adminDB.create(defaultAdmin);
    
    console.log('✅ Default admin created successfully!');
    console.log('   Username:', admin.username);
    console.log('   Email:', admin.email);
    console.log('   Full Name:', admin.fullName);
    console.log('\n🔐 Login credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   URL: /admin-login');
    
  } catch (error) {
    console.error('❌ Error creating admin:', error);
  } finally {
    process.exit(0);
  }
}

createDefaultAdmin();