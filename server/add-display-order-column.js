import { initDatabase, query } from './database/connection.js';

async function addDisplayOrderColumn() {
  try {
    console.log('🔄 Initializing database connection...');
    await initDatabase();
    
    console.log('🔄 Adding display_order column to menu_items table...');
    
    // Add display_order column if it doesn't exist
    await query(`
      ALTER TABLE menu_items 
      ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
    `);
    
    console.log('✅ display_order column added successfully');
    
    // Update existing menu items with sequential display_order values
    console.log('🔄 Setting display_order for existing menu items...');
    
    const result = await query(`
      WITH ordered_items AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY restaurant_id ORDER BY created_at) as row_num
        FROM menu_items
        WHERE display_order = 0 OR display_order IS NULL
      )
      UPDATE menu_items 
      SET display_order = ordered_items.row_num
      FROM ordered_items
      WHERE menu_items.id = ordered_items.id;
    `);
    
    console.log(`✅ Updated ${result.rowCount} menu items with display_order values`);
    
    // Create index for better performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_menu_items_display_order 
      ON menu_items(restaurant_id, display_order);
    `);
    
    console.log('✅ Index created for display_order column');
    
    console.log('🎉 Display order column migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error adding display_order column:', error);
    throw error;
  }
}

// Run the migration
if (import.meta.url === `file://${process.argv[1]}`) {
  addDisplayOrderColumn()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { addDisplayOrderColumn };