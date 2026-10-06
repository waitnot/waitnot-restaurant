import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';

// Force production API for APK - must be set before any imports that use axios
import axios from 'axios';
axios.defaults.baseURL = 'https://waitnot-restaurant-2.onrender.com';

import StaffLogin from './pages/StaffLogin';
import StaffDashboard from './pages/StaffDashboard';

// Current APK version — bump this with every new APK build
const CURRENT_VERSION_CODE = 1;

// Check for updates on launch
async function checkForUpdate() {
  try {
    const res = await fetch('https://waitnot-restaurant-2.onrender.com/api/app-version');
    if (!res.ok) return;
    const data = await res.json();
    if (data.versionCode > CURRENT_VERSION_CODE) {
      showUpdateDialog(data);
    }
  } catch (_) {
    // Silently fail — no internet or server down
  }
}

function showUpdateDialog({ version, apkUrl, releaseNotes, forceUpdate }) {
  // Remove any existing dialog
  document.getElementById('update-dialog')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'update-dialog';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.6);
    display:flex;align-items:center;justify-content:center;
    z-index:99999;padding:24px;
  `;

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:40px;margin-bottom:8px;">🚀</div>
        <h2 style="margin:0;font-size:20px;font-weight:700;color:#111;">Update Available</h2>
        <p style="margin:6px 0 0;color:#666;font-size:14px;">Version ${version} is ready</p>
      </div>
      ${releaseNotes ? `<p style="font-size:13px;color:#555;background:#f5f5f5;padding:10px 12px;border-radius:8px;margin:12px 0;">${releaseNotes}</p>` : ''}
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px;">
        <a href="${apkUrl}" download
          style="display:block;text-align:center;background:#EF4444;color:#fff;padding:14px;border-radius:10px;font-weight:600;font-size:16px;text-decoration:none;">
          Download & Install
        </a>
        ${!forceUpdate ? `
        <button id="update-later"
          style="background:none;border:1px solid #ddd;padding:12px;border-radius:10px;font-size:14px;color:#666;cursor:pointer;">
          Later
        </button>` : ''}
      </div>
      ${forceUpdate ? `<p style="text-align:center;font-size:12px;color:#EF4444;margin-top:10px;">Update required to continue</p>` : ''}
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('update-later')?.addEventListener('click', () => overlay.remove());
  if (forceUpdate) overlay.addEventListener('click', (e) => e.stopPropagation());
}

// Run update check after a short delay (let app render first)
setTimeout(checkForUpdate, 3000);

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
