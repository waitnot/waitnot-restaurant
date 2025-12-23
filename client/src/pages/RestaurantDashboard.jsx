import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, LogOut, X, Settings, Printer, BarChart3, User } from 'lucide-react';
import axios from 'axios';
import io from 'socket.io-client';
import FeatureGuard from '../components/FeatureGuard';
import { useFeatures } from '../context/FeatureContext';

export default function RestaurantDashboard() {
  const navigate = useNavigate();
  const { isFeatureEnabled } = useFeatures();
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState(() => {
    // Set default tab based on available features
    if (isFeatureEnabled('deliveryOrders')) return 'delivery';
    if (isFeatureEnabled('orderManagement')) return 'dine-in';
    if (isFeatureEnabled('menuManagement')) return 'menu';
    if (isFeatureEnabled('qrCodeGeneration')) return 'qr';
    if (isFeatureEnabled('orderHistory')) return 'history';
    return 'dine-in'; // fallback to table orders
  });

  // Effect to handle tab switching when features change
  useEffect(() => {
    // If current tab is delivery but delivery orders is disabled, switch to dine-in
    if (activeTab === 'delivery' && !isFeatureEnabled('deliveryOrders')) {
      if (isFeatureEnabled('orderManagement')) {
        setActiveTab('dine-in');
      } else if (isFeatureEnabled('menuManagement')) {
        setActiveTab('menu');
      } else if (isFeatureEnabled('qrCodeGeneration')) {
        setActiveTab('qr');
      } else if (isFeatureEnabled('orderHistory')) {
        setActiveTab('history');
      }
    }
  }, [activeTab, isFeatureEnabled]);
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [menuForm, setMenuForm] = useState({
    name: '', price: '', category: 'Starters', description: '', isVeg: true, image: ''
  });
  const [imageUploadMethod, setImageUploadMethod] = useState('url'); // 'url' or 'upload'
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      navigate('/restaurant-login');
      return;
    }

    fetchRestaurant(restaurantId);
    fetchOrders(restaurantId);

    const socket = io('http://localhost:5000');
    socket.emit('join-restaurant', restaurantId);
    
    socket.on('new-order', (order) => {
      setOrders(prev => [order, ...prev]);
    });

    socket.on('order-updated', (updatedOrder) => {
      setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
    });

    return () => socket.disconnect();
  }, []);

  const fetchRestaurant = async (id) => {
    try {
      const { data } = await axios.get(`/api/restaurants/${id}`);
      setRestaurant(data);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    }
  };

  const fetchOrders = async (id) => {
    try {
      const { data } = await axios.get(`/api/orders/restaurant/${id}`);
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.patch(`/api/orders/${orderId}/status`, { status });
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  // Printer Settings Utilities
  const getPrinterSettings = () => {
    const restaurantId = localStorage.getItem('restaurantId');
    const defaultSettings = {
      enableKitchenPrinting: true,
      enableFinalBillPrinting: true,
      kitchenReceiptSize: '80mm',
      cashCounterReceiptSize: '80mm',
      autoPrintKitchenBill: false,
      autoPrintFinalBill: false,
      kitchenPrinterName: 'Kitchen Printer',
      cashCounterPrinterName: 'Cash Counter Printer'
    };
    
    try {
      const savedSettings = localStorage.getItem(`printer_settings_${restaurantId}`);
      return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    } catch (error) {
      console.error('Error loading printer settings:', error);
      return defaultSettings;
    }
  };

  // Check if table has unprinted items for kitchen
  const hasUnprintedKitchenItems = (tableOrders) => {
    return tableOrders.some(order => 
      order.items.some(item => !item.printed_to_kitchen)
    );
  };

  // Mark items as printed to kitchen
  const markItemsAsPrintedToKitchen = async (tableOrders) => {
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      
      // Update each order's items to mark them as printed to kitchen
      for (const order of tableOrders) {
        const updatedItems = order.items.map(item => ({
          ...item,
          printed_to_kitchen: true
        }));
        
        // Update the order in the backend
        await axios.patch(`/api/orders/${order._id}/items`, { items: updatedItems });
      }
      
      // Refresh orders to update UI
      await fetchOrders(restaurantId);
    } catch (error) {
      console.error('Error marking items as printed to kitchen:', error);
    }
  };

  const handleMenuSubmit = async (e) => {
    e.preventDefault();
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      if (editingItem) {
        await axios.put(`/api/restaurants/${restaurantId}/menu/${editingItem._id}`, menuForm);
      } else {
        await axios.post(`/api/restaurants/${restaurantId}/menu`, menuForm);
      }
      fetchRestaurant(restaurantId);
      setShowMenuForm(false);
      setEditingItem(null);
      setMenuForm({ name: '', price: '', category: 'Starters', description: '', isVeg: true });
    } catch (error) {
      console.error('Error saving menu item:', error);
    }
  };

  const deleteMenuItem = async (menuId) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      const response = await axios.delete(`/api/restaurants/${restaurantId}/menu/${menuId}`);
      
      // Handle the response message
      if (response.data.message) {
        if (response.data.message.includes('marked unavailable') || response.data.message.includes('order history')) {
          alert('⚠️ Menu item removed from availability\n\nThis item cannot be permanently deleted because it exists in order history. It has been marked as unavailable instead.');
        } else {
          alert('✅ Menu item deleted successfully');
        }
      }
      
      fetchRestaurant(restaurantId);
    } catch (error) {
      console.error('Error deleting menu item:', error);
      
      if (error.response?.data?.error) {
        if (error.response.data.type === 'constraint_violation') {
          alert('⚠️ Cannot Delete Menu Item\n\nThis item exists in order history and cannot be permanently deleted. It has been marked as unavailable instead.');
        } else {
          alert('❌ Error: ' + error.response.data.error);
        }
      } else {
        alert('❌ Failed to delete menu item. Please try again.');
      }
      
      // Refresh the restaurant data even if there was an error (in case of soft delete)
      const restaurantId = localStorage.getItem('restaurantId');
      fetchRestaurant(restaurantId);
    }
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check if it's an image file
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Check file size (max 2MB for images)
      if (file.size > 2 * 1024 * 1024) {
        alert('Image file is too large. Maximum size is 2MB.\n\nTip: Compress your image at tinypng.com or use a smaller image.');
        return;
      }
      
      setImageFile(file);
      
      // Convert to base64 and preview
      const reader = new FileReader();
      reader.onload = () => {
        setMenuForm({...menuForm, image: reader.result});
      };
      reader.readAsDataURL(file);
    }
  };

  const addTable = async () => {
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      const newTableCount = (restaurant.tables || 0) + 1;
      
      console.log('Adding table:', { restaurantId, newTableCount });
      
      const response = await axios.patch(`/api/restaurants/${restaurantId}/tables`, {
        tables: newTableCount
      });
      
      console.log('Table added response:', response.data);
      
      await fetchRestaurant(restaurantId);
      alert(`Table ${newTableCount} added successfully!`);
    } catch (error) {
      console.error('Error adding table:', error);
      console.error('Error response:', error.response?.data);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Failed to add table: ${errorMsg}`);
    }
  };

  const deleteTable = async (tableNum) => {
    if (!window.confirm(`Delete Table ${tableNum}? This will remove the last table and its QR code.`)) {
      return;
    }
    
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      const newTableCount = Math.max(0, (restaurant.tables || 0) - 1);
      
      console.log('Deleting table:', { restaurantId, tableNum, newTableCount });
      
      const response = await axios.patch(`/api/restaurants/${restaurantId}/tables`, {
        tables: newTableCount
      });
      
      console.log('Table deleted response:', response.data);
      
      await fetchRestaurant(restaurantId);
      alert('Table deleted successfully!');
    } catch (error) {
      console.error('Error deleting table:', error);
      console.error('Error response:', error.response?.data);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Failed to delete table: ${errorMsg}`);
    }
  };

  const downloadQRCode = async (tableNum, qrUrl) => {
    try {
      // Get the QR code image
      const imgElement = document.querySelector(`#qr-table-${tableNum} img`);
      if (!imgElement) {
        alert('QR code not found. Please try again.');
        return;
      }

      // Create a canvas to draw the QR code with labels
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size (larger for print quality)
      const qrSize = 400;
      const padding = 60;
      canvas.width = qrSize + (padding * 2);
      canvas.height = qrSize + (padding * 3);
      
      // Fill white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Load and draw QR code
      const qrImage = new Image();
      qrImage.crossOrigin = 'anonymous';
      
      qrImage.onload = () => {
        // Draw QR code in center
        ctx.drawImage(qrImage, padding, padding + 40, qrSize, qrSize);
        
        // Add restaurant name at top
        ctx.fillStyle = 'black';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(restaurant.name, canvas.width / 2, 40);
        
        // Add table number at bottom
        ctx.font = 'bold 36px Arial';
        ctx.fillText(`Table ${tableNum}`, canvas.width / 2, qrSize + padding + 80);
        
        // Add "Scan to Order" text
        ctx.font = '20px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText('Scan to Order', canvas.width / 2, qrSize + padding + 115);
        
        // Download the canvas as PNG
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `${restaurant.name.replace(/\s+/g, '-')}-Table-${tableNum}-QR.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        });
      };
      
      qrImage.onerror = () => {
        alert('Failed to load QR code. Please try again.');
      };
      
      // Use the API URL to generate QR code
      qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrUrl)}&margin=20`;
      
    } catch (error) {
      console.error('Error downloading QR code:', error);
      alert('Failed to download QR code. Please try again.');
    }
  };

  const generateBillForTable = async (tableNumber, tableOrders, totalAmount) => {
    // Create bill summary
    const allItems = {};
    tableOrders.forEach(order => {
      order.items.forEach(item => {
        const key = item.name;
        if (allItems[key]) {
          allItems[key].quantity += item.quantity;
          allItems[key].total += item.price * item.quantity;
        } else {
          allItems[key] = {
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity
          };
        }
      });
    });

    const billSummary = Object.values(allItems)
      .map(item => `${item.name} x ${item.quantity} = ₹${item.total}`)
      .join('\n');

    const confirmMessage = `Generate Final Bill for Table ${tableNumber}?\n\n` +
      `Orders: ${tableOrders.length}\n` +
      `Customer: ${tableOrders[0].customerName}\n\n` +
      `Items:\n${billSummary}\n\n` +
      `TOTAL: ₹${totalAmount}\n\n` +
      `This will:\n` +
      `✓ Mark all orders as completed\n` +
      `✓ Clear customer session\n` +
      `✓ Ready table for next customer`;

    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      // Mark all orders as completed
      for (const order of tableOrders) {
        if (order.status !== 'completed') {
          await updateOrderStatus(order._id, 'completed');
        }
      }

      // Clear the customer session for this table
      const sessionKey = `table_session_${restaurant._id}_${tableNumber}`;
      console.log('Clearing session:', sessionKey);
      console.log('Session before clear:', localStorage.getItem(sessionKey));
      localStorage.removeItem(sessionKey);
      console.log('Session after clear:', localStorage.getItem(sessionKey));
      
      alert(`✅ Bill Generated!\n\nTable ${tableNumber}\nTotal: ₹${totalAmount}\n\nTable is now ready for next customer.\n\nCustomer session cleared - next customer will need to enter their details.`);
      
      // Refresh orders
      const restaurantId = localStorage.getItem('restaurantId');
      await fetchOrders(restaurantId);
    } catch (error) {
      console.error('Error generating bill:', error);
      alert('Failed to generate bill');
    }
  };

  const printReceipt = (tableNumber, tableOrders, totalAmount) => {
    // Create bill summary
    const allItems = {};
    tableOrders.forEach(order => {
      order.items.forEach(item => {
        const key = item.name;
        if (allItems[key]) {
          allItems[key].quantity += item.quantity;
          allItems[key].total += item.price * item.quantity;
        } else {
          allItems[key] = {
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity
          };
        }
      });
    });

    const firstOrder = tableOrders[0];
    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-IN');
    const timeStr = currentDate.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Create receipt HTML with thermal printer styling
    const receiptHTML = `
      <div id="receipt-content" style="
        width: 80mm;
        max-width: 302px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.2;
        color: black;
        background: white;
        padding: 10px;
        margin: 0;
      ">
        <!-- Restaurant Header -->
        <div style="text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px;">
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
            ${restaurant.name.toUpperCase()}
          </div>
          <div style="font-size: 10px;">
            Restaurant Receipt
          </div>
        </div>

        <!-- Order Info -->
        <div style="margin-bottom: 15px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Table:</span>
            <span><strong>${tableNumber}</strong></span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Order ID:</span>
            <span>${orderId}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Date:</span>
            <span>${dateStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Time:</span>
            <span>${timeStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Customer:</span>
            <span>${firstOrder.customerName}</span>
          </div>
        </div>

        <!-- Items Header -->
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px;">
            <span style="width: 60%;">ITEM</span>
            <span style="width: 15%; text-align: center;">QTY</span>
            <span style="width: 25%; text-align: right;">AMOUNT</span>
          </div>
        </div>

        <!-- Items List -->
        <div style="margin-bottom: 15px;">
          ${Object.values(allItems).map(item => `
            <div style="margin-bottom: 8px; font-size: 11px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="width: 60%; word-wrap: break-word;">${item.name}</span>
                <span style="width: 15%; text-align: center;">${item.quantity}</span>
                <span style="width: 25%; text-align: right;">₹${item.total}</span>
              </div>
              <div style="font-size: 10px; color: #666; margin-left: 0;">
                @ ₹${item.price} each
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Total Section -->
        <div style="border-top: 1px dashed #000; padding-top: 10px; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
            <span>Subtotal:</span>
            <span>₹${totalAmount}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; border-top: 1px solid #000; padding-top: 5px;">
            <span>TOTAL:</span>
            <span>₹${totalAmount}</span>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px;">
          <div style="margin-bottom: 5px;">Thank you for dining with us!</div>
          <div style="margin-bottom: 5px;">Please visit again</div>
          <div style="margin-bottom: 10px;">★★★★★</div>
          <div style="font-size: 9px; color: #666;">
            Printed: ${dateStr} ${timeStr}
          </div>
        </div>
      </div>
    `;

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - Table ${tableNumber}</title>
          <style>
            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              margin: 0;
              padding: 0;
              background: white;
            }
          </style>
        </head>
        <body>
          ${receiptHTML}
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      };
    } else {
      alert('Please allow popups to print receipts');
    }
  };

  const printIndividualReceipt = (order) => {
    const orderId = `ORD-${order._id.slice(-6).toUpperCase()}`;
    const currentDate = new Date(order.createdAt);
    const dateStr = currentDate.toLocaleDateString('en-IN');
    const timeStr = currentDate.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Create receipt HTML with thermal printer styling
    const receiptHTML = `
      <div id="receipt-content" style="
        width: 80mm;
        max-width: 302px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.2;
        color: black;
        background: white;
        padding: 10px;
        margin: 0;
      ">
        <!-- Restaurant Header -->
        <div style="text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px;">
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
            ${restaurant.name.toUpperCase()}
          </div>
          <div style="font-size: 10px;">
            ${order.orderType === 'delivery' ? 'Delivery Receipt' : 'Dine-In Receipt'}
          </div>
        </div>

        <!-- Order Info -->
        <div style="margin-bottom: 15px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Order ID:</span>
            <span>${orderId}</span>
          </div>
          ${order.orderType === 'dine-in' ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Table:</span>
            <span><strong>${order.tableNumber}</strong></span>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Date:</span>
            <span>${dateStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Time:</span>
            <span>${timeStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Customer:</span>
            <span>${order.customerName}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Phone:</span>
            <span>${order.customerPhone}</span>
          </div>
          ${order.deliveryAddress ? `
          <div style="margin-top: 5px; font-size: 10px;">
            <div><strong>Delivery Address:</strong></div>
            <div style="margin-left: 10px; word-wrap: break-word;">${order.deliveryAddress}</div>
          </div>
          ` : ''}
        </div>

        <!-- Items Header -->
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px;">
            <span style="width: 60%;">ITEM</span>
            <span style="width: 15%; text-align: center;">QTY</span>
            <span style="width: 25%; text-align: right;">AMOUNT</span>
          </div>
        </div>

        <!-- Items List -->
        <div style="margin-bottom: 15px;">
          ${order.items.map(item => `
            <div style="margin-bottom: 8px; font-size: 11px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="width: 60%; word-wrap: break-word;">${item.name}</span>
                <span style="width: 15%; text-align: center;">${item.quantity}</span>
                <span style="width: 25%; text-align: right;">₹${item.price * item.quantity}</span>
              </div>
              <div style="font-size: 10px; color: #666; margin-left: 0;">
                @ ₹${item.price} each
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Total Section -->
        <div style="border-top: 1px dashed #000; padding-top: 10px; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
            <span>Subtotal:</span>
            <span>₹${order.totalAmount}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; border-top: 1px solid #000; padding-top: 5px;">
            <span>TOTAL:</span>
            <span>₹${order.totalAmount}</span>
          </div>
        </div>

        <!-- Status -->
        <div style="text-align: center; margin-bottom: 15px; font-size: 11px;">
          <div style="background: #f0f0f0; padding: 5px; border-radius: 3px;">
            <strong>Status: ${order.status.toUpperCase()}</strong>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px;">
          <div style="margin-bottom: 5px;">Thank you for ${order.orderType === 'delivery' ? 'ordering' : 'dining'} with us!</div>
          <div style="margin-bottom: 5px;">Please visit again</div>
          <div style="margin-bottom: 10px;">★★★★★</div>
          <div style="font-size: 9px; color: #666;">
            Printed: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    `;

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - Order ${orderId}</title>
          <style>
            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              margin: 0;
              padding: 0;
              background: white;
            }
          </style>
        </head>
        <body>
          ${receiptHTML}
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      };
    } else {
      alert('Please allow popups to print receipts');
    }
  };

  const printKitchenOrder = (tableNumber, tableOrders) => {
    const settings = getPrinterSettings();
    
    if (!settings.enableKitchenPrinting) {
      alert('Kitchen printing is disabled in settings');
      return;
    }

    // Get only unprinted items
    const unprintedItems = [];
    tableOrders.forEach(order => {
      order.items.forEach(item => {
        if (!item.printed_to_kitchen) {
          unprintedItems.push({
            ...item,
            orderId: order._id,
            customerName: order.customerName,
            orderTime: order.createdAt
          });
        }
      });
    });

    if (unprintedItems.length === 0) {
      alert('No new items to print to kitchen');
      return;
    }

    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-IN');
    const timeStr = currentDate.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    const receiptWidth = settings.kitchenReceiptSize === '58mm' ? '58mm' : '80mm';
    const maxWidth = settings.kitchenReceiptSize === '58mm' ? '220px' : '302px';

    // Create KOT (Kitchen Order Ticket) HTML
    const kotHTML = `
      <div id="kot-content" style="
        width: ${receiptWidth};
        max-width: ${maxWidth};
        font-family: 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.2;
        color: black;
        background: white;
        padding: 10px;
        margin: 0;
      ">
        <!-- KOT Header -->
        <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px;">
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">
            KITCHEN ORDER (KOT)
          </div>
          <div style="font-size: 14px; font-weight: bold;">
            TABLE ${tableNumber}
          </div>
        </div>

        <!-- Order Info -->
        <div style="margin-bottom: 15px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Date:</strong></span>
            <span>${dateStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Time:</strong></span>
            <span>${timeStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Customer:</strong></span>
            <span>${unprintedItems[0].customerName}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span><strong>Items:</strong></span>
            <span>${unprintedItems.length} item(s)</span>
          </div>
        </div>

        <!-- Items Header -->
        <div style="border-top: 2px solid #000; border-bottom: 1px solid #000; padding: 5px 0; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px;">
            <span style="width: 70%;">ITEM</span>
            <span style="width: 30%; text-align: center;">QTY</span>
          </div>
        </div>

        <!-- Items List (NO PRICES) -->
        <div style="margin-bottom: 20px;">
          ${unprintedItems.map(item => `
            <div style="margin-bottom: 12px; font-size: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span style="width: 70%; word-wrap: break-word;">${item.name}</span>
                <span style="width: 30%; text-align: center; font-size: 16px; font-weight: bold;">${item.quantity}</span>
              </div>
              ${item.description ? `
                <div style="font-size: 10px; color: #666; margin-top: 2px; font-style: italic;">
                  ${item.description}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <!-- Instructions -->
        <div style="border-top: 2px solid #000; padding-top: 10px; margin-bottom: 15px; text-align: center;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">
            PREPARE ITEMS ABOVE
          </div>
          <div style="font-size: 10px; color: #666;">
            Check off items as completed
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px;">
          <div style="margin-bottom: 5px;">Kitchen Copy</div>
          <div style="font-size: 9px; color: #666;">
            Printed: ${dateStr} ${timeStr}
          </div>
        </div>
      </div>
    `;

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>KOT - Table ${tableNumber}</title>
          <style>
            @media print {
              @page {
                size: ${receiptWidth} auto;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              margin: 0;
              padding: 0;
              background: white;
            }
          </style>
        </head>
        <body>
          ${kotHTML}
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
          
          // Mark items as printed to kitchen after successful print
          markItemsAsPrintedToKitchen(tableOrders);
        }, 250);
      };
    } else {
      alert('Please allow popups to print kitchen orders');
    }
  };

  const printKitchenOrderIndividual = (order) => {
    const settings = getPrinterSettings();
    
    if (!settings.enableKitchenPrinting) {
      alert('Kitchen printing is disabled in settings');
      return;
    }

    // Check if order has unprinted items
    const unprintedItems = order.items.filter(item => !item.printed_to_kitchen);
    
    if (unprintedItems.length === 0) {
      alert('No new items to print to kitchen');
      return;
    }

    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-IN');
    const timeStr = currentDate.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    const receiptWidth = settings.kitchenReceiptSize === '58mm' ? '58mm' : '80mm';
    const maxWidth = settings.kitchenReceiptSize === '58mm' ? '220px' : '302px';

    // Create KOT (Kitchen Order Ticket) HTML
    const kotHTML = `
      <div id="kot-content" style="
        width: ${receiptWidth};
        max-width: ${maxWidth};
        font-family: 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.2;
        color: black;
        background: white;
        padding: 10px;
        margin: 0;
      ">
        <!-- KOT Header -->
        <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px;">
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">
            KITCHEN ORDER (KOT)
          </div>
          <div style="font-size: 14px; font-weight: bold;">
            ${order.orderType === 'delivery' ? 'DELIVERY ORDER' : `TABLE ${order.tableNumber}`}
          </div>
        </div>

        <!-- Order Info -->
        <div style="margin-bottom: 15px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Order ID:</strong></span>
            <span>${order._id.slice(-6).toUpperCase()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Date:</strong></span>
            <span>${dateStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Time:</strong></span>
            <span>${timeStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span><strong>Customer:</strong></span>
            <span>${order.customerName}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span><strong>Items:</strong></span>
            <span>${unprintedItems.length} item(s)</span>
          </div>
        </div>

        <!-- Items Header -->
        <div style="border-top: 2px solid #000; border-bottom: 1px solid #000; padding: 5px 0; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px;">
            <span style="width: 70%;">ITEM</span>
            <span style="width: 30%; text-align: center;">QTY</span>
          </div>
        </div>

        <!-- Items List (NO PRICES) -->
        <div style="margin-bottom: 20px;">
          ${unprintedItems.map(item => `
            <div style="margin-bottom: 12px; font-size: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span style="width: 70%; word-wrap: break-word;">${item.name}</span>
                <span style="width: 30%; text-align: center; font-size: 16px; font-weight: bold;">${item.quantity}</span>
              </div>
              ${item.description ? `
                <div style="font-size: 10px; color: #666; margin-top: 2px; font-style: italic;">
                  ${item.description}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <!-- Instructions -->
        <div style="border-top: 2px solid #000; padding-top: 10px; margin-bottom: 15px; text-align: center;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">
            PREPARE ITEMS ABOVE
          </div>
          <div style="font-size: 10px; color: #666;">
            ${order.orderType === 'delivery' ? 'For delivery preparation' : 'Check off items as completed'}
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px;">
          <div style="margin-bottom: 5px;">Kitchen Copy</div>
          <div style="font-size: 9px; color: #666;">
            Printed: ${dateStr} ${timeStr}
          </div>
        </div>
      </div>
    `;

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>KOT - Order ${order._id.slice(-6).toUpperCase()}</title>
          <style>
            @media print {
              @page {
                size: ${receiptWidth} auto;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              margin: 0;
              padding: 0;
              background: white;
            }
          </style>
        </head>
        <body>
          ${kotHTML}
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
          
          // Mark items as printed to kitchen after successful print
          markItemsAsPrintedToKitchen([order]);
        }, 250);
      };
    } else {
      alert('Please allow popups to print kitchen orders');
    }
  };

  const logout = () => {
    localStorage.removeItem('restaurantToken');
    localStorage.removeItem('restaurantId');
    localStorage.removeItem('restaurantData');
    navigate('/restaurant-login');
  };

  if (!restaurant) return <div className="text-center py-12">Loading...</div>;

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    preparing: 'bg-blue-100 text-blue-800',
    'out-for-delivery': 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800'
  };

  // Filter orders based on type
  const deliveryOrders = orders.filter(order => order.orderType === 'delivery');
  const dineInOrders = orders.filter(order => order.orderType === 'dine-in');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md p-3 sm:p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-primary truncate">{restaurant.name}</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <FeatureGuard feature="profileEdit">
              <button 
                onClick={() => navigate('/restaurant-profile')}
                className="flex items-center gap-1 sm:gap-2 text-gray-700 hover:text-primary text-sm sm:text-base"
              >
                <User size={18} className="sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Profile</span>
              </button>
            </FeatureGuard>
            <FeatureGuard feature="analytics">
              <button 
                onClick={() => navigate('/analytics')}
                className="flex items-center gap-1 sm:gap-2 text-gray-700 hover:text-primary text-sm sm:text-base"
              >
                <BarChart3 size={18} className="sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Analytics</span>
              </button>
            </FeatureGuard>
            <FeatureGuard feature="printerSettings">
              <button 
                onClick={() => navigate('/printer-settings')}
                className="flex items-center gap-1 sm:gap-2 text-gray-700 hover:text-primary text-sm sm:text-base"
              >
                <Settings size={18} className="sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Printer Settings</span>
              </button>
            </FeatureGuard>
            <button onClick={logout} className="flex items-center gap-1 sm:gap-2 text-gray-700 hover:text-primary text-sm sm:text-base">
              <LogOut size={18} className="sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-3 sm:p-4">
        <div className="flex gap-2 sm:gap-4 mb-4 sm:mb-6 overflow-x-auto pb-2 hide-scrollbar">
          <FeatureGuard feature="deliveryOrders">
            <button
              onClick={() => setActiveTab('delivery')}
              className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'delivery' ? 'bg-primary text-white' : 'bg-white text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">Delivery Orders</span>
              <span className="sm:hidden">Delivery</span>
            </button>
          </FeatureGuard>
          <FeatureGuard feature="orderManagement">
            <button
              onClick={() => setActiveTab('dine-in')}
              className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'dine-in' ? 'bg-primary text-white' : 'bg-white text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">Table Orders</span>
              <span className="sm:hidden">Tables</span>
            </button>
          </FeatureGuard>
          <FeatureGuard feature="menuManagement">
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'menu' ? 'bg-primary text-white' : 'bg-white text-gray-700'
              }`}
            >
              Menu
            </button>
          </FeatureGuard>
          <FeatureGuard feature="qrCodeGeneration">
            <button
              onClick={() => setActiveTab('qr')}
              className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'qr' ? 'bg-primary text-white' : 'bg-white text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">QR Codes</span>
              <span className="sm:hidden">QR</span>
            </button>
          </FeatureGuard>
          <FeatureGuard feature="orderHistory">
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'history' ? 'bg-primary text-white' : 'bg-white text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">Order History</span>
              <span className="sm:hidden">History</span>
            </button>
          </FeatureGuard>
        </div>      
  {activeTab === 'delivery' && isFeatureEnabled('deliveryOrders') && (
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">Home Delivery Orders</h2>
              <p className="text-gray-600 text-xs sm:text-sm">Total: {deliveryOrders.length} orders</p>
            </div>
            {deliveryOrders.map((order) => (
              <div key={order._id} className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">
                      🚚 Delivery Order
                    </h3>
                    <p className="text-sm text-gray-600">{order.customerName} • {order.customerPhone}</p>
                    {order.deliveryAddress && (
                      <p className="text-sm text-gray-600 mt-1">📍 {order.deliveryAddress}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[order.status]}`}>
                    {order.status}
                  </span>
                </div>

                <div className="mb-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-1">
                      <span>{item.name} x {item.quantity}</span>
                      <span>₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                  <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-primary">₹{order.totalAmount}</span>
                  </div>
                </div>

                {/* Print Buttons */}
                <div className="mb-3 flex gap-2">
                  {/* Kitchen Print Button - Smart Visibility */}
                  {order.items.some(item => !item.printed_to_kitchen) && (
                    <FeatureGuard feature="printerSettings">
                      <button
                        onClick={() => printKitchenOrderIndividual(order)}
                        className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 rounded-lg hover:from-orange-600 hover:to-red-600 font-semibold flex items-center justify-center gap-2"
                      >
                        🍳 Print Bill (Kitchen)
                      </button>
                    </FeatureGuard>
                  )}
                  
                  {/* Cash Counter Print Receipt Button */}
                  <FeatureGuard feature="printerSettings">
                    <button
                      onClick={() => printIndividualReceipt(order)}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 rounded-lg hover:from-blue-600 hover:to-indigo-600 font-semibold flex items-center justify-center gap-2"
                    >
                      🖨️ Print Receipt
                    </button>
                  </FeatureGuard>
                </div>

                <div className="flex gap-2">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => updateOrderStatus(order._id, 'preparing')}
                      className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
                    >
                      Start Preparing
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button
                      onClick={() => updateOrderStatus(order._id, 'out-for-delivery')}
                      className="flex-1 bg-purple-500 text-white py-2 rounded-lg hover:bg-purple-600"
                    >
                      Out for Delivery
                    </button>
                  )}
                  {order.status === 'out-for-delivery' && (
                    <button
                      onClick={() => updateOrderStatus(order._id, 'delivered')}
                      className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600"
                    >
                      Mark Delivered
                    </button>
                  )}
                  {order.status === 'delivered' && (
                    <button
                      onClick={() => updateOrderStatus(order._id, 'completed')}
                      className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
            {deliveryOrders.length === 0 && (
              <div className="text-center py-12 text-gray-500">No delivery orders yet</div>
            )}
          </div>
        )}

        {activeTab === 'dine-in' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">Dine-In / Table Orders</h2>
              <p className="text-gray-600 text-xs sm:text-sm">Total: {dineInOrders.length} orders</p>
            </div>
            
            {/* Group orders by table - only show active orders (not completed) */}
            {Object.entries(
              dineInOrders
                .filter(order => order.status !== 'completed')
                .reduce((acc, order) => {
                  const tableNum = order.tableNumber;
                  if (!acc[tableNum]) acc[tableNum] = [];
                  acc[tableNum].push(order);
                  return acc;
                }, {})
            ).map(([tableNum, tableOrders]) => {
              // Combine all items from all orders
              const combinedItems = {};
              tableOrders.forEach(order => {
                order.items.forEach(item => {
                  const key = item.name;
                  if (combinedItems[key]) {
                    combinedItems[key].quantity += item.quantity;
                    combinedItems[key].total += item.price * item.quantity;
                  } else {
                    combinedItems[key] = {
                      name: item.name,
                      price: item.price,
                      quantity: item.quantity,
                      total: item.price * item.quantity
                    };
                  }
                });
              });
              
              const tableTotal = tableOrders.reduce((sum, order) => sum + order.totalAmount, 0);
              const firstOrder = tableOrders[0];
              
              return (
                <div key={tableNum} className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-lg p-4 sm:p-6 mb-4">
                  {/* Table Header */}
                  <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-purple-200">
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        🍽️ Table {tableNum}
                      </h3>
                      <p className="text-sm text-gray-600">{tableOrders.length} order(s)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="text-2xl font-bold text-primary">₹{tableTotal}</p>
                    </div>
                  </div>

                  {/* Combined Bill */}
                  <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">{firstOrder.customerName} • {firstOrder.customerPhone}</p>
                      <p className="text-xs text-gray-500">{new Date(firstOrder.createdAt).toLocaleTimeString()}</p>
                    </div>

                    <div className="mb-4">
                      {Object.values(combinedItems).map((item, idx) => (
                        <div key={idx} className="flex justify-between py-2 text-sm">
                          <span>{item.name} x {item.quantity}</span>
                          <span>₹{item.total}</span>
                        </div>
                      ))}
                      <div className="border-t-2 mt-3 pt-3 flex justify-between font-bold text-lg">
                        <span>Subtotal</span>
                        <span className="text-primary">₹{tableTotal}</span>
                      </div>
                    </div>
                  </div>

                  {/* Kitchen Print, Print Receipt, and Generate Final Bill Buttons for Table */}
                  <div className="mt-4 pt-4 border-t-2 border-purple-200">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      {/* Kitchen Print Bill Button - Smart Visibility */}
                      {hasUnprintedKitchenItems(tableOrders) && (
                        <FeatureGuard feature="printerSettings">
                          <button
                            onClick={() => printKitchenOrder(tableNum, tableOrders)}
                            className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 sm:py-3 rounded-lg hover:from-orange-600 hover:to-red-600 font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-1 sm:gap-2"
                          >
                            🍳 <span className="hidden sm:inline">Print Bill</span><span className="sm:hidden">Kitchen</span>
                          </button>
                        </FeatureGuard>
                      )}
                      
                      {/* Print Receipt Button (Cash Counter) */}
                      <FeatureGuard feature="printerSettings">
                        <button
                          onClick={() => printReceipt(tableNum, tableOrders, tableTotal)}
                          className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 sm:py-3 rounded-lg hover:from-blue-600 hover:to-indigo-600 font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-1 sm:gap-2"
                        >
                          🖨️ <span className="hidden sm:inline">Print Receipt</span><span className="sm:hidden">Receipt</span>
                        </button>
                      </FeatureGuard>
                      
                      {/* Generate Final Bill Button */}
                      <button
                        onClick={() => generateBillForTable(tableNum, tableOrders, tableTotal)}
                        className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 sm:py-3 rounded-lg hover:from-purple-600 hover:to-pink-600 font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-1 sm:gap-2"
                      >
                        📄 <span className="hidden sm:inline">Final Bill</span><span className="sm:hidden">Bill</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {dineInOrders.length === 0 && (
              <div className="text-center py-12 text-gray-500">No table orders yet</div>
            )}
          </div>
        )}

        {activeTab === 'menu' && (
          <div>
            <FeatureGuard feature="menuManagement">
              <button
                onClick={() => setShowMenuForm(true)}
                className="mb-4 sm:mb-6 bg-primary text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-red-600 flex items-center gap-2 text-sm sm:text-base"
              >
                <Plus size={18} className="sm:w-5 sm:h-5" />
                Add Menu Item
              </button>
            </FeatureGuard>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {restaurant.menu.map((item) => (
                <div key={item._id} className={`bg-white rounded-lg shadow-md overflow-hidden ${
                  !item.available ? 'opacity-60 border-2 border-red-200' : ''
                }`}>
                  {/* Unavailable Badge */}
                  {!item.available && (
                    <div className="bg-red-500 text-white text-xs px-2 py-1 text-center">
                      UNAVAILABLE - Removed from menu
                    </div>
                  )}
                  
                  {/* Item Image */}
                  {item.image && (
                    <div className="h-32 bg-gray-100">
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className={`w-full h-full object-cover ${!item.available ? 'grayscale' : ''}`}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-bold ${!item.available ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                        {item.name}
                      </h3>
                      <div className="flex gap-2">
                        <FeatureGuard feature="menuManagement">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setMenuForm(item);
                              setShowMenuForm(true);
                            }}
                            className="text-blue-500 hover:text-blue-700"
                            title={!item.available ? 'Edit unavailable item' : 'Edit item'}
                          >
                            <Edit size={18} />
                          </button>
                        </FeatureGuard>
                        <FeatureGuard feature="menuManagement">
                          <button
                            onClick={() => deleteMenuItem(item._id)}
                            className="text-red-500 hover:text-red-700"
                            title={!item.available ? 'Permanently delete (if possible)' : 'Delete item'}
                          >
                            <Trash2 size={18} />
                          </button>
                        </FeatureGuard>
                      </div>
                    </div>
                    <p className={`text-sm mb-2 ${!item.available ? 'text-gray-400' : 'text-gray-600'}`}>
                      {item.description}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className={`text-lg font-bold ${!item.available ? 'text-gray-400 line-through' : 'text-primary'}`}>
                        ₹{item.price}
                      </span>
                      <span className={`text-sm ${!item.available ? 'text-gray-400' : 'text-gray-600'}`}>
                        {item.category}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <div>
                        {item.isVeg ? (
                          <span className={`text-sm ${!item.available ? 'text-gray-400' : 'text-green-600'}`}>
                            🌱 Veg
                          </span>
                        ) : (
                          <span className={`text-sm ${!item.available ? 'text-gray-400' : 'text-red-600'}`}>
                            🍖 Non-Veg
                          </span>
                        )}
                      </div>
                      {!item.available && (
                        <span className="text-xs text-red-500 font-medium">
                          In Order History
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {showMenuForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg p-4 sm:p-6 md:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">
                    {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
                  </h2>
                  <form onSubmit={handleMenuSubmit} className="space-y-4">
                    <div>
                      <label className="block text-gray-700 mb-2">Name</label>
                      <input
                        type="text"
                        required
                        value={menuForm.name}
                        onChange={(e) => setMenuForm({...menuForm, name: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">Price</label>
                      <input
                        type="number"
                        required
                        value={menuForm.price}
                        onChange={(e) => setMenuForm({...menuForm, price: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">Category</label>
                      <select
                        value={menuForm.category}
                        onChange={(e) => setMenuForm({...menuForm, category: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option>Starters</option>
                        <option>Main Course</option>
                        <option>Desserts</option>
                        <option>Drinks</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">Description</label>
                      <textarea
                        value={menuForm.description}
                        onChange={(e) => setMenuForm({...menuForm, description: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        rows="3"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-3 font-semibold">Image</label>
                      
                      {/* Upload Method Selection */}
                      <div className="flex gap-4 mb-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="url"
                            checked={imageUploadMethod === 'url'}
                            onChange={(e) => setImageUploadMethod(e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-700">Image URL</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="upload"
                            checked={imageUploadMethod === 'upload'}
                            onChange={(e) => setImageUploadMethod(e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-700">Upload File</span>
                        </label>
                      </div>

                      {/* Image URL Input */}
                      {imageUploadMethod === 'url' && (
                        <div>
                          <input
                            type="url"
                            value={menuForm.image}
                            onChange={(e) => setMenuForm({...menuForm, image: e.target.value})}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="https://example.com/image.jpg"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Direct link to image file (jpg, png, etc.)
                          </p>
                        </div>
                      )}

                      {/* File Upload */}
                      {imageUploadMethod === 'upload' && (
                        <div>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageFileChange}
                              className="hidden"
                              id="image-upload"
                            />
                            <label htmlFor="image-upload" className="cursor-pointer">
                              {imageFile ? (
                                <div>
                                  <p className="text-green-600 font-semibold mb-1">✓ {imageFile.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {(imageFile.size / (1024 * 1024)).toFixed(2)} MB
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setImageFile(null);
                                      setMenuForm({...menuForm, image: ''});
                                    }}
                                    className="text-xs text-red-500 hover:underline mt-2"
                                  >
                                    Remove file
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-gray-600 font-semibold mb-1">Click to upload image</p>
                                  <p className="text-xs text-gray-500">
                                    JPG, PNG up to 2MB
                                  </p>
                                </div>
                              )}
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Image Preview */}
                      {menuForm.image && (
                        <div className="mt-3">
                          <label className="block text-gray-700 mb-2">Preview</label>
                          <div className="bg-gray-100 rounded-lg overflow-hidden max-w-[200px]">
                            <img 
                              src={menuForm.image} 
                              alt="Preview" 
                              className="w-full h-32 object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">Type</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={menuForm.isVeg}
                            onChange={() => setMenuForm({...menuForm, isVeg: true})}
                            className="w-4 h-4"
                          />
                          <span className="text-green-600">🌱 Vegetarian</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={!menuForm.isVeg}
                            onChange={() => setMenuForm({...menuForm, isVeg: false})}
                            className="w-4 h-4"
                          />
                          <span className="text-red-600">🍖 Non-Vegetarian</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenuForm(false);
                          setEditingItem(null);
                          setMenuForm({ name: '', price: '', category: 'Starters', description: '', isVeg: true, image: '' });
                          setImageFile(null);
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-600"
                      >
                        {editingItem ? 'Update Item' : 'Add Item'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'qr' && (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <p className="text-sm text-blue-800 mb-2">
                <strong>📱 Scan to Order:</strong> Customers can scan these QR codes to order directly from their table without waiting for a waiter.
              </p>
              <p className="text-xs text-blue-700">
                💡 Print these QR codes and place them on each table. You can right-click and save each QR code image.
              </p>
            </div>

            <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                Table QR Codes ({restaurant.tables || 0} tables)
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    console.log('Current restaurant:', restaurant);
                    console.log('Restaurant ID:', localStorage.getItem('restaurantId'));
                    console.log('Current tables:', restaurant.tables);
                    alert(`Restaurant ID: ${localStorage.getItem('restaurantId')}\nCurrent tables: ${restaurant.tables}`);
                  }}
                  className="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 text-sm"
                  title="Debug Info"
                >
                  🐛 Debug
                </button>
                <FeatureGuard feature="tableManagement">
                  <button
                    onClick={addTable}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2 text-sm sm:text-base"
                  >
                    <Plus size={18} />
                    Add Table
                  </button>
                </FeatureGuard>
              </div>
            </div>
            {restaurant.tables === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-md">
                <p className="text-gray-500 mb-4">No tables added yet</p>
                <button
                  onClick={addTable}
                  className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-red-600"
                >
                  Add Your First Table
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {Array.from({ length: restaurant.tables || 0 }, (_, i) => i + 1).map((tableNum) => {
                  const qrUrl = `${window.location.origin}/qr/${restaurant._id}/${tableNum}`;
                  return (
                    <div key={tableNum} className="bg-white rounded-lg shadow-md p-4 text-center relative">
                      {/* Delete Button */}
                      {tableNum === restaurant.tables && (
                        <FeatureGuard feature="tableManagement">
                          <button
                            onClick={() => deleteTable(tableNum)}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                            title="Delete this table"
                          >
                            <X size={16} />
                          </button>
                        </FeatureGuard>
                      )}
                      
                      <div id={`qr-table-${tableNum}`} className="bg-white p-3 rounded-lg mb-3 inline-block border-2 border-gray-200">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}&margin=10`}
                          alt={`QR Code for Table ${tableNum}`}
                          className="w-[150px] h-[150px]"
                          crossOrigin="anonymous"
                        />
                      </div>
                      <p className="font-bold text-gray-800 text-lg mb-2">Table {tableNum}</p>
                      <p className="text-xs text-gray-500 mb-2">Scan to order</p>
                      <a
                        href={qrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-500 hover:underline block mb-2"
                      >
                        Test Link
                      </a>
                      <FeatureGuard feature="qrCodeGeneration">
                        <button
                          onClick={() => downloadQRCode(tableNum, qrUrl)}
                          className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:bg-red-600 w-full"
                        >
                          📥 Download QR
                        </button>
                      </FeatureGuard>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">📜 Order History</h2>
              <p className="text-gray-600 text-xs sm:text-sm">
                Completed orders: {orders.filter(o => o.status === 'completed').length}
              </p>
            </div>
            
            {/* Group completed orders by table/session */}
            {(() => {
              const completedOrders = orders.filter(order => order.status === 'completed');
              
              // Group dine-in orders by table and completion time (within 1 minute = same bill)
              const groupedOrders = [];
              const processedIds = new Set();
              
              completedOrders.forEach(order => {
                if (processedIds.has(order._id)) return;
                
                if (order.orderType === 'dine-in') {
                  // Find all orders from same table completed around the same time
                  const relatedOrders = completedOrders.filter(o => 
                    o.orderType === 'dine-in' &&
                    o.tableNumber === order.tableNumber &&
                    Math.abs(new Date(o.updatedAt) - new Date(order.updatedAt)) < 60000 // Within 1 minute
                  );
                  
                  relatedOrders.forEach(o => processedIds.add(o._id));
                  groupedOrders.push(relatedOrders);
                } else {
                  // Delivery orders are individual
                  processedIds.add(order._id);
                  groupedOrders.push([order]);
                }
              });
              
              return groupedOrders.map((orderGroup, groupIdx) => {
                const firstOrder = orderGroup[0];
                const isDineIn = firstOrder.orderType === 'dine-in';
                
                // Combine items if multiple orders
                const combinedItems = {};
                let totalAmount = 0;
                
                orderGroup.forEach(order => {
                  totalAmount += order.totalAmount;
                  order.items.forEach(item => {
                    const key = item.name;
                    if (combinedItems[key]) {
                      combinedItems[key].quantity += item.quantity;
                      combinedItems[key].total += item.price * item.quantity;
                    } else {
                      combinedItems[key] = {
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        total: item.price * item.quantity
                      };
                    }
                  });
                });
                
                return (
                  <div key={groupIdx} className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">
                          {isDineIn ? `🍽️ Table ${firstOrder.tableNumber}` : '🚚 Delivery Order'}
                          {orderGroup.length > 1 && ` (${orderGroup.length} orders)`}
                        </h3>
                        <p className="text-sm text-gray-600">{firstOrder.customerName} • {firstOrder.customerPhone}</p>
                        <p className="text-xs text-gray-500">{new Date(firstOrder.updatedAt).toLocaleString()}</p>
                        {firstOrder.deliveryAddress && (
                          <p className="text-sm text-gray-600 mt-1">📍 {firstOrder.deliveryAddress}</p>
                        )}
                      </div>
                      <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                        Completed
                      </span>
                    </div>

                    <div className="mb-4">
                      {Object.values(combinedItems).map((item, idx) => (
                        <div key={idx} className="flex justify-between py-1 text-sm">
                          <span>{item.name} x {item.quantity}</span>
                          <span>₹{item.total}</span>
                        </div>
                      ))}
                      <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                        <span>Total</span>
                        <span className="text-primary">₹{totalAmount}</span>
                      </div>
                    </div>

                    {/* Print Receipt Button for History */}
                    <div className="mt-3">
                      <FeatureGuard feature="printerSettings">
                        <button
                          onClick={() => {
                            if (orderGroup.length === 1) {
                              // Single order - print individual receipt
                              printIndividualReceipt(orderGroup[0]);
                            } else {
                              // Multiple orders - print combined receipt like table bill
                              printReceipt(
                                isDineIn ? firstOrder.tableNumber : 'Delivery', 
                                orderGroup, 
                                totalAmount
                              );
                            }
                          }}
                          className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 rounded-lg hover:from-blue-600 hover:to-indigo-600 font-semibold flex items-center justify-center gap-2"
                        >
                          🖨️ Print Receipt
                        </button>
                      </FeatureGuard>
                    </div>
                  </div>
                );
              });
            })()}
            
            {orders.filter(o => o.status === 'completed').length === 0 && (
              <div className="text-center py-12 text-gray-500">No completed orders yet</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}