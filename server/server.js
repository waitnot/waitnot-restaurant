import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initDB } from './db.js';
import { ensureStartupData } from './startup-check.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import restaurantRoutes from './routes/restaurants.js';
import orderRoutes from './routes/orders.js';
import authRoutes from './routes/auth.js';
import analyticsRoutes from './routes/analytics.js';
import adminRoutes from './routes/admin.js';
import feedbackRoutes from './routes/feedback.js';
import thirdPartyOrderRoutes from './routes/thirdPartyOrders.js';
import printerSettingsRoutes from './routes/printerSettings.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// CORS configuration with Edge browser support and Vercel domains
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      'https://waitnot-restaurant.onrender.com',
      'https://waitnot-restaurant-app.vercel.app',
      'https://your-domain.com'
    ] 
  : [
      'http://localhost:3000', 
      'http://localhost:3001', 
      'http://localhost:3002'
    ];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list or is a Vercel preview deployment
    if (allowedOrigins.includes(origin) || origin.includes('vercel.app')) {
      return callback(null, true);
    }
    
    // Log blocked origins for debugging
    console.log('❌ CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // For legacy browser support (IE11, various SmartTVs)
}));
app.use(express.json({ limit: '10mb' })); // Increase payload limit for base64 videos
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check endpoint for Render and monitoring services
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Basic API status endpoint
app.get('/api/status', (req, res) => {
  res.status(200).json({ 
    status: 'API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Initialize database and ensure startup data
try {
  await initDB();
  await ensureStartupData();
  console.log('✅ Server initialization completed');
} catch (error) {
  console.error('❌ Server initialization failed:', error);
  // Continue anyway - might be connection issue that resolves
}

// Routes
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/third-party', thirdPartyOrderRoutes);
app.use('/api/printer-settings', printerSettingsRoutes);

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from React build
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  // Handle React routing - send all non-API requests to React
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Socket.IO for real-time orders
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join-restaurant', (restaurantId) => {
    socket.join(`restaurant-${restaurantId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
