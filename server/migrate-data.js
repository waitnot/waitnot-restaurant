import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, query, withTransaction } from './database/connection.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readJSONData(filename) {
  try {
    const filePath = path.join(__dirname, 'data', filename);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.log(`No ${filename} found or error reading:`, error.message);
    return [];
  }
}

async function migrateRestaurants() {
  console.log('🔄 Migrating restaurants...');
  
  const restaurants = await readJSONData('restaurants.json');
  console.log(`Found ${restaurants.length} restaurants to migrate`);
  
  for (const restaurant of restaurants) {
    try {
      // Hash password if it exists and isn't already hashed
      let hashedPassword = restaurant.password;
      if (hashedPassword && !hashedPassword.startsWith('$2a$')) {
        hashedPassword = await bcrypt.hash(hashedPassword, 10);
      }
      
      // Insert restaurant
      const restaurantResult = await query(`
        INSERT INTO restaurants (
          id, name, description, image, rating, delivery_time, cuisine, 
          address, phone, email, password, is_delivery_available, tables,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          image = EXCLUDED.image,
          rating = EXCLUDED.rating,
          delivery_time = EXCLUDED.delivery_time,
          cuisine = EXCLUDED.cuisine,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          is_delivery_available = EXCLUDED.is_delivery_available,
          tables = EXCLUDED.tables,
          updated_at = EXCLUDED.updated_at
        RETURNING id
      `, [
        restaurant._id,
        restaurant.name,
        restaurant.description,
        restaurant.image,
        restaurant.rating || 0,
        restaurant.deliveryTime,
        restaurant.cuisine || [],
        restaurant.address,
        restaurant.phone,
        restaurant.email,
        hashedPassword,
        restaurant.isDeliveryAvailable !== false,
        restaurant.tables || 0,
        restaurant.createdAt || new Date().toISOString(),
        restaurant.updatedAt || new Date().toISOString()
      ]);
      
      const restaurantId = restaurantResult.rows[0].id;
      
      // Migrate menu items
      if (restaurant.menu && restaurant.menu.length > 0) {
        console.log(`  Migrating ${restaurant.menu.length} menu items for ${restaurant.name}`);
        
        for (const menuItem of restaurant.menu) {
          await query(`
            INSERT INTO menu_items (
              id, restaurant_id, name, price, category, is_veg, 
              description, image, available, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              price = EXCLUDED.price,
              category = EXCLUDED.category,
              is_veg = EXCLUDED.is_veg,
              description = EXCLUDED.description,
              image = EXCLUDED.image,
              available = EXCLUDED.available,
              updated_at = EXCLUDED.updated_at
          `, [
            menuItem._id,
            restaurantId,
            menuItem.name,
            menuItem.price,
            menuItem.category,
            menuItem.isVeg !== false,
            menuItem.description,
            menuItem.image,
            menuItem.available !== false,
            menuItem.createdAt || new Date().toISOString(),
            menuItem.updatedAt || new Date().toISOString()
          ]);
        }
      }
      
      console.log(`✅ Migrated restaurant: ${restaurant.name}`);
      
    } catch (error) {
      console.error(`❌ Error migrating restaurant ${restaurant.name}:`, error);
    }
  }
}

async function migrateOrders() {
  console.log('🔄 Migrating orders...');
  
  const orders = await readJSONData('orders.json');
  console.log(`Found ${orders.length} orders to migrate`);
  
  for (const order of orders) {
    try {
      await withTransaction(async (client) => {
        // Insert order
        const orderResult = await client.query(`
          INSERT INTO orders (
            id, restaurant_id, table_number, customer_name, customer_phone,
            delivery_address, order_type, status, payment_method, payment_status,
            total_amount, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            restaurant_id = EXCLUDED.restaurant_id,
            table_number = EXCLUDED.table_number,
            customer_name = EXCLUDED.customer_name,
            customer_phone = EXCLUDED.customer_phone,
            delivery_address = EXCLUDED.delivery_address,
            order_type = EXCLUDED.order_type,
            status = EXCLUDED.status,
            payment_method = EXCLUDED.payment_method,
            payment_status = EXCLUDED.payment_status,
            total_amount = EXCLUDED.total_amount,
            updated_at = EXCLUDED.updated_at
          RETURNING id
        `, [
          order._id,
          order.restaurantId,
          order.tableNumber,
          order.customerName,
          order.customerPhone,
          order.deliveryAddress,
          order.type || order.orderType || 'dine-in',
          order.status || 'pending',
          order.paymentMethod || 'cash',
          order.paymentStatus || 'pending',
          order.total || order.totalAmount || 0,
          order.createdAt || new Date().toISOString(),
          order.updatedAt || new Date().toISOString()
        ]);
        
        const orderId = orderResult.rows[0].id;
        
        // Delete existing order items for this order (in case of re-migration)
        await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
        
        // Insert order items
        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            await client.query(`
              INSERT INTO order_items (
                order_id, menu_item_id, name, price, quantity, printed_to_kitchen, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              orderId,
              item.menuItemId || null,
              item.name,
              item.price,
              item.quantity || 1,
              item.printedToKitchen || false,
              item.createdAt || order.createdAt || new Date().toISOString()
            ]);
          }
        }
      });
      
      console.log(`✅ Migrated order: ${order._id}`);
      
    } catch (error) {
      console.error(`❌ Error migrating order ${order._id}:`, error);
    }
  }
}

async function main() {
  try {
    console.log('🚀 Starting data migration from JSON to PostgreSQL...');
    
    // Initialize database (create tables)
    await initDatabase();
    
    // Migrate data
    await migrateRestaurants();
    await migrateOrders();
    
    console.log('✅ Data migration completed successfully!');
    
    // Verify migration
    const restaurantCount = await query('SELECT COUNT(*) FROM restaurants');
    const menuItemCount = await query('SELECT COUNT(*) FROM menu_items');
    const orderCount = await query('SELECT COUNT(*) FROM orders');
    const orderItemCount = await query('SELECT COUNT(*) FROM order_items');
    
    console.log('\n📊 Migration Summary:');
    console.log(`   Restaurants: ${restaurantCount.rows[0].count}`);
    console.log(`   Menu Items: ${menuItemCount.rows[0].count}`);
    console.log(`   Orders: ${orderCount.rows[0].count}`);
    console.log(`   Order Items: ${orderItemCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run migration
main();