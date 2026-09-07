import React from 'react'
import ReactDOM from 'react-dom/client'
import './polyfills' // Import polyfills for Edge browser compatibility
import './utils/extensionHandler' // Handle Chrome extension conflicts
import './config/environment' // Initialize environment configuration first
import './config/axios' // Configure axios for production
import './config/api' // Configure API for production
import App from './App.jsx'
import './index.css'
import './i18n'

// Extension Error Boundary Component
class ExtensionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Ignore Chrome extension errors
    if (error.stack && error.stack.includes('chrome-extension://')) {
      console.warn('Extension error caught by boundary:', error.message);
      return { hasError: false };
    }
    // Ignore WebSocket / network errors — these are transient on free-tier hosting
    const msg = error.message || '';
    if (msg.includes('WebSocket') || msg.includes('socket') || msg.includes('Network') || msg.includes('fetch')) {
      console.warn('Network error suppressed by boundary:', msg);
      return { hasError: false };
    }
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    if (error.stack && error.stack.includes('chrome-extension://')) {
      console.warn('Extension error suppressed:', error.message);
      this.setState({ hasError: false });
      return;
    }
    const msg = error.message || '';
    if (msg.includes('WebSocket') || msg.includes('socket') || msg.includes('Network') || msg.includes('fetch')) {
      console.warn('Network error suppressed:', msg);
      this.setState({ hasError: false });
      return;
    }
    console.error('Application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Auto-reload after 4 seconds for transient errors
      if (!this._reloadTimer) {
        this._reloadTimer = setTimeout(() => window.location.reload(), 4000);
      }
      return (
        <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
          <h2>Something went wrong.</h2>
          <p>Please refresh the page to continue.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ExtensionErrorBoundary>
      <App />
    </ExtensionErrorBoundary>
  </React.StrictMode>,
)
