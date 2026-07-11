const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const { createTeam, getMyTeams, addMember } = require("../controllers/teamController");

router.post("/create", protect, createTeam);
router.get("/my-teams", protect, getMyTeams);
router.post("/add-member", protect, addMember);

module.exports = router;
