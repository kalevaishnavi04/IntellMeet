const Meeting = require("../models/Meeting");
const { randomUUID } = require("crypto");

// ======================
// Create Meeting
// ======================
const createMeeting = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Meeting title is required",
      });
    }

    const meeting = await Meeting.create({
      meetingId: randomUUID(),
      title,
      host: req.user._id,
      participants: [req.user._id],
      status: "scheduled",
    });

    res.status(201).json({
      success: true,
      message: "Meeting created successfully",
      meeting,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================
// Get My Meetings
// ======================
const getMyMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({
      host: req.user._id,
    });

    res.status(200).json({
      success: true,
      meetings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createMeeting,
  getMyMeetings,
};