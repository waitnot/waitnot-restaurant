const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app-version'),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  
  // Restaurant app specific APIs
  openExternal: (url) => {
    // This will be handled by the main process
    window.open(url, '_blank');
  },
  
  // Print functionality
  print: () => {
    window.print();
  },
  
  // Notification API
  showNotification: (title, body) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      });
    }
  }
});

// Inject custom styles for better desktop experience
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded in desktop app');
  
  const style = document.createElement('style');
  style.textContent = `
    /* Desktop app specific styles */
    body {
      user-select: none; /* Prevent text selection for better app feel */
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    }
    
    /* Allow text selection in input fields */
    input, textarea, [contenteditable] {
      user-select: text !important;
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
    }
    
    /* Custom scrollbar for desktop */
    ::-webkit-scrollbar {
      width: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }
    
    /* Desktop app indicator */
    .desktop-app-indicator {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      z-index: 10000;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
  
  // Add desktop app indicator
  const indicator = document.createElement('div');
  indicator.className = 'desktop-app-indicator';
  indicator.textContent = '🖥️ Desktop App';
  document.body.appendChild(indicator);
  
  // Hide indicator after 3 seconds
  setTimeout(() => {
    indicator.style.opacity = '0';
    indicator.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      indicator.remove();
    }, 500);
  }, 3000);
  
  console.log('Desktop app styles and indicator added');
});

// Enhanced error handling
window.addEventListener('error', (event) => {
  console.error('Desktop App Error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Desktop App Unhandled Rejection:', event.reason);
});