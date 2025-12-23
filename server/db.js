import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'data');

// Initialize database
export async function initDB() {
  try {
    await fs.mkdir(DB_PATH, { recursive: true });
    
    const files = ['restaurants.json', 'orders.json'];
    for (const file of files) {
      const filePath = path.join(DB_PATH, file);
      try {
        await fs.access(filePath);
      } catch {
        await fs.writeFile(filePath, JSON.stringify([], null, 2));
      }
    }
    console.log('✅ Local database initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Generic read function
async function readData(filename) {
  try {
    const data = await fs.readFile(path.join(DB_PATH, filename), 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Generic write function
async function writeData(filename, data) {
  await fs.writeFile(path.join(DB_PATH, filename), JSON.stringify(data, null, 2));
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Restaurant operations
export const restaurantDB = {
  async findAll() {
    return await readData('restaurants.json');
  },
  
  async findById(id) {
    const restaurants = await readData('restaurants.json');
    return restaurants.find(r => r._id === id);
  },
  
  async findOne(query) {
    const restaurants = await readData('restaurants.json');
    return restaurants.find(r => {
      for (const key in query) {
        if (r[key] !== query[key]) return false;
      }
      return true;
    });
  },
  
  async create(data) {
    const restaurants = await readData('restaurants.json');
    const newRestaurant = {
      _id: generateId(),
      ...data,
      menu: data.menu || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    restaurants.push(newRestaurant);
    await writeData('restaurants.json', restaurants);
    return newRestaurant;
  },
  
  async update(id, data) {
    const restaurants = await readData('restaurants.json');
    const index = restaurants.findIndex(r => r._id === id);
    if (index === -1) return null;
    
    restaurants[index] = {
      ...restaurants[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    await writeData('restaurants.json', restaurants);
    return restaurants[index];
  },
  
  async search(query) {
    const restaurants = await readData('restaurants.json');
    if (!query) return restaurants;
    
    const searchTerm = query.toLowerCase();
    return restaurants.filter(r => {
      const nameMatch = r.name?.toLowerCase().includes(searchTerm);
      const cuisineMatch = r.cuisine?.some(c => c.toLowerCase().includes(searchTerm));
      const menuMatch = r.menu?.some(m => m.name?.toLowerCase().includes(searchTerm));
      return nameMatch || cuisineMatch || menuMatch;
    });
  },
  
  async addMenuItem(restaurantId, menuItem) {
    const restaurant = await this.findById(restaurantId);
    if (!restaurant) return null;
    
    const newItem = { _id: generateId(), ...menuItem };
    restaurant.menu.push(newItem);
    return await this.update(restaurantId, restaurant);
  },
  
  async updateMenuItem(restaurantId, menuItemId, data) {
    const restaurant = await this.findById(restaurantId);
    if (!restaurant) return null;
    
    const menuIndex = restaurant.menu.findIndex(m => m._id === menuItemId);
    if (menuIndex === -1) return null;
    
    restaurant.menu[menuIndex] = { ...restaurant.menu[menuIndex], ...data };
    return await this.update(restaurantId, restaurant);
  },
  
  async deleteMenuItem(restaurantId, menuItemId) {
    const restaurant = await this.findById(restaurantId);
    if (!restaurant) return null;
    
    restaurant.menu = restaurant.menu.filter(m => m._id !== menuItemId);
    return await this.update(restaurantId, restaurant);
  }
};

// Order operations
export const orderDB = {
  async findAll() {
    return await readData('orders.json');
  },
  
  async findById(id) {
    const orders = await readData('orders.json');
    return orders.find(o => o._id === id);
  },
  
  async findByRestaurant(restaurantId) {
    const orders = await readData('orders.json');
    return orders.filter(o => o.restaurantId === restaurantId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  
  async create(data) {
    const orders = await readData('orders.json');
    const newOrder = {
      _id: generateId(),
      ...data,
      status: data.status || 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    orders.push(newOrder);
    await writeData('orders.json', orders);
    return newOrder;
  },
  
  async update(id, data) {
    const orders = await readData('orders.json');
    const index = orders.findIndex(o => o._id === id);
    if (index === -1) return null;
    
    orders[index] = {
      ...orders[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    await writeData('orders.json', orders);
    return orders[index];
  }
};
