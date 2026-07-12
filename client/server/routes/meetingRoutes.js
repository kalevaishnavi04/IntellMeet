const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  createMeeting,
  getMyMeetings,
  getMeetingByCode,
  joinMeeting,
  toggleWaitingRoom,
  endMeeting,
} = require("../controllers/meetingController");

// Create Meeting
router.post("/create", protect, createMeeting);

// Get My Meetings (hosted + invited)
router.get("/my-meetings", protect, getMyMeetings);

// Join a meeting by its meetingId (any authenticated user)
router.post("/:meetingId/join", protect, joinMeeting);

// Host-only controls
router.patch("/:meetingId/waiting-room", protect, toggleWaitingRoom);
router.patch("/:meetingId/end", protect, endMeeting);

// Look up a meeting by its meetingId (must stay after the routes above
// so literal paths like "my-meetings" aren't swallowed by this param route)
router.get("/:meetingId", protect, getMeetingByCode);

module.exports = router;