import { query } from './database/connection.js';

async function resetMenuData() {
  try {
    console.log('🍽️ Resetting menu data to sample items...\n');
    
    // Get restaurant ID
    const restaurantResult = await query(`
      SELECT id, name FROM restaurants WHERE email = 'king@gmail.com'
    `);
    
    if (restaurantResult.rows.length === 0) {
      console.log('❌ Restaurant not found');
      return;
    }
    
    const restaurant = restaurantResult.rows[0];
    console.log(`🏪 Resetting menu for: ${restaurant.name}\n`);
    
    // 1. Delete all existing menu items
    console.log('1️⃣ Removing all existing menu items...');
    const deleteResult = await query(`
      DELETE FROM menu_items WHERE restaurant_id = $1
    `, [restaurant.id]);
    console.log(`   ✅ Removed ${deleteResult.rowCount} menu items`);
    
    // 2. Add sample menu items
    console.log('\n2️⃣ Adding sample menu items...');
    
    const sampleMenuItems = [
      { name: 'Chicken Biryani', price: 250, category: 'Main Course', description: 'Aromatic basmati rice with tender chicken', isVeg: false },
      { name: 'Mutton Biryani', price: 300, category: 'Main Course', description: 'Flavorful rice with succulent mutton pieces', isVeg: false },
      { name: 'Veg Biryani', price: 200, category: 'Main Course', description: 'Mixed vegetable biryani with aromatic spices', isVeg: true },
      { name: 'Chicken Curry', price: 180, category: 'Main Course', description: 'Spicy chicken curry with traditional spices', isVeg: false },
      { name: 'Dal Tadka', price: 120, category: 'Main Course', description: 'Yellow lentils tempered with cumin and spices', isVeg: true },
      { name: 'Paneer Butter Masala', price: 160, category: 'Main Course', description: 'Creamy paneer in rich tomato gravy', isVeg: true },
      { name: 'Naan', price: 40, category: 'Bread', description: 'Soft and fluffy Indian bread', isVeg: true },
      { name: 'Roti', price: 25, category: 'Bread', description: 'Whole wheat Indian bread', isVeg: true },
      { name: 'Garlic Naan', price: 50, category: 'Bread', description: 'Naan topped with fresh garlic', isVeg: true },
      { name: 'Samosa', price: 30, category: 'Starters', description: 'Crispy pastry filled with spiced potatoes', isVeg: true },
      { name: 'Chicken Tikka', price: 180, category: 'Starters', description: 'Grilled chicken marinated in yogurt and spices', isVeg: false },
      { name: 'Paneer Tikka', price: 150, category: 'Starters', description: 'Grilled cottage cheese with bell peppers', isVeg: true },
      { name: 'Masala Chai', price: 20, category: 'Beverages', description: 'Traditional Indian spiced tea', isVeg: true },
      { name: 'Lassi', price: 40, category: 'Beverages', description: 'Refreshing yogurt-based drink', isVeg: true },
      { name: 'Fresh Lime Soda', price: 35, category: 'Beverages', description: 'Fizzy lime drink with mint', isVeg: true },
      { name: 'Gulab Jamun', price: 60, category: 'Desserts', description: 'Sweet milk dumplings in sugar syrup', isVeg: true },
      { name: 'Kulfi', price: 50, category: 'Desserts', description: 'Traditional Indian ice cream', isVeg: true },
      { name: 'Rasgulla', price: 50, category: 'Desserts', description: 'Spongy cottage cheese balls in syrup', isVeg: true }
    ];
    
    for (const item of sampleMenuItems) {
      await query(`
        INSERT INTO menu_items (restaurant_id, name, price, category, description, is_veg, available, display_order)
        VALUES ($1, $2, $3, $4, $5, $6, true, 1)
      `, [restaurant.id, item.name, item.price, item.category, item.description, item.isVeg]);
    }
    
    console.log(`   ✅ Added ${sampleMenuItems.length} sample menu items`);
    
    // 3. Show final counts
    console.log('\n📊 Final Menu Summary:');
    
    const finalCountsQuery = `
      SELECT 
        category,
        COUNT(*) as count,
        AVG(price) as avg_price
      FROM menu_items 
      WHERE restaurant_id = $1 
      GROUP BY category
      ORDER BY category
    `;
    
    const finalResult = await query(finalCountsQuery, [restaurant.id]);
    
    finalResult.rows.forEach(row => {
      console.log(`   ${row.category}: ${row.count} items (Avg: ₹${Math.round(row.avg_price)})`);
    });
    
    const totalCountResult = await query(`
      SELECT COUNT(*) as total FROM menu_items WHERE restaurant_id = $1
    `, [restaurant.id]);
    
    console.log(`\n   Total Menu Items: ${totalCountResult.rows[0].total}`);
    
    console.log('\n✅ Menu reset completed! Your restaurant now has a clean sample menu.');
    console.log('🔄 Refresh your restaurant dashboard to see the updated menu.');
    
  } catch (error) {
    console.error('❌ Error during menu reset:', error);
  } finally {
    process.exit(0);
  }
}

resetMenuData();