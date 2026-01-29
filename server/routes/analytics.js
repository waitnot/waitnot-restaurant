import express from 'express';
import { orderDB } from '../db.js';

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
      acc[method] = (acc[method] || 0) + 1;
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
        payment: Object.entries(paymentBreakdown).map(([method, count]) => ({ method, count })),
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
    const { type = 'weekly', format = 'json' } = req.query;
    
    const orders = await orderDB.findByRestaurant(restaurantId);
    
    // Calculate date range based on report type
    const now = new Date();
    let startDate, endDate = now;
    
    switch (type) {
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
    
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });
    
    const reportData = filteredOrders.map(order => ({
      orderId: order._id,
      date: new Date(order.createdAt).toLocaleDateString(),
      time: new Date(order.createdAt).toLocaleTimeString(),
      customer: order.customerName || 'N/A',
      phone: order.customerPhone || 'N/A',
      type: order.type || 'dine-in',
      table: order.tableNumber || 'N/A',
      status: order.status,
      paymentMethod: order.paymentMethod || 'cash',
      paymentStatus: order.paymentStatus || 'pending',
      items: order.items ? order.items.map(item => `${item.name} x${item.quantity}`).join('; ') : '',
      totalAmount: order.totalAmount || order.total || 0,
      deliveryAddress: order.deliveryAddress || 'N/A'
    }));
    
    if (format === 'csv') {
      // Convert to CSV
      const headers = Object.keys(reportData[0] || {});
      const csvRows = [
        headers.join(','),
        ...reportData.map(row => 
          headers.map(header => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
          }).join(',')
        )
      ];
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_report_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvRows.join('\n'));
    } else {
      res.json({
        type,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        totalRecords: reportData.length,
        data: reportData
      });
    }
    
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;