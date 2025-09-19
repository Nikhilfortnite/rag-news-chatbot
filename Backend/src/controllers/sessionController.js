const { v4: uuidv4 } = require("uuid");
const redisService = require("../services/redisService");

async function createSession(req, res) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; 

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const sessions = await redisService.getAllSessions(token);

    if (sessions.length >= 10) {
      return res.status(403).json({ 
        error: "Session limit reached. You can create up to 10 sessions per user." 
      });
    }

    const sessionId = uuidv4();
    const newSession = await redisService.createSession(token, sessionId);
    res.status(201).json(newSession);
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
}

async function getAllSessions(req, res) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; 

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const sessions = await redisService.getAllSessions(token);
    res.json(sessions);
  } catch (error) {
    console.error("Error fetching sessions:", error);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
}

async function getSessionById(req, res) {
  try {
    const { id } = req.params;
    const session = await redisService.getSession(id);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(session);
  } catch (error) {
    console.error("Error fetching session:", error);
    res.status(500).json({ error: "Failed to fetch session" });
  }
}

async function deleteSession(req, res) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; 

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const { id } = req.params;
    const deleted = await redisService.deleteSession(token, id);

    if (!deleted) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({ message: "Session deleted successfully" });
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({ error: "Failed to delete session" });
  }
}

module.exports = {
  createSession,
  getAllSessions,
  getSessionById,
  deleteSession,
};
