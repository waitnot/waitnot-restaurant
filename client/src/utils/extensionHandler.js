/**
 * Extension Conflict Handler
 * Prevents Chrome extensions from interfering with the application
 */

class ExtensionHandler {
  constructor() {
    this.init();
  }

  init() {
    this.setupGlobalErrorHandling();
    this.setupConsoleFiltering();
    this.setupModuleLoadingProtection();
  }

  setupGlobalErrorHandling() {
    // Handle script loading errors from extensions
    window.addEventListener('error', (event) => {
      if (this.isExtensionError(event)) {
        console.warn('Extension error suppressed:', event.filename || event.message);
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
    }, true);

    // Handle promise rejections from extensions
    window.addEventListener('unhandledrejection', (event) => {
      if (this.isExtensionPromiseError(event)) {
        console.warn('Extension promise rejection suppressed:', event.reason?.message);
        event.preventDefault();
        return true;
      }
    });
  }

  setupConsoleFiltering() {
    // Filter out extension-related console errors
    const originalError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (this.isExtensionMessage(message)) {
        console.warn('Extension error filtered:', message);
        return;
      }
      originalError.apply(console, args);
    };
  }

  setupModuleLoadingProtection() {
    // Protect against extension module loading interference
    if (typeof window.importShim !== 'undefined') {
      const originalImportShim = window.importShim;
      window.importShim = function(url, ...args) {
        if (url && url.includes('chrome-extension://')) {
          console.warn('Extension module import blocked:', url);
          return Promise.resolve({});
        }
        return originalImportShim.call(this, url, ...args);
      };
    }

    // Protect dynamic imports
    const originalImport = window.__vitePreload || window.import;
    if (originalImport) {
      window.__vitePreload = function(url, ...args) {
        if (url && url.includes('chrome-extension://')) {
          console.warn('Extension preload blocked:', url);
          return Promise.resolve({});
        }
        return originalImport.call(this, url, ...args);
      };
    }
  }

  isExtensionError(event) {
    const indicators = [
      'chrome-extension://',
      'moz-extension://',
      'safari-extension://',
      'edge-extension://',
      'merlinUIComponentPortal',
      'Failed to fetch dynamically imported module'
    ];

    const filename = event.filename || '';
    const message = event.message || '';
    const stack = event.error?.stack || '';

    return indicators.some(indicator => 
      filename.includes(indicator) || 
      message.includes(indicator) || 
      stack.includes(indicator)
    );
  }

  isExtensionPromiseError(event) {
    const reason = event.reason;
    if (!reason) return false;

    const message = reason.message || reason.toString();
    const stack = reason.stack || '';

    const indicators = [
      'chrome-extension://',
      'moz-extension://',
      'Failed to fetch dynamically imported module',
      'merlinUIComponentPortal',
      'Extension context invalidated'
    ];

    return indicators.some(indicator => 
      message.includes(indicator) || 
      stack.includes(indicator)
    );
  }

  isExtensionMessage(message) {
    const indicators = [
      'chrome-extension://',
      'moz-extension://',
      'Extension context',
      'merlinUIComponentPortal',
      'Failed to fetch dynamically imported module'
    ];

    return indicators.some(indicator => message.includes(indicator));
  }

  // Method to manually suppress specific extension errors
  suppressExtensionError(errorPattern) {
    const originalError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes(errorPattern)) {
        console.warn('Custom extension error suppressed:', message);
        return;
      }
      originalError.apply(console, args);
    };
  }

  // Method to check if extensions are causing issues
  detectExtensionConflicts() {
    const conflicts = [];
    
    // Check for common extension indicators
    if (window.chrome && window.chrome.runtime) {
      conflicts.push('Chrome extension runtime detected');
    }
    
    // Check for extension-injected elements
    const extensionElements = document.querySelectorAll('[id*="extension"], [class*="extension"]');
    if (extensionElements.length > 0) {
      conflicts.push(`${extensionElements.length} extension elements found`);
    }
    
    // Check for extension scripts
    const scripts = document.querySelectorAll('script[src*="chrome-extension://"]');
    if (scripts.length > 0) {
      conflicts.push(`${scripts.length} extension scripts detected`);
    }

    return conflicts;
  }

  // Method to clean up extension artifacts
  cleanupExtensionArtifacts() {
    try {
      // Remove extension-injected elements
      const extensionElements = document.querySelectorAll(
        '[id*="chrome-extension"], [class*="chrome-extension"], [src*="chrome-extension://"]'
      );
      
      extensionElements.forEach(element => {
        try {
          element.remove();
          console.log('Removed extension element:', element.tagName);
        } catch (e) {
          console.warn('Could not remove extension element:', e.message);
        }
      });

      // Clear extension-related storage
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.includes('extension') || key.includes('chrome-extension')) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.warn('Could not clean extension storage:', e.message);
      }

    } catch (error) {
      console.warn('Extension cleanup failed:', error.message);
    }
  }
}

// Initialize extension handler
const extensionHandler = new ExtensionHandler();

// Export for manual use if needed
export default extensionHandler;

// Auto-cleanup on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => extensionHandler.cleanupExtensionArtifacts(), 1000);
  });
} else {
  setTimeout(() => extensionHandler.cleanupExtensionArtifacts(), 1000);
}