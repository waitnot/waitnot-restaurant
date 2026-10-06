import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';

// Force production API for APK - must be set before any imports that use axios
import axios from 'axios';
axios.defaults.baseURL = 'https://waitnot-restaurant1.onrender.com';

import StaffLogin from './pages/StaffLogin';
import StaffDashboard from './pages/StaffDashboard';

// ─── Auto-Update ────────────────────────────────────────────────────────────
// Bump this number every time you build and release a new APK.
// When server versionCode > CURRENT_VERSION_CODE → update prompt shows.
// When they are equal → no prompt (no update available).
const CURRENT_VERSION_CODE = 1;

async function checkForUpdate() {
  try {
    const res = await fetch('https://waitnot-restaurant1.onrender.com/api/app-version');
    if (!res.ok) return;
    const data = await res.json();

    // No update available — server version matches or is older than this build
    if (!data.versionCode || data.versionCode <= CURRENT_VERSION_CODE) return;

    // Skip if user already dismissed this version within 24h (unless forceUpdate)
    if (!data.forceUpdate) {
      const dismissed = localStorage.getItem('app_version_dismissed');
      if (dismissed) {
        const hoursSince = (Date.now() - parseInt(dismissed)) / 3600000;
        if (hoursSince < 24) return;
      }
    }

    showUpdateDialog(data);
  } catch (_) {
    // Silently fail — no internet or server down
  }
}

function showUpdateDialog({ version, releaseNotes, forceUpdate, downloadUrl }) {
  document.getElementById('update-dialog')?.remove();

  // Use provided downloadUrl, otherwise fall back to the app-version page
  const updateUrl = downloadUrl || 'https://waitnot-restaurant1.onrender.com/updates-apk';

  const overlay = document.createElement('div');
  overlay.id = 'update-dialog';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    display:flex;align-items:center;justify-content:center;
    z-index:99999;padding:24px;
  `;

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;max-width:340px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:40px;margin-bottom:8px;">🚀</div>
        <h2 style="margin:0;font-size:20px;font-weight:700;color:#111;">Update Available</h2>
        <p style="margin:6px 0 0;color:#666;font-size:14px;">Version ${version} is ready</p>
      </div>
      ${releaseNotes ? `<p style="font-size:13px;color:#555;background:#f5f5f5;padding:10px 12px;border-radius:8px;margin:12px 0;">${releaseNotes}</p>` : ''}
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px;">
        <button onclick="document.getElementById('update-dialog').remove();window.open('${updateUrl}','_system')"
          style="display:block;width:100%;text-align:center;background:#EF4444;color:#fff;padding:14px;border-radius:10px;font-weight:600;font-size:16px;border:none;cursor:pointer;">
          ⬇ Update Now
        </button>
        ${!forceUpdate ? `
        <button id="update-later"
          style="background:none;border:1px solid #ddd;padding:12px;border-radius:10px;font-size:14px;color:#666;cursor:pointer;width:100%;">
          Remind me later
        </button>` : ''}
      </div>
      ${forceUpdate ? `<p style="text-align:center;font-size:12px;color:#EF4444;margin-top:10px;font-weight:600;">⚠ This update is required to continue</p>` : ''}
    </div>
  `;

  document.body.appendChild(overlay);
  document.getElementById('update-later')?.addEventListener('click', () => {
    localStorage.setItem('app_version_dismissed', Date.now());
    overlay.remove();
  });
  if (forceUpdate) overlay.addEventListener('click', e => e.stopPropagation());
}

// Check after 3s so the app renders first
setTimeout(checkForUpdate, 3000);
// ─────────────────────────────────────────────────────────────────────────────

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
