const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.post('/message', chatController.handleMessage);
router.post('/stream', chatController.handleStream);
router.get('/history/:sessionId', chatController.getHistory);
router.delete('/clear/:sessionId', chatController.clearHistory);
router.get('/stats', chatController.getStats);

module.exports = router;
