import { query, initDatabase } from './database/connection.js';
import dotenv from 'dotenv';
dotenv.config();

async function addIceItems() {
  await initDatabase();

  const resResult = await query(
    `SELECT id, name FROM restaurants WHERE LOWER(name) LIKE '%impire%' LIMIT 1`
  );

  if (resResult.rows.length === 0) {
    console.log('❌ Impire Kitchen not found');
    process.exit(1);
  }

  const { id, name } = resResult.rows[0];
  console.log(`✅ Found: ${name} (${id})`);

  const iceItems = [
    { name: 'Ice 10', price: 10 },
    { name: 'Ice 20', price: 20 },
    { name: 'Ice 25', price: 25 },
    { name: 'Ice 30', price: 30 },
    { name: 'Ice 40', price: 40 },
    { name: 'Ice 45', price: 45 },
    { name: 'Ice 50', price: 50 },
    { name: 'Ice 55', price: 55 },
    { name: 'Ice 60', price: 60 },
  ];

  // Remove any existing ice items to avoid duplicates
  await query(
    `DELETE FROM menu_items WHERE restaurant_id = $1 AND LOWER(name) LIKE 'ice %'`, [id]
  );
  console.log('🧹 Cleared existing ice items');

  // Get max display order
  const orderResult = await query(
    `SELECT COALESCE(MAX(display_order), 0) as max_order FROM menu_items WHERE restaurant_id = $1`, [id]
  );
  const maxOrder = parseInt(orderResult.rows[0].max_order) || 0;

  // Add ice items
  for (let i = 0; i < iceItems.length; i++) {
    const item = iceItems[i];
    await query(
      `INSERT INTO menu_items (restaurant_id, name, price, category, is_veg, available, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, item.name, item.price, 'Ice', true, true, maxOrder + i + 1]
    );
    console.log(`   ✅ Added ${item.name}: ₹${item.price}`);
  }

  console.log(`\n✅ All ${iceItems.length} ice items added to ${name}`);
  process.exit(0);
}

addIceItems().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
