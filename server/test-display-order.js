import { restaurantDB } from './db.js';
import { initDatabase } from './database/connection.js';

async function testDisplayOrder() {
  try {
    console.log('🧪 Testing display_order functionality...');
    
    await initDatabase();
    
    // Get all restaurants to find one with menu items
    const restaurants = await restaurantDB.findAll();
    
    if (restaurants.length === 0) {
      console.log('❌ No restaurants found');
      return;
    }
    
    const restaurantWithMenu = restaurants.find(r => r.menu && r.menu.length > 0);
    
    if (!restaurantWithMenu) {
      console.log('❌ No restaurant with menu items found');
      return;
    }
    
    console.log(`✅ Found restaurant: ${restaurantWithMenu.name}`);
    console.log(`📋 Menu items (${restaurantWithMenu.menu.length} items):`);
    
    restaurantWithMenu.menu.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name} (displayOrder: ${item.displayOrder || 'undefined'})`);
    });
    
    console.log('🎉 Display order test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDisplayOrder();