// Performance monitoring utilities
import { useState, useEffect } from 'react';

// Debounce function to limit API calls
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function to limit frequent operations
export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Memoization for expensive calculations
export const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

// Performance measurement
export const measurePerformance = (name, fn) => {
  return async (...args) => {
    const start = performance.now();
    const result = await fn(...args);
    const end = performance.now();
    console.log(`⚡ ${name} took ${(end - start).toFixed(2)}ms`);
    return result;
  };
};

// Lazy loading hook for components
export const useLazyLoad = (callback, dependencies = []) => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      callback();
      setIsLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, dependencies);
  
  return isLoaded;
};

// Virtual scrolling for large lists
export const useVirtualScroll = (items, itemHeight, containerHeight) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  
  const visibleItems = items.slice(visibleStart, visibleEnd);
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleStart * itemHeight;
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop
  };
};

// Bundle size analyzer (development only)
export const analyzeBundleSize = () => {
  if (process.env.NODE_ENV === 'development') {
    const scripts = document.querySelectorAll('script[src]');
    let totalSize = 0;
    
    scripts.forEach(script => {
      fetch(script.src)
        .then(response => response.blob())
        .then(blob => {
          totalSize += blob.size;
          console.log(`📦 Script: ${script.src.split('/').pop()} - ${(blob.size / 1024).toFixed(2)}KB`);
        });
    });
    
    setTimeout(() => {
      console.log(`📦 Total bundle size: ${(totalSize / 1024).toFixed(2)}KB`);
    }, 1000);
  }
};

// Memory usage monitoring
export const monitorMemoryUsage = () => {
  if (performance.memory) {
    const memory = performance.memory;
    console.log('🧠 Memory Usage:', {
      used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
    });
  }
};

// Network speed detection
export const detectNetworkSpeed = () => {
  return new Promise((resolve) => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
      resolve({
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt
      });
    } else {
      // Fallback: measure download speed
      const startTime = Date.now();
      const image = new Image();
      image.onload = () => {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        const bitsLoaded = 50000 * 8; // Approximate image size in bits
        const speedBps = bitsLoaded / duration;
        const speedKbps = speedBps / 1024;
        
        resolve({
          effectiveType: speedKbps > 1000 ? '4g' : speedKbps > 100 ? '3g' : '2g',
          downlink: speedKbps / 1000,
          rtt: duration * 1000
        });
      };
      image.src = '/logo.png?' + Math.random();
    }
  });
};