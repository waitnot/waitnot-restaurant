import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import StaffLogin from './pages/StaffLogin';
import StaffDashboard from './pages/StaffDashboard';

// Captain App — Staff only, opens directly to staff login
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/staff-login" replace />} />
        <Route path="/staff-login" element={<StaffLogin />} />
        <Route path="/staff-dashboard" element={<StaffDashboard />} />
        <Route path="*" element={<Navigate to="/staff-login" replace />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
