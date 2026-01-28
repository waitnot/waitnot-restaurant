import { initDatabase, query } from './database/connection.js';

async function checkRestaurantSchema() {
  try {
    await initDatabase();
    
    const result = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'restaurants' 
      ORDER BY ordinal_position
    `);
    
    console.log('Restaurants table structure:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkRestaurantSchema();