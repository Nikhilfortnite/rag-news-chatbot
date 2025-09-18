const redisService = require('../services/redisService');

async function ensureSession(token, sessionId) {
  let session = await redisService.getSession(sessionId);
  if (!session) session = await redisService.createSession(token, sessionId);
  return session;
}

async function getSession(sessionId) {
  return redisService.getSession(sessionId);
}

async function addMessage(sessionId, messageObj) {
  return redisService.addMessageToHistory(sessionId, messageObj);
}

async function getHistory(sessionId, limit = 50) {
  return redisService.getChatHistory(sessionId, limit);
}

async function clearHistory(sessionId) {
  return redisService.clearChatHistory(sessionId);
}

async function getAllSessions(token) {
  return redisService.getAllSessions(token);
}

async function getCachedResponse(query) {
  return redisService.getCachedRAGResponse(query);
}

async function cacheResponse(query, response, ttl = 3600) {
  return redisService.cacheRAGResponse(query, response, ttl);
}

module.exports = {
  ensureSession,
  getSession,
  addMessage,
  getHistory,
  clearHistory,
  getAllSessions,
  getCachedResponse,
  cacheResponse,
};
