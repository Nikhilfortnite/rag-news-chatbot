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

  async recordDataInjestion() {
    const dataInjestionKey = process.env.DATA_INJUST_KEY;
    const data = {
      LastInjestedAt: new Date().toISOString(),
    };

    await this.client.hSet(dataInjestionKey, data);
    await this.client.expire(dataInjestionKey, 24 * 60 * 60);
  }

  async getDataInjestedAT() {
    await this.ensureClient();

    const dataInjestionKey = process.env.DATA_INJUST_KEY;
    const result = await this.client.hGetAll(dataInjestionKey);
    return Object.keys(result).length === 0 ? null : result;
  }

  async loginUser(username) {
    await this.ensureClient();

    if (!username || typeof username !== "string") {
      throw new Error("Invalid username");
    }

    // Base64 encode the username to simple "token"
    const token = Buffer.from(username).toString("base64");

    const userKey = `user:${token}`;
    const userData = { username };

    await this.client.hSet(userKey, userData);
    await this.client.expire(userKey, 24 * 60 * 60);

    return {token: token};
  }

  // Session management methods
  async createSession(token, sessionId) {
    await this.ensureClient();

    const userSessionsKey = `user_sessions:${token}`;
    const sessionKey = `session:${sessionId}`;

    const sessionCount = await this.client.lLen(userSessionsKey);
    const sessionName = `Session ${sessionCount + 1}`;

    const sessionData = {
      id: sessionId,
      name: sessionName,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messageCount: 0,
    };

    await this.client.rPush(userSessionsKey, JSON.stringify(sessionData));
    await this.client.expire(userSessionsKey, 24 * 60 * 60);

    // Also as standAlone for querying
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
      return messages.map((msg) => JSON.parse(msg)).reverse(); // oldest → newest
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

  async deleteSession(token, sessionId) {
    await this.ensureClient();

    const sessionKey = `session:${sessionId}`;
    const historyKey = `history:${sessionId}`;
    const userSessionsKey = `user_sessions:${token}`;

    // Remove from the user's session list
    const sessionsRaw = await this.client.lRange(userSessionsKey, 0, -1);

    for (const sessionStr of sessionsRaw) {
      const session = JSON.parse(sessionStr);
      if (session.id === sessionId) {
        await this.client.lRem(userSessionsKey, 0, sessionStr);
        break;
      }
    }

    await Promise.all([
      this.client.del(sessionKey),
      this.client.del(historyKey),
    ]);

    return true;
  }

  async getAllSessions(token) {
    await this.ensureClient();

    if (token) {
      const userSessionsKey = `user_sessions:${token}`;
      const sessionsRaw = await this.client.lRange(userSessionsKey, 0, -1);
      return sessionsRaw.map((s) => JSON.parse(s));
    }

    // No token, fetch all sessions from all users
    const keys = await this.client.keys("user_sessions:*");
    const allSessions = [];

    for (const key of keys) {
      const sessionsRaw = await this.client.lRange(key, 0, -1);
      const sessions = sessionsRaw.map((s) => JSON.parse(s));
      allSessions.push(...sessions);
    }

    return allSessions;
  }

  // Cache methods for RAG responses
  async cacheRAGResponse(query, response, ttl = 3600) {
    await this.ensureClient();
    console.log("caching gemini response")
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
