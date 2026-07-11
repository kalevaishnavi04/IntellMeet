console.log("STEP 1");

require("dotenv").config();

console.log("STEP 2");

const express = require("express");

console.log("STEP 3");

const cors = require("cors");

console.log("STEP 4");

const connectDB = require("./config/db");

console.log("STEP 5");

const authRoutes = require("./routes/authRoutes");

console.log("STEP 6");

const meetingRoutes = require("./routes/meetingRoutes");
const teamRoutes = require("./routes/teamRoutes");
const summaryRoutes = require("./routes/summaryRoutes");

console.log("STEP 7");

const app = express();

console.log("STEP 8");

// Middleware
app.use(cors());
app.use(express.json());

console.log("STEP 9");

// Root Route
app.get("/", (req, res) => {
  res.send("🚀 IntellMeet Backend Running");
});

// Health Route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is healthy 🚀",
  });
});

console.log("STEP 10");

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/summaries", summaryRoutes);

console.log("STEP 11");

// Connect Database and Start Server
const PORT = process.env.PORT || 5000;

const http = require("http");
const { Server } = require("socket.io");

connectDB()
  .then(() => {
    console.log("STEP 12");
    console.log("🟢 MongoDB Connected");

    const server = http.createServer(app);

    // Socket.io signaling server for WebRTC video/audio calls.
    // We only relay messages between participants in the same meeting
    // room — the actual video/audio stream travels peer-to-peer.
    const io = new Server(server, {
      cors: { origin: "*" },
    });

    io.on("connection", (socket) => {
      socket.on("join-room", ({ roomId, userName }) => {
        socket.join(roomId);
        socket.to(roomId).emit("user-joined", {
          socketId: socket.id,
          userName,
        });

        socket.on("disconnect", () => {
          socket.to(roomId).emit("user-left", { socketId: socket.id });
        });
      });

      // WebRTC signaling relay
      socket.on("offer", ({ roomId, offer, to }) => {
        io.to(to).emit("offer", { offer, from: socket.id });
      });

      socket.on("answer", ({ answer, to }) => {
        io.to(to).emit("answer", { answer, from: socket.id });
      });

      socket.on("ice-candidate", ({ candidate, to }) => {
        io.to(to).emit("ice-candidate", { candidate, from: socket.id });
      });

      // In-meeting chat
      socket.on("chat-message", ({ roomId, message, userName }) => {
        io.to(roomId).emit("chat-message", { message, userName });
      });
    });

    server.listen(PORT, "127.0.0.1", () => {
      console.log("STEP 13");
      console.log(`🚀 Server running at http://127.0.0.1:${PORT}`);
    });

    server.on("error", (err) => {
      console.error("❌ Server Error:", err);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
  });