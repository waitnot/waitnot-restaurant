import { initDB, restaurantDB } from './db.js';

async function testCompleteFeatures() {
  try {
    console.log('🧪 Testing complete feature system...');
    
    // Initialize database connection
    await initDB();
    
    // Get the first restaurant
    const restaurants = await restaurantDB.findAll();
    const restaurant = restaurants[0];
    
    if (!restaurant) {
      console.log('❌ No restaurants found');
      return;
    }
    
    console.log(`📊 Testing features for: ${restaurant.name}`);
    
    // Test feature checks
    const features = restaurant.features || {};
    
    console.log('\n🔍 Complete Feature Status:');
    
    console.log('\n📋 Core Features:');
    console.log(`   📝 Menu Management: ${features.menuManagement ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   📦 Order Management: ${features.orderManagement ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   📱 QR Code Generation: ${features.qrCodeGeneration ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   🪑 Table Management: ${features.tableManagement ? '✅ Enabled' : '❌ Disabled'}`);
    
    console.log('\n📊 Analytics:');
    console.log(`   📈 Analytics Dashboard: ${features.analytics ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   📋 Order History: ${features.orderHistory ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   📊 Sales Reports: ${features.salesReports ? '✅ Enabled' : '❌ Disabled'}`);
    
    console.log('\n⚙️ Settings:');
    console.log(`   👤 Profile Editing: ${features.profileEdit ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   🖨️ Printer Settings: ${features.printerSettings ? '✅ Enabled' : '❌ Disabled'}`);
    
    console.log('\n🚀 Operations:');
    console.log(`   🚚 Delivery Toggle: ${features.deliveryToggle ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   📦 Delivery Orders: ${features.deliveryOrders ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   ⚡ Real-time Orders: ${features.realTimeOrders ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   🔔 Notifications: ${features.notifications ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   👥 Staff Orders: ${features.staffOrders ? '✅ Enabled' : '❌ Disabled'}`);
    
    console.log('\n🔐 Security:');
    console.log(`   🔑 Password Change: ${features.passwordChange ? '✅ Enabled' : '❌ Disabled'}`);
    
    console.log('\n🖼️ Media:');
    console.log(`   📸 Image Upload: ${features.imageUpload ? '✅ Enabled' : '❌ Disabled'}`);
    
    console.log('\n🍽️ Menu Features:');
    console.log(`   📂 Menu Categories: ${features.menuCategories ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   🔄 Menu Item Toggle: ${features.menuItemToggle ? '✅ Enabled' : '❌ Disabled'}`);
    
    console.log('\n👥 Customer Management:');
    console.log(`   ℹ️ Customer Information: ${features.customerInfo ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   💬 Customer Feedback: ${features.customerFeedback ? '✅ Enabled' : '❌ Disabled'}`);
    
    console.log('\n🚀 Advanced:');
    console.log(`   📦 Bulk Operations: ${features.bulkOperations ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   📤 Data Export: ${features.exportData ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   🌐 Multi-language Support: ${features.multiLanguage ? '✅ Enabled' : '❌ Disabled'}`);
    
    // Count enabled/disabled features
    const enabledCount = Object.values(features).filter(Boolean).length;
    const totalCount = Object.keys(features).length;
    const disabledCount = totalCount - enabledCount;
    
    console.log(`\n📈 Summary:`);
    console.log(`   Total Features: ${totalCount}`);
    console.log(`   ✅ Enabled: ${enabledCount}`);
    console.log(`   ❌ Disabled: ${disabledCount}`);
    
    console.log('\n✅ Complete feature system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing features:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

testCompleteFeatures();