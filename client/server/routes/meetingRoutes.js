const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  createMeeting,
  getMyMeetings,
} = require("../controllers/meetingController");

// Create Meeting
router.post("/create", protect, createMeeting);

// Get My Meetings
router.get("/my-meetings", protect, getMyMeetings);

module.exports = router;