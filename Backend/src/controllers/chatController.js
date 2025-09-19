const { v4: uuidv4 } = require("uuid");
const chatCrud = require("../crud/chatCrud");
const vectorService = require("../services/vectorService");
const geminiService = require("../services/geminiService");

async function handleMessage(req, res) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; 

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    let { sessionId, message } = req.body;
   
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["sessionId (optional)", "message"],
      });
    }

    // normalize message
    message = message.trim();

    // Create session if not provided
    if (!sessionId) {
      sessionId = uuidv4();
      await chatCrud.ensureSession(token, sessionId);
    } else {
      await chatCrud.ensureSession(token, sessionId);
    }

    // Save user message
    await chatCrud.addMessage(sessionId, {
      type: "user",
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Try cached response
    const cachedResponse = await chatCrud.getCachedResponse(message);
    if (cachedResponse) {
      // Save bot response in user session
      const botMessage = await chatCrud.addMessage(sessionId, {
        type: "bot",
        content: cachedResponse.text,
        sources: cachedResponse.sources,
        timestamp: new Date().toISOString(),
        cached: true,
      });

      return res.json({ success: true, response: botMessage, cached: true });
    }

    // Vector search
    const relevantDocs = await vectorService.searchRelevantDocuments(message, 5);

    if (!relevantDocs || relevantDocs.length === 0) {
      const noContextResponse =
        "I don't have relevant information about that topic in my current news database.";

      const botMessage = await chatCrud.addMessage(sessionId, {
        type: "bot",
        content: noContextResponse,
        sources: [],
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        response: botMessage,
        relevantDocs: 0,
      });
    }

    // Chat history for context
    const chatHistory = await chatCrud.getHistory(sessionId, 10);

    // LLM response
    const geminiResponse = await geminiService.generateResponse(
      message,
      relevantDocs,
      chatHistory
    );

    // Cache response
    await chatCrud.cacheResponse(message, geminiResponse, 3600);

    // Save bot message
    const botMessage = await chatCrud.addMessage(sessionId, {
      type: "bot",
      content: geminiResponse.text,
      sources: geminiResponse.sources,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      response: botMessage,
      relevantDocs: relevantDocs.length,
      sources: geminiResponse.sources,
    });
  } catch (error) {
    console.error("ChatController handleMessage error:", error);
    res.status(500).json({ error: "Failed to process message" });
  }
}

async function handleStream(req, res) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    let { sessionId, message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing required fields" });
    }
    message = message.trim();

    // SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Create session
    if (!sessionId) {
      sessionId = uuidv4();
    }
    await chatCrud.ensureSession(token, sessionId);

    // Save user message
    await chatCrud.addMessage(sessionId, {
      type: "user",
      content: message,
      timestamp: new Date().toISOString(),
    });

    const cachedResponse = await chatCrud.getCachedResponse(message);
  
    if (cachedResponse) {
      res.write(`data: ${JSON.stringify({
        type: "chunk",
        content: cachedResponse?.text,
        sources: cachedResponse?.sources,
        cached: true,
        done: true
      })}\n\n`);

      res.write(`data: ${JSON.stringify({
        type: "done",
        sources: cachedResponse?.sources || []
      })}\n\n`);

      await chatCrud.addMessage(sessionId, {
        type: "bot",
        content: cachedResponse?.text,
        sources: cachedResponse?.sources,
        timestamp: new Date().toISOString(),
        cached: true,
      });

      return res.end();
    }

    // Tell client we're processing
    res.write(`data: ${JSON.stringify({ type: "status", content: "thinking..." })}\n\n`);

    // Run vector search + history in parallel
    const [relevantDocs, chatHistory] = await Promise.all([
      vectorService.searchRelevantDocuments(message, 5),
      chatCrud.getHistory(sessionId, 10),
    ]);

    if (!relevantDocs || relevantDocs.length === 0) {
      const noContextResponse = "I don't have relevant information about that topic in my database.";
      res.write(`data: ${JSON.stringify({ type: "message", content: noContextResponse, done: true })}\n\n`);

      await chatCrud.addMessage(sessionId, {
        type: "bot",
        content: noContextResponse,
        sources: [],
        timestamp: new Date().toISOString(),
      });

      return res.end();
    }

    // Start streaming Gemini response
    const stream = await geminiService.generateStreamingResponse(message, relevantDocs, chatHistory);

    let fullResponse = "";

    for await (const chunk of stream) {
      try {
        const chunkText = chunk?.text ? chunk.text() : "";

        if (chunkText) {
          fullResponse += chunkText;
          res.write(`data: ${JSON.stringify({ type: "chunk", content: chunkText })}\n\n`);
        }
      } catch (innerErr) {
        console.error("Failed to parse stream chunk:", chunk, innerErr);
        res.write(`data: ${JSON.stringify({ type: "error", content: "Streaming parse error" })}\n\n`);
        break;
      }
    }

    // Send final event with sources
    res.write(`data: ${JSON.stringify({
      type: "done",
      sources: relevantDocs.map(doc => ({
        title: doc.title,
        url: doc.url,
        snippet: doc.content.substring(0, 150) + "...",
      }))
    })}\n\n`);

    // Save bot response
    await chatCrud.addMessage(sessionId, {
      type: "bot",
      content: fullResponse,
      sources: relevantDocs.map(doc => ({
        title: doc.title,
        url: doc.url,
        snippet: doc.content.substring(0, 150) + "...",
      })),
      timestamp: new Date().toISOString(),
    });

    await chatCrud.cacheResponse(message, { text: fullResponse });

    res.end();
  } catch (error) {
    console.error("ChatController handleStream error:", error);
    res.write(`data: ${JSON.stringify({ type: "error", message: "Failed to generate response" })}\n\n`);
    res.end();
  }
}

async function getHistory(req, res) {
  try {
    const { sessionId } = req.params;
    const { limit = 50 } = req.query;

    const history = await chatCrud.getHistory(sessionId, parseInt(limit));
    const session = await chatCrud.getSession(sessionId);

    res.json({
      success: true,
      sessionId,
      history,
      session,
      count: history.length,
    });
  } catch (error) {
    console.error("ChatController getHistory error:", error);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
}

async function clearHistory(req, res) {
  try {
    const { sessionId } = req.params;

    const session = await chatCrud.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    await chatCrud.clearHistory(sessionId);

    if (req.io) {
      req.io.to(sessionId).emit("history_cleared", { sessionId });
    }

    res.json({
      success: true,
      message: "Chat history cleared",
      sessionId,
    });
  } catch (error) {
    console.error("ChatController clearHistory error:", error);
    res.status(500).json({ error: "Failed to clear chat history" });
  }
}

async function getStats(req, res) {
  try {
    const collectionStats = await vectorService.getCollectionStats();
    const allSessions = await chatCrud.getAllSessions();

    const stats = {
      sessions: {
        total: allSessions.length,
        active: allSessions.filter((s) => {
          const lastActivity = new Date(s.lastActivity);
          const hoursSince = (Date.now() - lastActivity) / (1000 * 60 * 60);
          return hoursSince < 24;
        }).length,
        totalMessages: allSessions.reduce(
          (sum, s) => sum + parseInt(s.messageCount || 0, 10),
          0
        ),
      },
      vectorDatabase: {
        stats: collectionStats,  
      },
      uptime: process.uptime(),
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      error: "Failed to fetch statistics",
      message: error.message,
    });
  }
}

module.exports = {
  handleMessage,
  handleStream,
  getHistory,
  clearHistory,
  getStats,
};
