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
    // Check if error is from Chrome extension
    if (error.stack && error.stack.includes('chrome-extension://')) {
      console.warn('Extension error caught by boundary:', error.message);
      return { hasError: false }; // Don't show error UI for extension errors
    }
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log extension errors but don't crash the app
    if (error.stack && error.stack.includes('chrome-extension://')) {
      console.warn('Extension error suppressed:', error.message);
      this.setState({ hasError: false });
      return;
    }
    console.error('Application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          fontFamily: 'Arial, sans-serif' 
        }}>
          <h2>Something went wrong.</h2>
          <p>Please refresh the page to continue.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
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
