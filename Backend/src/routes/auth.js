const express = require("express");
const router = express.Router();
const redisService = require("../services/redisService");
const { runIngestionPipeline } = require("../scripts/ingest");

router.post("/login", async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || username.length < 5 || username.length > 50) {
      return res
        .status(400)
        .json({ error: "Username must be at least 5 and at most 50 characters." });
    }

    const userData = await redisService.loginUser(username);
    res.json({ token: userData.token });

    // Check if data ingestion has already occurred
    const lastIngested = await redisService.getDataInjestedAT();

    if (!lastIngested) {
      try {
        console.log("Starting initial data ingestion...");
        await runIngestionPipeline();
        await redisService.recordDataInjestion();
        console.log("Data ingestion completed and timestamp recorded.");
      } catch (ingestError) {
        console.error("Data ingestion failed:", ingestError);
      }
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = router;