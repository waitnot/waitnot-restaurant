// Google Analytics utility functions
export const GA_TRACKING_ID = 'G-735FX9347D';

// Initialize Google Analytics
export const initGA = () => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_TRACKING_ID, {
      page_title: document.title,
      page_location: window.location.href,
    });
  }
};

// Track page views
export const trackPageView = (url, title) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_TRACKING_ID, {
      page_title: title,
      page_location: url,
    });
  }
};

// Track custom events
export const trackEvent = (action, category, label, value) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Track restaurant-specific events
export const trackRestaurantEvent = (action, restaurantId, details = {}) => {
  trackEvent(action, 'Restaurant', restaurantId, details);
};

// Track QR ordering events
export const trackQROrderEvent = (action, restaurantId, tableNumber, details = {}) => {
  trackEvent(action, 'QR_Ordering', `${restaurantId}_table_${tableNumber}`, {
    restaurant_id: restaurantId,
    table_number: tableNumber,
    ...details
  });
};

// Track menu interactions
export const trackMenuEvent = (action, itemName, category, price) => {
  trackEvent(action, 'Menu', itemName, {
    item_category: category,
    item_price: price
  });
};

// Track order events
export const trackOrderEvent = (action, orderId, totalAmount, itemCount) => {
  trackEvent(action, 'Orders', orderId, {
    order_total: totalAmount,
    item_count: itemCount
  });
};

// Track user authentication
export const trackAuthEvent = (action, userType) => {
  trackEvent(action, 'Authentication', userType);
};

// Track admin actions
export const trackAdminEvent = (action, feature, details = {}) => {
  trackEvent(action, 'Admin', feature, details);
};

// Track pricing plan interactions
export const trackPricingEvent = (action, planName, planPrice) => {
  trackEvent(action, 'Pricing', planName, {
    plan_price: planPrice
  });
};

// Track WhatsApp interactions
export const trackWhatsAppEvent = (action, context) => {
  trackEvent(action, 'WhatsApp', context);
};

// Track search events
export const trackSearchEvent = (searchTerm, resultCount) => {
  trackEvent('search', 'Restaurant_Search', searchTerm, {
    search_results: resultCount
  });
};

// Track conversion events
export const trackConversion = (conversionType, value) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'conversion', {
      send_to: GA_TRACKING_ID,
      event_category: 'Conversions',
      event_label: conversionType,
      value: value
    });
  }
};

// Track enhanced ecommerce events
export const trackPurchase = (transactionId, items, totalValue) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: transactionId,
      value: totalValue,
      currency: 'INR',
      items: items.map(item => ({
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        quantity: item.quantity,
        price: item.price
      }))
    });
  }
};

// Track user engagement
export const trackEngagement = (engagementType, duration) => {
  trackEvent('engagement', 'User_Engagement', engagementType, {
    engagement_time: duration
  });
};

// Track errors
export const trackError = (errorType, errorMessage, page) => {
  trackEvent('exception', 'Errors', errorType, {
    description: errorMessage,
    page: page,
    fatal: false
  });
};

// Track performance metrics
export const trackPerformance = (metricName, value, page) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'timing_complete', {
      name: metricName,
      value: Math.round(value),
      event_category: 'Performance',
      event_label: page
    });
  }
};