-- WaitNot Restaurant System Database Schema
-- PostgreSQL Schema for Neon Database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Admins table (for system administrators)
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image TEXT,
    rating DECIMAL(2,1) DEFAULT 0,
    delivery_time VARCHAR(50),
    cuisine TEXT[], -- Array of cuisine types
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_delivery_available BOOLEAN DEFAULT true,
    tables INTEGER DEFAULT 0,
    -- Feature permissions (JSONB for flexible feature management)
    features JSONB DEFAULT '{
        "menuManagement": true,
        "orderManagement": true,
        "analytics": true,
        "profileEdit": true,
        "printerSettings": true,
        "qrCodeGeneration": true,
        "tableManagement": true,
        "deliveryToggle": true,
        "passwordChange": true,
        "imageUpload": true,
        "menuCategories": true,
        "orderHistory": true,
        "realTimeOrders": true,
        "customerInfo": true,
        "salesReports": true,
        "menuItemToggle": true,
        "bulkOperations": true,
        "exportData": true,
        "notifications": true,
        "multiLanguage": true
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Menu items table
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    is_veg BOOLEAN DEFAULT true,
    description TEXT,
    image TEXT,
    available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    table_number INTEGER,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    delivery_address TEXT,
    order_type VARCHAR(20) DEFAULT 'dine-in', -- 'dine-in', 'delivery', 'takeaway'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'preparing', 'completed', 'cancelled'
    payment_method VARCHAR(20) DEFAULT 'cash', -- 'cash', 'upi', 'card'
    payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'failed'
    total_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order items table (for order details)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id),
    name VARCHAR(255) NOT NULL, -- Store name for historical data
    price DECIMAL(10,2) NOT NULL, -- Store price for historical data
    quantity INTEGER NOT NULL DEFAULT 1,
    printed_to_kitchen BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL, -- Optional: link to specific order
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 star rating
    feedback_text TEXT NOT NULL,
    feedback_type VARCHAR(20) DEFAULT 'general', -- 'general', 'food', 'service', 'delivery'
    is_anonymous BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'archived', 'responded'
    restaurant_response TEXT, -- Restaurant can respond to feedback
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_restaurants_email ON restaurants(email);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_feedback_restaurant_id ON feedback(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data (optional - for testing)
-- You can remove this section if you don't want sample data

-- Insert default admin user
INSERT INTO admins (username, email, password, full_name, role) 
VALUES (
    'admin',
    'admin@waitnot.com',
    '$2a$10$example.hash.here', -- You'll need to hash this properly
    'System Administrator',
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- Insert sample restaurant
INSERT INTO restaurants (name, description, email, password, cuisine, address, phone, tables) 
VALUES (
    'Spice Garden',
    'Authentic Indian cuisine with a modern twist',
    'spice@example.com',
    '$2a$10$example.hash.here', -- You'll need to hash this properly
    ARRAY['Indian', 'North Indian', 'Tandoor'],
    '123 Main Street, City',
    '1234567890',
    10
) ON CONFLICT (email) DO NOTHING;

-- Note: You'll need to insert menu items and other data after getting the restaurant ID