const express = require("express");
const router = express.Router();
const redisService = require("../services/redisService");

router.post("/login", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters." });
    }

    const userData = await redisService.loginUser(username);
    res.json({ token: userData.token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = router;