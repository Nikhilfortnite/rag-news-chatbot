const redis = require('redis');
require('dotenv').config();

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.client) return;

    try {
      this.client = redis.createClient({
        username: process.env.REDIS_USER || 'default',
        password: process.env.REDIS_PASSWORD,
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
        },
        ...(process.env.REDIS_URL && { url: process.env.REDIS_URL })
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  async ensureClient() {
    if (!this.client) {
      await this.connect();
    }
  }

  // Session management methods
  async createSession(sessionID) {
    await this.ensureClient();

    const sessionKey = `session:${sessionID}`;
    const sessionData = {
      id: sessionID,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messageCount: 0,
    };

    await this.client.hSet(sessionKey, sessionData);
    await this.client.expire(sessionKey, 24 * 60 * 60);
    return sessionData;
  }

  async getSession(sessionId) {
    await this.ensureClient();

    const sessionKey = `session:${sessionId}`;
    const session = await this.client.hGetAll(sessionKey);

    return Object.keys(session).length === 0 ? null : session;
  }

  async updateSessionActivity(sessionId) {
    await this.ensureClient();

    const sessionKey = `session:${sessionId}`;
    await this.client.hSet(sessionKey, 'lastActivity', new Date().toISOString());
    await this.client.expire(sessionKey, 24 * 60 * 60);
  }

  // Chat history methods
  async addMessageToHistory(sessionId, message) {
    await this.ensureClient();

    const historyKey = `history:${sessionId}`;
    const messageData = {
      ...message,
      id: Date.now().toString(),
      timestamp: message.timestamp || new Date().toISOString(),
    };

    await this.client.lPush(historyKey, JSON.stringify(messageData));
    await this.client.lTrim(historyKey, 0, 99); // keep last 100
    await this.client.expire(historyKey, 24 * 60 * 60);

    const sessionKey = `session:${sessionId}`;
    await this.client.hIncrBy(sessionKey, 'messageCount', 1);
    await this.updateSessionActivity(sessionId);

    return messageData;
  }

  async getChatHistory(sessionId, limit = 50) {
    await this.ensureClient();

    const historyKey = `history:${sessionId}`;
    try {
      const messages = await this.client.lRange(historyKey, 0, limit - 1);
      return messages.map((msg) => JSON.parse(msg)); // oldest → newest
    } catch (error) {
      console.error('Error fetching chat history:', error);
      return [];
    }
  }

  async clearChatHistory(sessionId) {
    await this.ensureClient();

    const historyKey = `history:${sessionId}`;
    const sessionKey = `session:${sessionId}`;

    await this.client.del(historyKey);
    await this.client.hSet(sessionKey, 'messageCount', 0);
    await this.updateSessionActivity(sessionId);

    return true;
  }

  async deleteSession(sessionId) {
    await this.ensureClient();

    const sessionKey = `session:${sessionId}`;
    const historyKey = `history:${sessionId}`;

    await Promise.all([
      this.client.del(sessionKey),
      this.client.del(historyKey),
    ]);

    return true;
  }

  async getAllSessions() {
    await this.ensureClient();

    const keys = await this.client.keys('session:*');
    const sessions = [];

    for (const key of keys) {
      const sessionData = await this.client.hGetAll(key);
      sessions.push(sessionData);
    }

    return sessions;
  }

  // Cache methods for RAG responses
  async cacheRAGResponse(query, response, ttl = 3600) {
    await this.ensureClient();

    const cacheKey = `rag:${Buffer.from(query).toString('base64')}`;
    await this.client.setEx(cacheKey, ttl, JSON.stringify(response));
  }

  async getCachedRAGResponse(query) {
    await this.ensureClient();

    const cacheKey = `rag:${Buffer.from(query).toString('base64')}`;
    const cached = await this.client.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }

  // Health check
  async ping() {
    await this.ensureClient();
    return this.client.ping();
  }
}

module.exports = new RedisService();
