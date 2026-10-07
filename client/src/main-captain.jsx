import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';

// Force production API for APK - must be set before any imports that use axios
import axios from 'axios';
axios.defaults.baseURL = 'https://waitnot-restaurant1.onrender.com';

// Wake server immediately on app launch — Render free tier sleeps after inactivity.
// Fire-and-forget: doesn't block rendering, just gets the server warming up ASAP.
fetch('https://waitnot-restaurant1.onrender.com/health').catch(() => {});

import StaffLogin from './pages/StaffLogin';
import StaffDashboard from './pages/StaffDashboard';

// ─── Auto-Update ────────────────────────────────────────────────────────────
// Bump this number every time you build and release a new APK.
// When server versionCode > CURRENT_VERSION_CODE → update prompt shows.
// When they are equal → no prompt (no update available).
const CURRENT_VERSION_CODE = 5;

let _updateDialogVisible = false; // prevent stacking multiple dialogs

async function checkForUpdate() {
  if (_updateDialogVisible) return; // already showing
  try {
    const res = await fetch('https://waitnot-restaurant1.onrender.com/api/app-version', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();

    // No update available
    if (!data.versionCode || data.versionCode <= CURRENT_VERSION_CODE) return;

    // Skip if dismissed within 6h (unless forceUpdate)
    if (!data.forceUpdate) {
      const dismissed = localStorage.getItem('app_version_dismissed');
      if (dismissed) {
        const hoursSince = (Date.now() - parseInt(dismissed)) / 3600000;
        if (hoursSince < 6) return;
      }
    }

    showUpdateDialog(data);
  } catch (_) {
    // Silently fail — no internet or server down
  }
}

function showUpdateDialog({ version, releaseNotes, forceUpdate, downloadUrl }) {
  if (_updateDialogVisible) return;
  _updateDialogVisible = true;
  document.getElementById('update-dialog')?.remove();

  const updateUrl = downloadUrl || 'https://waitnot-restaurant1.onrender.com/updates-apk';

  const overlay = document.createElement('div');
  overlay.id = 'update-dialog';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    display:flex;align-items:center;justify-content:center;
    z-index:99999;padding:24px;
  `;

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px;max-width:340px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:48px;margin-bottom:8px;">🚀</div>
        <h2 style="margin:0;font-size:22px;font-weight:800;color:#111;">Update Available</h2>
        <p style="margin:6px 0 0;color:#666;font-size:14px;font-weight:600;">Version ${version} is ready</p>
      </div>
      ${releaseNotes ? `<div style="font-size:13px;color:#555;background:#f5f5f5;padding:12px 14px;border-radius:10px;margin:14px 0;line-height:1.6;">${releaseNotes}</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:18px;">
        <button id="update-now-btn"
          style="display:block;width:100%;text-align:center;background:#EF4444;color:#fff;padding:15px;border-radius:12px;font-weight:700;font-size:17px;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(239,68,68,0.4);">
          ⬇ Update Now
        </button>
        ${!forceUpdate ? `
        <button id="update-later"
          style="background:none;border:1.5px solid #e5e7eb;padding:12px;border-radius:12px;font-size:14px;color:#6b7280;cursor:pointer;width:100%;font-weight:500;">
          Remind me in 6 hours
        </button>` : ''}
      </div>
      ${forceUpdate ? `<p style="text-align:center;font-size:12px;color:#EF4444;margin-top:12px;font-weight:700;">⚠ This update is required to continue</p>` : ''}
    </div>
  `;

  document.body.appendChild(overlay);

  const openUrl = (url) => {
    try {
      if (window.Capacitor?.Plugins?.Browser) {
        window.Capacitor.Plugins.Browser.open({ url });
      } else {
        window.open(url, '_system');
      }
    } catch (_) {
      window.open(url, '_blank');
    }
  };

  document.getElementById('update-now-btn')?.addEventListener('click', () => {
    overlay.remove();
    _updateDialogVisible = false;
    openUrl(updateUrl);
  });

  document.getElementById('update-later')?.addEventListener('click', () => {
    localStorage.setItem('app_version_dismissed', Date.now());
    overlay.remove();
    _updateDialogVisible = false;
  });

  // Block backdrop dismiss for forceUpdate
  if (!forceUpdate) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        localStorage.setItem('app_version_dismissed', Date.now());
        overlay.remove();
        _updateDialogVisible = false;
      }
    });
  } else {
    overlay.addEventListener('click', e => e.stopPropagation());
  }
}

// ── Check on startup (after 2s so app renders first)
setTimeout(checkForUpdate, 2000);

// ── Check every 30 minutes while app is open
setInterval(checkForUpdate, 30 * 60 * 1000);

// ── Check every time app comes back to foreground (user switches back)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForUpdate();
});

// ── Capacitor appStateChange (most reliable for Android)
if (window.Capacitor?.isNativePlatform?.()) {
  import('@capacitor/core').then(({ App }) => {
    App?.addListener?.('appStateChange', ({ isActive }) => {
      if (isActive) checkForUpdate();
    });
  }).catch(() => {
    // Fallback: listen via Capacitor bridge directly
    try {
      window.Capacitor.Plugins.App?.addListener('appStateChange', ({ isActive }) => {
        if (isActive) checkForUpdate();
      });
    } catch (_) {}
  });
}
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
