import { useEffect, useRef, useState, useContext, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { AuthContext } from "../context/AuthContext";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://127.0.0.1:5000";

// Public STUN server so two peers on different networks can discover
// each other's connection path. No TURN server is configured, so calls
// across strict corporate/college firewalls may not connect — that
// would need a paid TURN relay in a production deployment.
const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const remoteSocketIdRef = useRef(null);
  const localStreamRef = useRef(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [connected, setConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [error, setError] = useState("");

  const createPeerConnection = useCallback((targetSocketId) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    localStreamRef.current?.getTracks().forEach((track) => {
      peer.addTrack(track, localStreamRef.current);
    });

    peer.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setConnected(true);
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", {
          candidate: event.candidate,
          to: targetSocketId,
        });
      }
    };

    return peer;
  }, []);

  useEffect(() => {
    let active = true;

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (!active) return;
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        setError(
          "Could not access camera/microphone. Please allow permissions and reload."
        );
        return;
      }

      const socket = io(SOCKET_URL);
      socketRef.current = socket;

      socket.emit("join-room", { roomId: meetingId, userName: user?.name });

      socket.on("user-joined", async ({ socketId }) => {
        remoteSocketIdRef.current = socketId;
        const peer = createPeerConnection(socketId);
        peerRef.current = peer;

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("offer", { roomId: meetingId, offer, to: socketId });
      });

      socket.on("offer", async ({ offer, from }) => {
        remoteSocketIdRef.current = from;
        const peer = createPeerConnection(from);
        peerRef.current = peer;

        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("answer", { answer, to: from });
      });

      socket.on("answer", async ({ answer }) => {
        await peerRef.current?.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      });

      socket.on("ice-candidate", async ({ candidate }) => {
        try {
          await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          // Ignored: candidate may arrive before remote description is set
        }
      });

      socket.on("user-left", () => {
        setConnected(false);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      });

      socket.on("chat-message", ({ message, userName }) => {
        setChatMessages((prev) => [...prev, { message, userName }]);
      });
    };

    setup();

    return () => {
      active = false;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerRef.current?.close();
      socketRef.current?.disconnect();
    };
  }, [meetingId, user, createPeerConnection]);

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  };

  const leaveCall = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    peerRef.current?.close();
    socketRef.current?.disconnect();
    navigate("/meetings");
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current.emit("chat-message", {
      roomId: meetingId,
      message: chatInput,
      userName: user?.name || "Guest",
    });
    setChatMessages((prev) => [
      ...prev,
      { message: chatInput, userName: "You" },
    ]);
    setChatInput("");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-4 flex justify-between items-center border-b border-gray-700">
        <h1 className="text-lg font-semibold">Meeting: {meetingId}</h1>
        <span className="text-sm text-gray-400">
          {connected ? "Peer connected" : "Waiting for other participant..."}
        </span>
      </div>

      {error && (
        <div className="bg-red-600 text-white text-sm p-2 text-center">
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-2 left-2 text-xs bg-black/60 px-2 py-1 rounded">
              You {!camOn && "(camera off)"}
            </span>
          </div>

          <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!connected && (
              <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                Waiting for participant to join...
              </span>
            )}
          </div>
        </div>

        {/* In-meeting chat */}
        <div className="w-full md:w-72 bg-gray-800 rounded-xl p-3 flex flex-col">
          <p className="text-sm font-semibold mb-2">Chat</p>
          <div className="flex-1 overflow-y-auto space-y-2 text-sm mb-2 max-h-64">
            {chatMessages.map((c, i) => (
              <p key={i}>
                <span className="text-blue-400">{c.userName}: </span>
                {c.message}
              </p>
            ))}
          </div>
          <form onSubmit={sendChat} className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message"
              className="flex-1 bg-gray-700 rounded px-2 py-1 text-sm"
            />
            <button className="bg-blue-600 px-3 py-1 rounded text-sm">
              Send
            </button>
          </form>
        </div>
      </div>

      <div className="p-4 flex justify-center gap-4 border-t border-gray-700">
        <button
          onClick={toggleMic}
          className={`px-4 py-2 rounded-lg text-sm ${
            micOn ? "bg-gray-700" : "bg-red-600"
          }`}
        >
          {micOn ? "Mute mic" : "Unmute mic"}
        </button>
        <button
          onClick={toggleCam}
          className={`px-4 py-2 rounded-lg text-sm ${
            camOn ? "bg-gray-700" : "bg-red-600"
          }`}
        >
          {camOn ? "Turn camera off" : "Turn camera on"}
        </button>
        <button
          onClick={leaveCall}
          className="px-4 py-2 rounded-lg text-sm bg-red-700"
        >
          Leave meeting
        </button>
      </div>
    </div>
  );
}
