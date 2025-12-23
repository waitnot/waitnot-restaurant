import { query, initDatabase, withTransaction } from './database/connection.js';
import bcrypt from 'bcryptjs';

// Initialize database
export async function initDB() {
  try {
    await initDatabase();
    console.log('✅ PostgreSQL database initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Admin operations
export const adminDB = {
  async findAll() {
    const result = await query(`
      SELECT id, username, email, full_name, role, is_active, created_at, updated_at
      FROM admins
      WHERE is_active = true
      ORDER BY created_at DESC
    `);
    
    return result.rows.map(row => ({
      _id: row.id,
      username: row.username,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  },
  
  async findById(id) {
    const result = await query(`
      SELECT id, username, email, full_name, role, is_active, created_at, updated_at
      FROM admins
      WHERE id = $1 AND is_active = true
    `, [id]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      _id: row.id,
      username: row.username,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },
  
  async findOne(queryObj) {
    const conditions = [];
    const values = [];
    let paramCount = 1;
    
    for (const [key, value] of Object.entries(queryObj)) {
      const dbField = key === 'fullName' ? 'full_name' : key;
      conditions.push(`${dbField} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
    
    const result = await query(`
      SELECT *
      FROM admins
      WHERE ${conditions.join(' AND ')} AND is_active = true
      LIMIT 1
    `, values);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      _id: row.id,
      username: row.username,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      password: row.password, // Include password for authentication
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },
  
  async create(data) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const result = await query(`
      INSERT INTO admins (username, email, password, full_name, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      data.username,
      data.email,
      hashedPassword,
      data.fullName,
      data.role || 'admin'
    ]);
    
    const row = result.rows[0];
    return {
      _id: row.id,
      username: row.username,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },
  
  async update(id, data) {
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    const fieldMapping = {
      username: 'username',
      email: 'email',
      fullName: 'full_name',
      role: 'role',
      isActive: 'is_active'
    };
    
    for (const [key, value] of Object.entries(data)) {
      if (fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }
    
    if (updateFields.length === 0) return null;
    
    values.push(id);
    const result = await query(`
      UPDATE admins 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      _id: row.id,
      username: row.username,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};

// Restaurant operations
export const restaurantDB = {
  async findAll() {
    const result = await query(`
      SELECT r.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   '_id', m.id,
                   'name', m.name,
                   'price', m.price,
                   'category', m.category,
                   'isVeg', m.is_veg,
                   'description', m.description,
                   'image', m.image,
                   'available', m.available
                 ) ORDER BY m.category, m.name
               ) FILTER (WHERE m.id IS NOT NULL), 
               '[]'::json
             ) as menu
      FROM restaurants r
      LEFT JOIN menu_items m ON r.id = m.restaurant_id
      GROUP BY r.id
      ORDER BY r.name
    `);
    
    return result.rows.map(row => ({
      _id: row.id,
      name: row.name,
      description: row.description,
      image: row.image,
      rating: parseFloat(row.rating) || 0,
      deliveryTime: row.delivery_time,
      cuisine: row.cuisine || [],
      address: row.address,
      phone: row.phone,
      email: row.email,
      password: row.password,
      isDeliveryAvailable: row.is_delivery_available,
      tables: row.tables,
      features: row.features || {},
      menu: row.menu || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  },
  
  async findById(id) {
    const result = await query(`
      SELECT r.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   '_id', m.id,
                   'name', m.name,
                   'price', m.price,
                   'category', m.category,
                   'isVeg', m.is_veg,
                   'description', m.description,
                   'image', m.image,
                   'available', m.available
                 ) ORDER BY m.category, m.name
               ) FILTER (WHERE m.id IS NOT NULL), 
               '[]'::json
             ) as menu
      FROM restaurants r
      LEFT JOIN menu_items m ON r.id = m.restaurant_id
      WHERE r.id = $1
      GROUP BY r.id
    `, [id]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      _id: row.id,
      name: row.name,
      description: row.description,
      image: row.image,
      rating: parseFloat(row.rating) || 0,
      deliveryTime: row.delivery_time,
      cuisine: row.cuisine || [],
      address: row.address,
      phone: row.phone,
      email: row.email,
      password: row.password,
      isDeliveryAvailable: row.is_delivery_available,
      tables: row.tables,
      features: row.features || {},
      menu: row.menu || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },
  
  async findOne(queryObj) {
    const conditions = [];
    const values = [];
    let paramCount = 1;
    
    for (const [key, value] of Object.entries(queryObj)) {
      conditions.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
    
    const result = await query(`
      SELECT r.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   '_id', m.id,
                   'name', m.name,
                   'price', m.price,
                   'category', m.category,
                   'isVeg', m.is_veg,
                   'description', m.description,
                   'image', m.image,
                   'available', m.available
                 ) ORDER BY m.category, m.name
               ) FILTER (WHERE m.id IS NOT NULL), 
               '[]'::json
             ) as menu
      FROM restaurants r
      LEFT JOIN menu_items m ON r.id = m.restaurant_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY r.id
      LIMIT 1
    `, values);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      _id: row.id,
      name: row.name,
      description: row.description,
      image: row.image,
      rating: parseFloat(row.rating) || 0,
      deliveryTime: row.delivery_time,
      cuisine: row.cuisine || [],
      address: row.address,
      phone: row.phone,
      email: row.email,
      password: row.password,
      isDeliveryAvailable: row.is_delivery_available,
      tables: row.tables,
      features: row.features || {},
      menu: row.menu || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },
  
  async create(data) {
    const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : null;
    
    const result = await query(`
      INSERT INTO restaurants (
        name, description, image, rating, delivery_time, cuisine, 
        address, phone, email, password, is_delivery_available, tables
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      data.name,
      data.description,
      data.image,
      data.rating || 0,
      data.deliveryTime,
      data.cuisine || [],
      data.address,
      data.phone,
      data.email,
      hashedPassword,
      data.isDeliveryAvailable !== false,
      data.tables || 0
    ]);
    
    const row = result.rows[0];
    return {
      _id: row.id,
      name: row.name,
      description: row.description,
      image: row.image,
      rating: parseFloat(row.rating) || 0,
      deliveryTime: row.delivery_time,
      cuisine: row.cuisine || [],
      address: row.address,
      phone: row.phone,
      email: row.email,
      password: row.password,
      isDeliveryAvailable: row.is_delivery_available,
      tables: row.tables,
      menu: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },
  
  async update(id, data) {
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    const fieldMapping = {
      name: 'name',
      description: 'description',
      image: 'image',
      rating: 'rating',
      deliveryTime: 'delivery_time',
      cuisine: 'cuisine',
      address: 'address',
      phone: 'phone',
      email: 'email',
      password: 'password',
      isDeliveryAvailable: 'is_delivery_available',
      tables: 'tables',
      features: 'features'
    };
    
    for (const [key, value] of Object.entries(data)) {
      if (fieldMapping[key]) {
        if (key === 'features') {
          updateFields.push(`${fieldMapping[key]} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          updateFields.push(`${fieldMapping[key]} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    }
    
    if (updateFields.length === 0) return null;
    
    values.push(id);
    const result = await query(`
      UPDATE restaurants 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) return null;
    
    return await this.findById(id);
  },
  
  async search(searchQuery) {
    if (!searchQuery) return await this.findAll();
    
    const result = await query(`
      SELECT DISTINCT r.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   '_id', m.id,
                   'name', m.name,
                   'price', m.price,
                   'category', m.category,
                   'isVeg', m.is_veg,
                   'description', m.description,
                   'image', m.image,
                   'available', m.available
                 ) ORDER BY m.category, m.name
               ) FILTER (WHERE m.id IS NOT NULL), 
               '[]'::json
             ) as menu
      FROM restaurants r
      LEFT JOIN menu_items m ON r.id = m.restaurant_id
      WHERE LOWER(r.name) LIKE LOWER($1)
         OR EXISTS (SELECT 1 FROM unnest(r.cuisine) AS c WHERE LOWER(c) LIKE LOWER($1))
         OR EXISTS (SELECT 1 FROM menu_items mi WHERE mi.restaurant_id = r.id AND LOWER(mi.name) LIKE LOWER($1))
      GROUP BY r.id
      ORDER BY r.name
    `, [`%${searchQuery}%`]);
    
    return result.rows.map(row => ({
      _id: row.id,
      name: row.name,
      description: row.description,
      image: row.image,
      rating: parseFloat(row.rating) || 0,
      deliveryTime: row.delivery_time,
      cuisine: row.cuisine || [],
      address: row.address,
      phone: row.phone,
      email: row.email,
      password: row.password,
      isDeliveryAvailable: row.is_delivery_available,
      tables: row.tables,
      menu: row.menu || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  },
  
  async addMenuItem(restaurantId, menuItem) {
    const result = await query(`
      INSERT INTO menu_items (
        restaurant_id, name, price, category, is_veg, description, image, available
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      restaurantId,
      menuItem.name,
      menuItem.price,
      menuItem.category,
      menuItem.isVeg !== false,
      menuItem.description,
      menuItem.image,
      menuItem.available !== false
    ]);
    
    return await this.findById(restaurantId);
  },
  
  async updateMenuItem(restaurantId, menuItemId, data) {
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    const fieldMapping = {
      name: 'name',
      price: 'price',
      category: 'category',
      isVeg: 'is_veg',
      description: 'description',
      image: 'image',
      available: 'available'
    };
    
    for (const [key, value] of Object.entries(data)) {
      if (fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }
    
    if (updateFields.length === 0) return null;
    
    values.push(menuItemId, restaurantId);
    const result = await query(`
      UPDATE menu_items 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount} AND restaurant_id = $${paramCount + 1}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) return null;
    
    return await this.findById(restaurantId);
  },
  
  async deleteMenuItem(restaurantId, menuItemId) {
    try {
      console.log('🗑️ Attempting to delete menu item:', menuItemId);
      
      // First, check if this menu item is referenced in any orders
      const orderItemsCheck = await query(`
        SELECT COUNT(*) as count 
        FROM order_items 
        WHERE menu_item_id = $1
      `, [menuItemId]);
      
      const orderItemsCount = parseInt(orderItemsCheck.rows[0].count);
      console.log('📊 Menu item referenced in', orderItemsCount, 'order items');
      
      if (orderItemsCount > 0) {
        console.log('⚠️ Cannot delete menu item - referenced in orders. Using soft delete instead.');
        
        // Soft delete: mark as unavailable instead of deleting
        const result = await query(`
          UPDATE menu_items 
          SET available = false, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND restaurant_id = $2
          RETURNING *
        `, [menuItemId, restaurantId]);
        
        if (result.rows.length === 0) {
          console.log('❌ Menu item not found for soft delete');
          return null;
        }
        
        console.log('✅ Menu item marked as unavailable (soft delete)');
        return await this.findById(restaurantId);
      } else {
        console.log('✅ Safe to hard delete - no order references');
        
        // Hard delete: actually remove from database
        const result = await query(`
          DELETE FROM menu_items 
          WHERE id = $1 AND restaurant_id = $2
          RETURNING *
        `, [menuItemId, restaurantId]);
        
        if (result.rows.length === 0) {
          console.log('❌ Menu item not found for deletion');
          return null;
        }
        
        console.log('✅ Menu item permanently deleted');
        return await this.findById(restaurantId);
      }
    } catch (error) {
      console.error('❌ Menu item deletion failed:', error);
      
      // If it's a foreign key constraint error, try soft delete as fallback
      if (error.message.includes('foreign key constraint') || error.message.includes('violates')) {
        console.log('🔄 Foreign key constraint detected, falling back to soft delete...');
        
        try {
          const result = await query(`
            UPDATE menu_items 
            SET available = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND restaurant_id = $2
            RETURNING *
          `, [menuItemId, restaurantId]);
          
          if (result.rows.length > 0) {
            console.log('✅ Fallback soft delete successful');
            return await this.findById(restaurantId);
          }
        } catch (fallbackError) {
          console.error('❌ Fallback soft delete also failed:', fallbackError);
        }
      }
      
      throw error;
    }
  }
};

// Order operations
export const orderDB = {
  async findAll() {
    const result = await query(`
      SELECT o.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   '_id', oi.id,
                   'name', oi.name,
                   'price', oi.price,
                   'quantity', oi.quantity,
                   'printedToKitchen', oi.printed_to_kitchen
                 ) ORDER BY oi.created_at
               ) FILTER (WHERE oi.id IS NOT NULL), 
               '[]'::json
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    
    return result.rows.map(row => ({
      _id: row.id,
      restaurantId: row.restaurant_id,
      tableNumber: row.table_number,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      deliveryAddress: row.delivery_address,
      type: row.order_type,
      orderType: row.order_type,
      status: row.status,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      total: parseFloat(row.total_amount),
      totalAmount: parseFloat(row.total_amount),
      items: row.items || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  },
  
  async findById(id) {
    const result = await query(`
      SELECT o.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   '_id', oi.id,
                   'name', oi.name,
                   'price', oi.price,
                   'quantity', oi.quantity,
                   'printedToKitchen', oi.printed_to_kitchen
                 ) ORDER BY oi.created_at
               ) FILTER (WHERE oi.id IS NOT NULL), 
               '[]'::json
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id
    `, [id]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      _id: row.id,
      restaurantId: row.restaurant_id,
      tableNumber: row.table_number,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      deliveryAddress: row.delivery_address,
      type: row.order_type,
      orderType: row.order_type,
      status: row.status,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      total: parseFloat(row.total_amount),
      totalAmount: parseFloat(row.total_amount),
      items: row.items || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },
  
  async findByRestaurant(restaurantId) {
    const result = await query(`
      SELECT o.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   '_id', oi.id,
                   'name', oi.name,
                   'price', oi.price,
                   'quantity', oi.quantity,
                   'printedToKitchen', oi.printed_to_kitchen
                 ) ORDER BY oi.created_at
               ) FILTER (WHERE oi.id IS NOT NULL), 
               '[]'::json
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.restaurant_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [restaurantId]);
    
    return result.rows.map(row => ({
      _id: row.id,
      restaurantId: row.restaurant_id,
      tableNumber: row.table_number,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      deliveryAddress: row.delivery_address,
      type: row.order_type,
      orderType: row.order_type,
      status: row.status,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      total: parseFloat(row.total_amount),
      totalAmount: parseFloat(row.total_amount),
      items: row.items || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  },
  
  async create(data) {
    try {
      console.log('🔄 Creating order in database...');
      console.log('Order data received:', {
        restaurantId: data.restaurantId,
        itemCount: data.items?.length || 0,
        total: data.total || data.totalAmount,
        customerName: data.customerName,
        tableNumber: data.tableNumber
      });
      
      return await withTransaction(async (client) => {
        // Insert order
        console.log('📝 Inserting order record...');
        const orderResult = await client.query(`
          INSERT INTO orders (
            restaurant_id, table_number, customer_name, customer_phone, 
            delivery_address, order_type, status, payment_method, 
            payment_status, total_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `, [
          data.restaurantId,
          data.tableNumber,
          data.customerName,
          data.customerPhone,
          data.deliveryAddress,
          data.type || data.orderType || 'dine-in',
          data.status || 'pending',
          data.paymentMethod || 'cash',
          data.paymentStatus || 'pending',
          data.total || data.totalAmount
        ]);
        
        const order = orderResult.rows[0];
        console.log('✅ Order record created with ID:', order.id);
        
        // Insert order items
        if (data.items && data.items.length > 0) {
          console.log(`📝 Inserting ${data.items.length} order items...`);
          for (const item of data.items) {
            await client.query(`
              INSERT INTO order_items (
                order_id, menu_item_id, name, price, quantity, printed_to_kitchen
              ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
              order.id,
              item.menuItemId || null,
              item.name,
              item.price,
              item.quantity || 1,
              item.printedToKitchen || false
            ]);
          }
          console.log('✅ Order items inserted successfully');
        }
        
        // Return simplified order object to avoid complex queries during creation
        const completeOrder = {
          _id: order.id,
          restaurantId: order.restaurant_id,
          tableNumber: order.table_number,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          deliveryAddress: order.delivery_address,
          type: order.order_type,
          orderType: order.order_type,
          status: order.status,
          paymentMethod: order.payment_method,
          paymentStatus: order.payment_status,
          total: parseFloat(order.total_amount),
          totalAmount: parseFloat(order.total_amount),
          items: data.items || [],
          createdAt: order.created_at,
          updatedAt: order.updated_at
        };
        
        console.log('✅ Order creation completed successfully');
        return completeOrder;
      });
    } catch (error) {
      console.error('❌ Order creation failed:', error);
      console.error('Error details:', error.message);
      throw error;
    }
  },
  
  async update(id, data) {
    // Handle items update separately
    if (data.items) {
      await withTransaction(async (client) => {
        // Delete existing items
        await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
        
        // Insert updated items
        for (const item of data.items) {
          await client.query(`
            INSERT INTO order_items (
              order_id, menu_item_id, name, price, quantity, printed_to_kitchen
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            id,
            item.menuItemId || null,
            item.name,
            item.price,
            item.quantity || 1,
            item.printedToKitchen || false
          ]);
        }
      });
      
      delete data.items; // Remove items from update data
    }
    
    // Update order fields
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    const fieldMapping = {
      tableNumber: 'table_number',
      customerName: 'customer_name',
      customerPhone: 'customer_phone',
      deliveryAddress: 'delivery_address',
      type: 'order_type',
      orderType: 'order_type',
      status: 'status',
      paymentMethod: 'payment_method',
      paymentStatus: 'payment_status',
      total: 'total_amount',
      totalAmount: 'total_amount'
    };
    
    for (const [key, value] of Object.entries(data)) {
      if (fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }
    
    if (updateFields.length > 0) {
      values.push(id);
      await query(`
        UPDATE orders 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount}
      `, values);
    }
    
    return await this.findById(id);
  }
};
