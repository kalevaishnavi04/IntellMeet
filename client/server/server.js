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
    // room — the actual video/audio stream travels peer-to-peer (mesh:
    // every participant connects directly to every other participant).
    // This works well for small/medium calls (roughly up to 6-8 people);
    // beyond that an SFU like mediasoup/LiveKit would be needed since
    // mesh bandwidth grows with the number of participants.
    const io = new Server(server, {
      cors: { origin: "*" },
    });

    // roomId -> {
    //   hostSocketId: string,
    //   waitingRoomEnabled: boolean,
    //   participants: Map(socketId -> { userName }),
    //   pending: Map(socketId -> { userName }),
    // }
    const rooms = new Map();

    const getOrCreateRoom = (roomId) => {
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          hostSocketId: null,
          waitingRoomEnabled: false,
          participants: new Map(),
          pending: new Map(),
        });
      }
      return rooms.get(roomId);
    };

    const admitToRoom = (socket, roomId, userName) => {
      const room = getOrCreateRoom(roomId);
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userName = userName;

      // Tell the newcomer who is already in the room so they can
      // initiate a WebRTC offer to each existing participant (mesh).
      const existingParticipants = Array.from(room.participants.entries()).map(
        ([socketId, info]) => ({ socketId, userName: info.userName })
      );
      socket.emit("existing-participants", existingParticipants);

      room.participants.set(socket.id, { userName });

      socket.to(roomId).emit("user-joined", {
        socketId: socket.id,
        userName,
      });
    };

    io.on("connection", (socket) => {
      socket.on("join-room", ({ roomId, userName, isHost }) => {
        const room = getOrCreateRoom(roomId);

        if (isHost) {
          room.hostSocketId = socket.id;
          admitToRoom(socket, roomId, userName);
          return;
        }

        if (room.waitingRoomEnabled && room.hostSocketId) {
          room.pending.set(socket.id, { userName });
          socket.data.roomId = roomId;
          socket.emit("waiting-for-host");
          io.to(room.hostSocketId).emit("join-request", {
            socketId: socket.id,
            userName,
          });
          return;
        }

        admitToRoom(socket, roomId, userName);
      });

      // Host approves a pending participant
      socket.on("admit-user", ({ roomId, socketId }) => {
        const room = rooms.get(roomId);
        if (!room || room.hostSocketId !== socket.id) return;
        const pendingUser = room.pending.get(socketId);
        if (!pendingUser) return;
        room.pending.delete(socketId);

        const targetSocket = io.sockets.sockets.get(socketId);
        if (!targetSocket) return;
        targetSocket.emit("admitted");
        admitToRoom(targetSocket, roomId, pendingUser.userName);
      });

      // Host denies a pending participant
      socket.on("deny-user", ({ roomId, socketId }) => {
        const room = rooms.get(roomId);
        if (!room || room.hostSocketId !== socket.id) return;
        room.pending.delete(socketId);
        io.to(socketId).emit("denied");
      });

      // Host toggles the waiting room on/off mid-meeting
      socket.on("toggle-waiting-room", ({ roomId, enabled }) => {
        const room = rooms.get(roomId);
        if (!room || room.hostSocketId !== socket.id) return;
        room.waitingRoomEnabled = enabled;
        io.to(roomId).emit("waiting-room-toggled", { enabled });
      });

      // WebRTC signaling relay (works the same for mesh — just relayed
      // to a specific peer each time instead of a single fixed peer)
      socket.on("offer", ({ offer, to }) => {
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

      // Reactions (floating emoji) and raise-hand
      socket.on("reaction", ({ roomId, emoji, userName }) => {
        io.to(roomId).emit("reaction", { emoji, userName, socketId: socket.id });
      });

      socket.on("raise-hand", ({ roomId, userName, raised }) => {
        io.to(roomId).emit("hand-raised", {
          socketId: socket.id,
          userName,
          raised,
        });
      });

      // Screen-share presence (so the UI can label who is presenting)
      socket.on("screen-share-status", ({ roomId, userName, sharing }) => {
        socket.to(roomId).emit("screen-share-status", {
          socketId: socket.id,
          userName,
          sharing,
        });
      });

      // Host controls: force-mute / remove a participant
      socket.on("mute-participant", ({ roomId, socketId }) => {
        const room = rooms.get(roomId);
        if (!room || room.hostSocketId !== socket.id) return;
        io.to(socketId).emit("force-mute");
      });

      socket.on("mute-all", ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room || room.hostSocketId !== socket.id) return;
        room.participants.forEach((_info, socketId) => {
          if (socketId !== room.hostSocketId) {
            io.to(socketId).emit("force-mute");
          }
        });
      });

      socket.on("remove-participant", ({ roomId, socketId }) => {
        const room = rooms.get(roomId);
        if (!room || room.hostSocketId !== socket.id) return;
        io.to(socketId).emit("removed");
        const targetSocket = io.sockets.sockets.get(socketId);
        if (targetSocket) {
          targetSocket.leave(roomId);
        }
        room.participants.delete(socketId);
        io.to(roomId).emit("user-left", { socketId });
      });

      socket.on("disconnect", () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room) return;

        room.pending.delete(socket.id);
        if (room.participants.delete(socket.id)) {
          socket.to(roomId).emit("user-left", { socketId: socket.id });
        }
        if (room.hostSocketId === socket.id) {
          room.hostSocketId = null;
        }
        if (room.participants.size === 0 && room.pending.size === 0) {
          rooms.delete(roomId);
        }
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