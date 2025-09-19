const express = require('express');
const rateLimit = require("express-rate-limit");
const cors = require('cors');
require('dotenv').config();

const chatRoutes = require('./src/routes/chat');
const sessionRoutes = require('./src/routes/session');
const redisService = require('./src/services/redisService');
const authRoutes = require('./src/routes/auth');

const app = express();

// Trust proxy for Render deployment
app.set('trust proxy', 1);

// CORS configuration
const corsOptions = {
  origin: [process.env.FRONTEND_URL,],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Rate limiter configuration
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, 
  standardHeaders: true, 
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: (req) => {
    return req.path === '/health';
  }
});

// Only apply rate limiting in production
if (process.env.NODE_ENV === 'production') {
  app.use("/api/", globalLimiter);
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/session', sessionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'RAG News Chatbot API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth/*',
      chat: '/api/chat/*',
      session: '/api/session/*'
    },
    status: 'running'
  });
});

// Use middleware-based 404 handler instead of route
app.use((req, res, next) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    message: 'The requested endpoint does not exist'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await redisService.connect();
    console.log('Redis connected successfully');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`CORS origins:`, corsOptions.origin);
      if (process.env.NODE_ENV === 'production') {
        console.log('Rate limiting enabled');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server gracefully...');
  try {
    await redisService.disconnect();
    console.log('Redis disconnected');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  try {
    await redisService.disconnect();
    console.log('Redis disconnected');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  process.exit(0);
});