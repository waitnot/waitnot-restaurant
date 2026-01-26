import { initDB, restaurantDB } from './db.js';

async function addNewFeatures() {
  try {
    console.log('🔄 Adding new features to existing restaurants...');
    
    // Initialize database connection
    await initDB();
    
    // Get all restaurants
    const restaurants = await restaurantDB.findAll();
    console.log(`📊 Found ${restaurants.length} restaurants`);
    
    // Complete feature set with proper defaults
    const completeFeatures = {
      // Core Features - All enabled by default
      menuManagement: true,
      orderManagement: true,
      qrCodeGeneration: true,
      tableManagement: true,
      
      // Analytics - All enabled by default
      analytics: true,
      orderHistory: true,
      salesReports: true,
      
      // Settings - Mixed defaults
      profileEdit: false, // Disabled by default for security
      printerSettings: true,
      
      // Operations - Mixed defaults
      deliveryToggle: false, // Disabled by default - restaurant choice
      deliveryOrders: true,
      realTimeOrders: true,
      notifications: true,
      thirdPartyOrders: true,
      staffOrders: true,
      
      // Security - Disabled by default
      passwordChange: false, // Admin controlled
      
      // Media - Enabled by default
      imageUpload: true,
      
      // Menu Features - All enabled by default
      menuCategories: true,
      menuItemToggle: true,
      
      // Customer Management - All enabled by default
      customerInfo: true,
      customerFeedback: true,
      
      // Advanced - Mixed defaults
      bulkOperations: true,
      exportData: true,
      multiLanguage: false // Disabled by default - complex feature
    };
    
    // Update each restaurant
    for (const restaurant of restaurants) {
      console.log(`🔄 Updating features for: ${restaurant.name}`);
      
      // Merge existing features with complete feature set
      const updatedFeatures = {
        ...completeFeatures, // Start with complete defaults
        ...restaurant.features // Override with existing settings
      };
      
      // Update restaurant features
      await restaurantDB.update(restaurant._id, {
        features: updatedFeatures
      });
      
      console.log(`✅ Updated features for: ${restaurant.name}`);
    }
    
    console.log('🎉 All restaurants updated with complete feature set!');
    console.log('📊 Complete features added:');
    console.log('   ✅ Core Features: Menu Management, Order Management, QR Codes, Table Management');
    console.log('   ✅ Analytics: Dashboard, Order History, Sales Reports');
    console.log('   ✅ Settings: Profile Edit (disabled), Printer Settings');
    console.log('   ✅ Operations: Delivery Toggle (disabled), Delivery Orders, Real-time Orders, Notifications');
    console.log('   ✅ Third-Party: Swiggy, Zomato, Uber Eats integration');
    console.log('   ✅ Staff Orders: Phone/walk-in order management');
    console.log('   ✅ Security: Password Change (disabled by default)');
    console.log('   ✅ Media: Image Upload');
    console.log('   ✅ Menu Features: Categories, Item Toggle');
    console.log('   ✅ Customer Management: Customer Info, Feedback');
    console.log('   ✅ Advanced: Bulk Operations, Data Export, Multi-language (disabled)');
    
  } catch (error) {
    console.error('❌ Error adding new features:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

addNewFeatures();