const express = require('express');
const rateLimit = require("express-rate-limit");
const cors = require('cors');
require('dotenv').config();

const chatRoutes = require('./src/routes/chat');
const sessionRoutes = require('./src/routes/session');
const redisService = require('./src/services/redisService');
const authRoutes = require('./src/routes/auth');

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
};

app.use(cors(corsOptions));

const globalLimiter = rateLimit({
  windowMs: 1000,
  max: 100, 
  standardHeaders: true, 
  legacyHeaders: false,  
  message: { error: "Too many requests, please try again later." },
});

app.use("/api/", globalLimiter);


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log("Incoming request:", req.method, req.url);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/session', sessionRoutes);


app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await redisService.disconnect();
  process.exit(0);
});