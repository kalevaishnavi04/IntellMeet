const Team = require("../models/Team");
const User = require("../models/User");

// ======================
// Create Team
// ======================
const createTeam = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Team name is required",
      });
    }

    const team = await Team.create({
      name,
      createdBy: req.user._id,
      members: [req.user._id],
    });

    res.status(201).json({
      success: true,
      message: "Team created successfully",
      team,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================
// Get My Teams
// ======================
const getMyTeams = async (req, res) => {
  try {
    const teams = await Team.find({
      members: req.user._id,
    }).populate("members", "name email");

    res.status(200).json({
      success: true,
      teams,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================
// Add Member to Team (by email)
// ======================
const addMember = async (req, res) => {
  try {
    const { teamId, email } = req.body;

    if (!teamId || !email) {
      return res.status(400).json({
        success: false,
        message: "Team ID and member email are required",
      });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    const memberUser = await User.findOne({ email });
    if (!memberUser) {
      return res.status(404).json({
        success: false,
        message: "No user found with that email",
      });
    }

    if (team.members.includes(memberUser._id)) {
      return res.status(400).json({
        success: false,
        message: "User is already a member of this team",
      });
    }

    team.members.push(memberUser._id);
    await team.save();

    const updatedTeam = await Team.findById(teamId).populate(
      "members",
      "name email"
    );

    res.status(200).json({
      success: true,
      message: "Member added successfully",
      team: updatedTeam,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createTeam,
  getMyTeams,
  addMember,
};
