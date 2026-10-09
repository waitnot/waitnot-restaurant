import express from 'express';
import { orderDB } from '../db.js';
import { query } from '../database/connection.js';

const router = express.Router();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Analytics API is working!', timestamp: new Date().toISOString() });
});

// Get analytics data for a restaurant
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { period = 'week' } = req.query;
    
    console.log(`Analytics request for restaurant: ${restaurantId}, period: ${period}`);
    
    // Get all orders for the restaurant
    const orders = await orderDB.findByRestaurant(restaurantId);
    console.log(`Analytics: Found ${orders.length} orders for restaurant ${restaurantId}`);
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(0); // All time
    }
    
    // Filter orders by date range
    const filteredOrders = orders.filter(order => 
      new Date(order.createdAt) >= startDate
    );
    
    console.log(`Analytics: Filtered to ${filteredOrders.length} orders for period ${period}`);
    
    // Calculate basic metrics
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const completedOrders = filteredOrders.filter(order => order.status === 'completed').length;
    const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;
    
    // Order status breakdown
    const statusBreakdown = filteredOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});
    
    // Payment method breakdown
    const paymentBreakdown = filteredOrders.reduce((acc, order) => {
      const method = order.paymentMethod || 'cash';
      if (!acc[method]) acc[method] = { count: 0, revenue: 0 };
      acc[method].count += 1;
      acc[method].revenue += parseFloat(order.totalAmount || order.total || 0);
      return acc;
    }, {});
    
    // Order type breakdown
    const typeBreakdown = filteredOrders.reduce((acc, order) => {
      const type = order.orderType || order.type || 'dine-in';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    // Daily revenue for the last 30 days
    const dailyRevenue = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate.toDateString() === date.toDateString();
      });
      const revenue = dayOrders.reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0);
      dailyRevenue.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue,
        orders: dayOrders.length
      });
    }
    
    // Popular items
    const itemCounts = {};
    filteredOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.quantity || 1);
        });
      }
    });
    
    const popularItems = Object.entries(itemCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, quantity]) => ({ name, quantity }));
    
    // Hourly distribution
    const hourlyOrders = Array(24).fill(0);
    filteredOrders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      hourlyOrders[hour]++;
    });
    
    const hourlyData = hourlyOrders.map((count, hour) => ({
      hour: `${hour}:00`,
      orders: count
    }));
    
    // Peak hour
    const peakHour = hourlyOrders.indexOf(Math.max(...hourlyOrders));
    const peakHourRange = `${peakHour}:00 - ${peakHour + 1}:00`;
    
    // Monthly comparison (current vs previous month)
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    const currentMonthOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= currentMonth && orderDate < nextMonth;
    });
    
    const previousMonthOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= previousMonth && orderDate < currentMonth;
    });
    
    const currentMonthRevenue = currentMonthOrders.reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0);
    const previousMonthRevenue = previousMonthOrders.reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0);
    
    const revenueGrowth = previousMonthRevenue > 0 
      ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
      : 0;
    
    // Customer insights
    const customerOrders = {};
    filteredOrders.forEach(order => {
      if (order.customerPhone) {
        customerOrders[order.customerPhone] = (customerOrders[order.customerPhone] || 0) + 1;
      }
    });
    
    const repeatCustomers = Object.values(customerOrders).filter(count => count > 1).length;
    const totalCustomers = Object.keys(customerOrders).length;
    const repeatCustomerRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
    
    console.log(`Analytics: ${totalCustomers} customers, ${repeatCustomers} repeat customers`);
    
    res.json({
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      metrics: {
        totalOrders,
        totalRevenue,
        avgOrderValue,
        completionRate,
        revenueGrowth,
        repeatCustomerRate
      },
      breakdowns: {
        status: Object.entries(statusBreakdown).map(([status, count]) => ({ status, count })),
        payment: Object.entries(paymentBreakdown).map(([method, data]) => ({ method, count: data.count, revenue: Math.round(data.revenue) })),
        type: Object.entries(typeBreakdown).map(([type, count]) => ({ type, count }))
      },
      trends: {
        dailyRevenue,
        hourlyData,
        peakHourRange
      },
      insights: {
        popularItems,
        totalCustomers,
        repeatCustomers,
        repeatCustomerRate
      }
    });
    
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get detailed report data for download
router.get('/restaurant/:restaurantId/report', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { type = 'weekly', format = 'json', clearHistory = 'false' } = req.query;
    
    const orders = await orderDB.findByRestaurant(restaurantId);

    // Include archived orders so sales reports are never missing historical data
    let archivedOrders = [];
    try {
      const archResult = await query(`SELECT order_data FROM order_archives WHERE restaurant_id = $1`, [restaurantId]);
      archivedOrders = archResult.rows.map(r => {
        try { return typeof r.order_data === 'string' ? JSON.parse(r.order_data) : r.order_data; } catch { return null; }
      }).filter(Boolean);
    } catch (_) {}
    const allOrders = [...orders, ...archivedOrders];
    
    // Calculate date range based on report type
    const now = new Date();
    let startDate, endDate = now;
    
    switch (type) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(0);
    }
    
    const filteredOrders = allOrders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });
    
    const reportData = filteredOrders.map((order, idx) => {
      const subtotal   = (order.items || []).reduce((s, i) => s + (parseFloat(i.price)||0) * (parseInt(i.quantity)||1), 0);
      const discount   = parseFloat(order.discountAmount || 0);
      const taxableVal = Math.max(0, subtotal - discount);
      const cgst       = parseFloat(((taxableVal * 2.5) / 100).toFixed(2));
      const sgst       = cgst;
      const totalInv   = parseFloat((taxableVal + cgst + sgst).toFixed(2));
      const invNum     = order.invoiceNumber || order.invoice_number;
      const invLabel   = invNum ? `INV-${String(invNum).padStart(3,'0')}` : `ORD-${String(order.orderNumber || order.order_number || idx+1).padStart(3,'0')}`;

      const orderTypeLabel = order.orderType === 'dine-in' || order.type === 'dine-in' ? 'Dine-in'
        : (order.orderType||order.type) === 'takeaway' ? 'Takeaway'
        : (order.orderType||order.type) === 'delivery' ? 'Delivery'
        : (order.orderType||order.type) === 'room'     ? 'Room' : 'Online';

      const payMode = (order.paymentMethod||'cash') === 'cash' ? 'Cash'
        : (order.paymentMethod||'') === 'online' ? 'UPI'
        : (order.paymentMethod||'') === 'card'   ? 'Card' : 'Other';

      const channel  = order.source === 'staff' ? 'Direct' : order.source === 'qr' ? 'Waitnot' : 'Other';
      const invDate  = new Date(order.updatedAt || order.createdAt).toLocaleDateString('en-IN');
      const status   = order.status === 'completed' ? 'Completed' : order.status === 'cancelled' ? 'Cancelled' : 'Completed';

      return {
        'Invoice Number':     invLabel,
        'Invoice Date':       invDate,
        'Order ID':           order._id || order.id || '',
        'Outlet ID':          order.restaurantId || order.restaurant_id || '',
        'Customer Type':      'B2C',
        'Customer Name':      order.customerName || order.customer_name || '',
        'Customer GSTIN':     '',
        'Customer State':     '',
        'Place of Supply':    '',
        'State Code':         '',
        'Order Type':         orderTypeLabel,
        'Sales Channel':      channel,
        'Payment Mode':       payMode,
        'Subtotal':           subtotal.toFixed(2),
        'Discount':           discount.toFixed(2),
        'Taxable Value':      taxableVal.toFixed(2),
        'CGST':               cgst.toFixed(2),
        'SGST':               sgst.toFixed(2),
        'IGST':               '0.00',
        'CESS':               '0.00',
        'Total Invoice Value': totalInv.toFixed(2),
        'GST Rate':           '5%',
        'SAC/HSN':            '996331',
        'Invoice Status':     status,
        'Credit Note':        '',
        'Debit Note':         '',
      };
    });
    
    // Clear order history if requested
    if (clearHistory === 'true') {
      console.log(`Clearing order history for restaurant ${restaurantId} after ${type} report generation`);
      // Use the archive endpoint instead of hard-deleting
      try {
        const archiveRes = await fetch(`http://localhost:${process.env.PORT || 5001}/api/orders/restaurant/${restaurantId}/clear-history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const archiveData = await archiveRes.json();
        console.log(`Archived ${archiveData.archivedCount || 0} orders`);
      } catch (archErr) {
        console.warn('Archive via API failed, using direct query:', archErr.message);
        // Fallback: direct soft-delete
        const completedOrderIds = filteredOrders.filter(o => o.status === 'completed').map(o => o._id);
        if (completedOrderIds.length > 0) {
          const ph = completedOrderIds.map((_, i) => `$${i+1}`).join(',');
          await query(`UPDATE orders SET archived = true, deleted_at = CURRENT_TIMESTAMP WHERE id IN (${ph})`, completedOrderIds);
          await query(`INSERT INTO invoice_counters (restaurant_id, last_invoice_number) VALUES ($1, 0) ON CONFLICT (restaurant_id) DO UPDATE SET last_invoice_number = 0`, [restaurantId]);
        }
      }
    }
    
    if (format === 'csv') {
      const headers = Object.keys(reportData[0] || {});
      const escape  = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
      const csvRows = [
        headers.map(escape).join(','),
        ...reportData.map(row => headers.map(h => escape(row[h])).join(','))
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_invoice_report_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('\uFEFF' + csvRows.join('\r\n')); // UTF-8 BOM for Excel
    } else {
      res.json({
        type,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        totalRecords: reportData.length,
        clearedHistory: clearHistory === 'true',
        clearedOrders: clearHistory === 'true' ? filteredOrders.filter(o => o.status === 'completed').length : 0,
        data: reportData
      });
    }
    
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear order history endpoint
router.delete('/restaurant/:restaurantId/history', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { type = 'completed' } = req.query; // 'completed', 'all', or specific status
    
    console.log(`Clearing order history for restaurant ${restaurantId}, type: ${type}`);
    
    const orders = await orderDB.findByRestaurant(restaurantId);
    
    let ordersToDelete = [];
    
    if (type === 'all') {
      ordersToDelete = orders;
    } else if (type === 'completed') {
      ordersToDelete = orders.filter(order => order.status === 'completed');
    } else {
      ordersToDelete = orders.filter(order => order.status === type);
    }
    
    const orderIds = ordersToDelete.map(order => order._id);
    
    if (orderIds.length > 0) {
      await orderDB.deleteMultiple(orderIds);
      console.log(`Successfully cleared ${orderIds.length} orders from history`);
      
      res.json({
        success: true,
        message: `Successfully cleared ${orderIds.length} orders from history`,
        clearedCount: orderIds.length,
        type: type
      });
    } else {
      res.json({
        success: true,
        message: 'No orders found to clear',
        clearedCount: 0,
        type: type
      });
    }
    
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;