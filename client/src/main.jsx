import React from 'react'
import ReactDOM from 'react-dom/client'
import './polyfills' // Import polyfills for Edge browser compatibility
import './config/axios' // Configure axios for production
import './config/api' // Configure API for production
import App from './App.jsx'
import './index.css'
import './i18n'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
