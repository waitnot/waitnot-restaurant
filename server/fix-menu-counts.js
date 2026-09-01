import { query } from './database/connection.js';

async function fixMenuCounts() {
  try {
    console.log('🔧 Fixing menu item counts...\n');
    
    // Get restaurant ID
    const restaurantResult = await query(`
      SELECT id, name FROM restaurants WHERE email = 'king@gmail.com'
    `);
    
    if (restaurantResult.rows.length === 0) {
      console.log('❌ Restaurant not found');
      return;
    }
    
    const restaurant = restaurantResult.rows[0];
    console.log(`🏪 Fixing menu for: ${restaurant.name}\n`);
    
    // 1. Mark excess menu items as unavailable (keep only first 20 items per category)
    console.log('1️⃣ Marking excess menu items as unavailable...');
    
    const categories = ['Starters', 'Main Course', 'Bread', 'Beverages', 'Desserts'];
    let totalMarkedUnavailable = 0;
    
    for (const category of categories) {
      // Keep only first 5 items per category, mark rest as unavailable
      const markUnavailableQuery = `
        UPDATE menu_items 
        SET available = false 
        WHERE restaurant_id = $1 
        AND category = $2 
        AND id NOT IN (
          SELECT id FROM menu_items 
          WHERE restaurant_id = $1 AND category = $2 
          ORDER BY created_at 
          LIMIT 5
        )
      `;
      
      const result = await query(markUnavailableQuery, [restaurant.id, category]);
      console.log(`   ${category}: Marked ${result.rowCount} items as unavailable`);
      totalMarkedUnavailable += result.rowCount;
    }
    
    // 2. Show current counts
    console.log('\n📊 Current Menu Status:');
    
    const statusQuery = `
      SELECT 
        category,
        COUNT(*) as total,
        COUNT(CASE WHEN available = true THEN 1 END) as available,
        COUNT(CASE WHEN available = false THEN 1 END) as unavailable
      FROM menu_items 
      WHERE restaurant_id = $1 
      GROUP BY category
      ORDER BY category
    `;
    
    const statusResult = await query(statusQuery, [restaurant.id]);
    
    statusResult.rows.forEach(row => {
      console.log(`   ${row.category}: ${row.available} available, ${row.unavailable} hidden`);
    });
    
    const totalQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN available = true THEN 1 END) as available
      FROM menu_items 
      WHERE restaurant_id = $1
    `;
    
    const totalResult = await query(totalQuery, [restaurant.id]);
    const totals = totalResult.rows[0];
    
    console.log(`\n   📋 Total: ${totals.available} available items (${totals.total} total)`);
    
    console.log('\n✅ Menu counts fixed! Only available items will show in the dashboard.');
    console.log('🔄 Refresh your restaurant dashboard to see the updated counts.');
    
  } catch (error) {
    console.error('❌ Error fixing menu counts:', error);
  } finally {
    process.exit(0);
  }
}

fixMenuCounts();