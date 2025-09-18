const express = require("express");
const router = express.Router();
const sessionController = require("../controllers/sessionController");

router.post("/create", sessionController.createSession);
router.get("/list-all", sessionController.getAllSessions);
router.get("/:id", sessionController.getSessionById);
router.delete("/:id", sessionController.deleteSession);

module.exports = router;
