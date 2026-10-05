import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';

// Force production API for APK - must be set before any imports that use axios
import axios from 'axios';
axios.defaults.baseURL = 'https://waitnot-restaurant.onrender.com';

import StaffLogin from './pages/StaffLogin';
import StaffDashboard from './pages/StaffDashboard';

// Error boundary to show errors instead of blank screen
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error('Captain App Error:', e, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', background: '#fff', minHeight: '100vh' }}>
          <h2 style={{ color: '#EF4444' }}>⚠️ App Error</h2>
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: '#333' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: '8px 16px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8 }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <HelmetProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/staff-login" replace />} />
          <Route path="/staff-login" element={<StaffLogin />} />
          <Route path="/staff-dashboard" element={<StaffDashboard />} />
          <Route path="*" element={<Navigate to="/staff-login" replace />} />
        </Routes>
      </HashRouter>
    </HelmetProvider>
  </ErrorBoundary>
);
