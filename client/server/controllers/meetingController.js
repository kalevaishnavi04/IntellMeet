const Meeting = require("../models/Meeting");
const { randomUUID } = require("crypto");

// ======================
// Create Meeting
// ======================
const createMeeting = async (req, res) => {
  try {
    const { title, scheduledAt } = req.body;

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
      scheduledAt: scheduledAt || null,
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
// Get My Meetings (as host OR as invited participant)
// ======================
const getMyMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [{ host: req.user._id }, { participants: req.user._id }],
    }).sort({ createdAt: -1 });

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

// ======================
// Get Meeting by meetingId (join code) — used to validate a meeting
// exists before a user enters the call, and to tell the client
// whether the current user is the host.
// ======================
const getMeetingByCode = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      meetingId: req.params.meetingId,
    }).populate("host", "name email");

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found. Check the meeting ID/link.",
      });
    }

    res.status(200).json({
      success: true,
      meeting,
      isHost: meeting.host._id.toString() === req.user._id.toString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================
// Join Meeting by meetingId — any authenticated user can join with
// just the meeting ID/link, not only the host. Adds them as a
// participant on first join.
// ======================
const joinMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found. Check the meeting ID/link.",
      });
    }

    if (meeting.status === "ended") {
      return res.status(400).json({
        success: false,
        message: "This meeting has already ended.",
      });
    }

    const alreadyIn = meeting.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!alreadyIn) {
      meeting.participants.push(req.user._id);
    }
    meeting.status = "active";
    await meeting.save();

    res.status(200).json({
      success: true,
      meeting,
      isHost: meeting.host.toString() === req.user._id.toString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================
// Toggle Waiting Room (host only)
// ======================
const toggleWaitingRoom = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });

    if (!meeting) {
      return res.status(404).json({ success: false, message: "Meeting not found" });
    }
    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Only the host can change this" });
    }

    meeting.waitingRoomEnabled = !meeting.waitingRoomEnabled;
    await meeting.save();

    res.status(200).json({ success: true, waitingRoomEnabled: meeting.waitingRoomEnabled });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================
// End Meeting (host only)
// ======================
const endMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) {
      return res.status(404).json({ success: false, message: "Meeting not found" });
    }
    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Only the host can end this meeting" });
    }
    meeting.status = "ended";
    await meeting.save();
    res.status(200).json({ success: true, message: "Meeting ended" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createMeeting,
  getMyMeetings,
  getMeetingByCode,
  joinMeeting,
  toggleWaitingRoom,
  endMeeting,
};