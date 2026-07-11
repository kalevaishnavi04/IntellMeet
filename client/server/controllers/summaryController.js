const Summary = require("../models/Summary");
const Meeting = require("../models/Meeting");

// ======================
// Create Summary/Notes for a Meeting
// ======================
const createSummary = async (req, res) => {
  try {
    const { meetingId, notes, actionItems } = req.body;

    if (!meetingId || !notes) {
      return res.status(400).json({
        success: false,
        message: "Meeting ID and notes are required",
      });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // actionItems can arrive as a comma-separated string from the form,
    // or already as an array
    const parsedItems = Array.isArray(actionItems)
      ? actionItems
      : (actionItems || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

    const summary = await Summary.create({
      meeting: meetingId,
      createdBy: req.user._id,
      notes,
      actionItems: parsedItems,
    });

    res.status(201).json({
      success: true,
      message: "Summary saved successfully",
      summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================
// Get All Summaries for Logged-in User's Meetings
// ======================
const getMySummaries = async (req, res) => {
  try {
    const summaries = await Summary.find({ createdBy: req.user._id })
      .populate("meeting", "title meetingId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      summaries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createSummary,
  getMySummaries,
};
