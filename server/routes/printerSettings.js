import express from 'express';
import { query } from '../database/connection.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware to verify restaurant token
const verifyRestaurantToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.restaurantId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get printer settings for a restaurant
router.get('/', verifyRestaurantToken, async (req, res) => {
  try {
    console.log('📄 Getting printer settings for restaurant:', req.restaurantId);
    
    const result = await query(`
      SELECT settings, updated_at
      FROM printer_settings 
      WHERE restaurant_id = $1
    `, [req.restaurantId]);
    
    if (result.rows.length === 0) {
      // Return default settings if none exist
      const defaultSettings = {
        enableKitchenPrinting: true,
        enableFinalBillPrinting: true,
        kitchenReceiptSize: '80mm',
        cashCounterReceiptSize: '80mm',
        autoPrintKitchenBill: false,
        autoPrintFinalBill: false,
        kitchenPrinterName: 'Kitchen Printer',
        cashCounterPrinterName: 'Cash Counter Printer',
        enableUpiPayments: true,
        upiBaseUrl: 'upi://pay?pa=Q582735754@ybl&pn=PhonePeMerchant&mc=0000&mode=02&purpose=00',
        merchantName: 'PhonePeMerchant',
        defaultUpiApp: 'phonepe',
        billCustomization: {
          enableCustomBill: false,
          logoFile: null,
          logoDataUrl: '',
          logoSize: 'medium',
          headerText: '',
          footerText: 'Thank you for dining with us!',
          showQRCode: true,
          enableUpiPayment: true,
          qrCodeFile: null,
          qrCodeDataUrl: '',
          showAddress: true,
          address: '',
          showPhone: true,
          phone: '',
          showEmail: false,
          email: '',
          showGST: false,
          gstNumber: '',
          billTemplate: 'modern'
        }
      };
      
      console.log('📄 No settings found, returning defaults');
      return res.json({ settings: defaultSettings, isDefault: true });
    }
    
    const settings = result.rows[0].settings;
    console.log('📄 Settings retrieved successfully');
    
    res.json({ 
      settings, 
      updatedAt: result.rows[0].updated_at,
      isDefault: false 
    });
    
  } catch (error) {
    console.error('❌ Error getting printer settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save/Update printer settings for a restaurant
router.post('/', verifyRestaurantToken, async (req, res) => {
  try {
    console.log('💾 Saving printer settings for restaurant:', req.restaurantId);
    
    const { settings } = req.body;
    
    if (!settings) {
      return res.status(400).json({ error: 'Settings are required' });
    }
    
    // Validate settings structure (basic validation)
    if (typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings must be an object' });
    }
    
    // Use UPSERT (INSERT ... ON CONFLICT) to handle both insert and update
    const result = await query(`
      INSERT INTO printer_settings (restaurant_id, settings)
      VALUES ($1, $2)
      ON CONFLICT (restaurant_id)
      DO UPDATE SET 
        settings = $2,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, settings, updated_at
    `, [req.restaurantId, JSON.stringify(settings)]);
    
    const savedSettings = result.rows[0];
    console.log('💾 Settings saved successfully');
    
    res.json({
      success: true,
      message: 'Printer settings saved successfully',
      settings: savedSettings.settings,
      updatedAt: savedSettings.updated_at
    });
    
  } catch (error) {
    console.error('❌ Error saving printer settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete printer settings (reset to defaults)
router.delete('/', verifyRestaurantToken, async (req, res) => {
  try {
    console.log('🗑️ Deleting printer settings for restaurant:', req.restaurantId);
    
    await query(`
      DELETE FROM printer_settings 
      WHERE restaurant_id = $1
    `, [req.restaurantId]);
    
    console.log('🗑️ Settings deleted successfully');
    
    res.json({
      success: true,
      message: 'Printer settings reset to defaults'
    });
    
  } catch (error) {
    console.error('❌ Error deleting printer settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get printer settings for admin (by restaurant ID)
router.get('/admin/:restaurantId', async (req, res) => {
  try {
    // Verify admin token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'admin_secret');
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    console.log('📄 Admin getting printer settings for restaurant:', req.params.restaurantId);
    
    const result = await query(`
      SELECT ps.settings, ps.updated_at, r.name as restaurant_name
      FROM printer_settings ps
      JOIN restaurants r ON ps.restaurant_id = r.id
      WHERE ps.restaurant_id = $1
    `, [req.params.restaurantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Printer settings not found for this restaurant' });
    }
    
    const data = result.rows[0];
    console.log('📄 Admin settings retrieved successfully');
    
    res.json({
      restaurantId: req.params.restaurantId,
      restaurantName: data.restaurant_name,
      settings: data.settings,
      updatedAt: data.updated_at
    });
    
  } catch (error) {
    console.error('❌ Error getting printer settings for admin:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;