const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const { createSummary, getMySummaries } = require("../controllers/summaryController");

router.post("/create", protect, createSummary);
router.get("/my-summaries", protect, getMySummaries);

module.exports = router;
