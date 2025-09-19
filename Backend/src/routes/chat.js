const express = require('express');
const rateLimit = require("express-rate-limit");
const router = express.Router();
const chatController = require('../controllers/chatController');


const streamLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, 
  message: {
    error: "Too many streaming requests, slow down.",
  },
});


router.post('/message', streamLimiter, chatController.handleMessage);
router.post('/stream', streamLimiter, chatController.handleStream);
router.get('/history/:sessionId', chatController.getHistory);
router.delete('/clear/:sessionId', chatController.clearHistory);
router.get('/stats', chatController.getStats);

module.exports = router;
