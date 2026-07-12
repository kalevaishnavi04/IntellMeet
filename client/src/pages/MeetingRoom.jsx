import { useEffect, useRef, useState, useContext, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { AuthContext } from "../context/AuthContext";
import API from "../api/axios";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://127.0.0.1:5000";

// Public STUN server so two peers on different networks can discover
// each other's connection path. No TURN server is configured, so calls
// across strict corporate/college firewalls may not connect — that
// would need a paid TURN relay in a production deployment.
const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const REACTION_EMOJIS = ["👍", "❤️", "😂", "👏", "🎉", "✋"];

export default function MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // stage: "loading" | "waiting" | "denied" | "error" | "in-call"
  const [stage, setStage] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");

  const localVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const isHostRef = useRef(false);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [presenterSocketId, setPresenterSocketId] = useState(null);

  const [participantNames, setParticipantNames] = useState({}); // socketId -> name
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> MediaStream

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(true);

  const [raisedHands, setRaisedHands] = useState({}); // socketId -> userName
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [reactions, setReactions] = useState([]); // [{id, emoji, userName}]

  const [pendingRequests, setPendingRequests] = useState([]); // [{socketId, userName}]
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((text) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const createPeerConnection = useCallback((targetSocketId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [targetSocketId]: event.streams[0],
      }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("ice-candidate", {
          candidate: event.candidate,
          to: targetSocketId,
        });
      }
    };

    peersRef.current.set(targetSocketId, pc);
    return pc;
  }, []);

  const cleanupPeer = useCallback((socketId) => {
    const pc = peersRef.current.get(socketId);
    pc?.close();
    peersRef.current.delete(socketId);
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
    setParticipantNames((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
    setRaisedHands((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  }, []);

  const fullCleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    socketRef.current?.disconnect();
  }, []);

  // ---- main setup: fetch meeting info, get media, connect socket ----
  useEffect(() => {
    let active = true;

    const setup = async () => {
      // 1. Look up the meeting so we know if the current user is the
      //    host, and register them as a participant (covers direct
      //    links pasted straight into the browser, not just the
      //    "Join Meeting" button).
      let hostFlag = false;
      try {
        const infoRes = await API.get(`/meetings/${meetingId}`);
        if (!active) return;
        hostFlag = !!infoRes.data.isHost;
        isHostRef.current = hostFlag;
        setIsHost(hostFlag);
        setMeetingTitle(infoRes.data.meeting?.title || "");
        setWaitingRoomEnabled(!!infoRes.data.meeting?.waitingRoomEnabled);
        await API.post(`/meetings/${meetingId}/join`);
      } catch (err) {
        if (!active) return;
        setErrorMsg(
          err.response?.data?.message ||
            "This meeting doesn't exist or you don't have access."
        );
        setStage("error");
        return;
      }

      // 2. Get camera/mic (needed even in the waiting room, for the
      //    self-preview while the host reviews the join request)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (!active) return;
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        if (!active) return;
        setErrorMsg(
          "Could not access camera/microphone. Please allow permissions and reload."
        );
        setStage("error");
        return;
      }

      // 3. Connect signaling socket
      const socket = io(SOCKET_URL);
      socketRef.current = socket;

      socket.emit("join-room", {
        roomId: meetingId,
        userName: user?.name || "Guest",
        isHost: hostFlag,
      });

      socket.on("waiting-for-host", () => {
        if (active) setStage("waiting");
      });

      socket.on("admitted", () => {
        if (active) setStage("in-call");
      });

      socket.on("denied", () => {
        if (!active) return;
        setStage("denied");
        fullCleanup();
      });

      // Host receives join requests from the waiting room
      socket.on("join-request", ({ socketId, userName }) => {
        setPendingRequests((prev) => [...prev, { socketId, userName }]);
        pushToast(`${userName} is waiting to join`);
      });

      socket.on("waiting-room-toggled", ({ enabled }) => {
        setWaitingRoomEnabled(enabled);
      });

      // Newcomer learns who is already in the room, and initiates a
      // WebRTC offer to each of them (mesh: one connection per pair)
      socket.on("existing-participants", (list) => {
        if (!active) return;
        setStage("in-call");
        list.forEach(async ({ socketId, userName }) => {
          setParticipantNames((prev) => ({ ...prev, [socketId]: userName }));
          const pc = createPeerConnection(socketId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", { offer, to: socketId });
        });
      });

      socket.on("user-joined", ({ socketId, userName }) => {
        if (!active) return;
        setParticipantNames((prev) => ({ ...prev, [socketId]: userName }));
        pushToast(`${userName} joined the meeting`);
      });

      socket.on("offer", async ({ offer, from }) => {
        const pc = peersRef.current.get(from) || createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { answer, to: from });
      });

      socket.on("answer", async ({ answer, from }) => {
        const pc = peersRef.current.get(from);
        await pc?.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on("ice-candidate", async ({ candidate, from }) => {
        try {
          await peersRef.current.get(from)?.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } catch (err) {
          // Ignored: candidate may arrive before remote description is set
        }
      });

      socket.on("user-left", ({ socketId }) => {
        const name = participantNamesRef.current[socketId];
        cleanupPeer(socketId);
        if (name) pushToast(`${name} left the meeting`);
      });

      socket.on("chat-message", ({ message, userName }) => {
        setChatMessages((prev) => [...prev, { message, userName }]);
      });

      socket.on("reaction", ({ emoji, userName }) => {
        const id = Date.now() + Math.random();
        setReactions((prev) => [...prev, { id, emoji, userName }]);
        setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.id !== id));
        }, 3000);
      });

      socket.on("hand-raised", ({ socketId, userName, raised }) => {
        setRaisedHands((prev) => {
          const next = { ...prev };
          if (raised) next[socketId] = userName;
          else delete next[socketId];
          return next;
        });
        if (raised) pushToast(`${userName} raised their hand ✋`);
      });

      socket.on("screen-share-status", ({ socketId, sharing }) => {
        setPresenterSocketId(sharing ? socketId : null);
      });

      socket.on("force-mute", () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) track.enabled = false;
        setMicOn(false);
        pushToast("The host muted your microphone");
      });

      socket.on("removed", () => {
        pushToast("You were removed from the meeting by the host");
        fullCleanup();
        setTimeout(() => navigate("/meetings"), 1200);
      });
    };

    setup();

    return () => {
      active = false;
      fullCleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  // Keep a ref mirror of participantNames so the "user-left" toast
  // (fired from inside a socket callback closure) can read the latest
  // name without needing to be redeclared on every render.
  const participantNamesRef = useRef({});
  useEffect(() => {
    participantNamesRef.current = participantNames;
  }, [participantNames]);

  // ---------------- controls ----------------

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

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      peersRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        sender?.replaceTrack(screenTrack);
      });

      screenTrack.onended = () => stopScreenShare();
      setIsScreenSharing(true);
      socketRef.current?.emit("screen-share-status", {
        roomId: meetingId,
        userName: user?.name,
        sharing: true,
      });
    } catch (err) {
      // user cancelled the share picker — nothing to do
    }
  };

  const stopScreenShare = () => {
    const camTrack = localStreamRef.current?.getVideoTracks()[0];
    peersRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender && camTrack) sender.replaceTrack(camTrack);
    });
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setIsScreenSharing(false);
    socketRef.current?.emit("screen-share-status", {
      roomId: meetingId,
      userName: user?.name,
      sharing: false,
    });
  };

  const toggleHand = () => {
    const next = !myHandRaised;
    setMyHandRaised(next);
    socketRef.current?.emit("raise-hand", {
      roomId: meetingId,
      userName: user?.name || "Guest",
      raised: next,
    });
  };

  const sendReaction = (emoji) => {
    socketRef.current?.emit("reaction", {
      roomId: meetingId,
      emoji,
      userName: user?.name || "Guest",
    });
    const id = Date.now() + Math.random();
    setReactions((prev) => [...prev, { id, emoji, userName: "You" }]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 3000);
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current?.emit("chat-message", {
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

  const leaveCall = () => {
    fullCleanup();
    navigate("/meetings");
  };

  // ---- host-only controls ----

  const admitUser = (socketId) => {
    socketRef.current?.emit("admit-user", { roomId: meetingId, socketId });
    setPendingRequests((prev) => prev.filter((p) => p.socketId !== socketId));
  };

  const denyUser = (socketId) => {
    socketRef.current?.emit("deny-user", { roomId: meetingId, socketId });
    setPendingRequests((prev) => prev.filter((p) => p.socketId !== socketId));
  };

  const toggleWaitingRoom = async () => {
    const next = !waitingRoomEnabled;
    try {
      await API.patch(`/meetings/${meetingId}/waiting-room`);
      setWaitingRoomEnabled(next);
      socketRef.current?.emit("toggle-waiting-room", {
        roomId: meetingId,
        enabled: next,
      });
    } catch (err) {
      pushToast("Could not update waiting room setting");
    }
  };

  const muteParticipant = (socketId) => {
    socketRef.current?.emit("mute-participant", { roomId: meetingId, socketId });
  };

  const muteAll = () => {
    socketRef.current?.emit("mute-all", { roomId: meetingId });
  };

  const removeParticipant = (socketId) => {
    socketRef.current?.emit("remove-participant", {
      roomId: meetingId,
      socketId,
    });
  };

  // ---- local device recording (captures this device's screen/tab,
  // including whatever the browser is rendering — a real, working way
  // to save a copy of the call without needing a server-side pipeline) ----

  const startRecording = async () => {
    try {
      const captureStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported(
        "video/webm;codecs=vp9,opus"
      )
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const recorder = new MediaRecorder(captureStream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm",
        });
        setRecordingUrl(URL.createObjectURL(blob));
        captureStream.getTracks().forEach((t) => t.stop());
      };

      captureStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      pushToast("Recording started — choose the tab/screen to capture");
    } catch (err) {
      // user cancelled the picker
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // ---------------- render ----------------

  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">Connecting to meeting...</p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{errorMsg}</p>
        <button
          onClick={() => navigate("/meetings")}
          className="bg-gray-700 px-4 py-2 rounded-lg text-sm"
        >
          Back to Meetings
        </button>
      </div>
    );
  }

  if (stage === "denied") {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">The host did not admit you to this meeting.</p>
        <button
          onClick={() => navigate("/meetings")}
          className="bg-gray-700 px-4 py-2 rounded-lg text-sm"
        >
          Back to Meetings
        </button>
      </div>
    );
  }

  if (stage === "waiting") {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-4 p-4">
        <div className="relative bg-black rounded-xl overflow-hidden w-full max-w-md aspect-video">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
        <p className="text-gray-300 text-lg">Waiting for the host to let you in...</p>
        <p className="text-gray-500 text-sm">Meeting: {meetingTitle || meetingId}</p>
      </div>
    );
  }

  const remoteEntries = Object.entries(remoteStreams);
  const tileCount = remoteEntries.length + 1;
  const gridCols =
    tileCount <= 1
      ? "grid-cols-1"
      : tileCount === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : tileCount <= 4
      ? "grid-cols-2"
      : "grid-cols-2 md:grid-cols-3";

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-gray-800 border border-gray-700 text-sm px-3 py-2 rounded-lg shadow-lg"
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* floating reactions */}
      <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-1 pointer-events-none">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="text-2xl bg-gray-800/70 px-2 py-1 rounded-full"
          >
            {r.emoji} <span className="text-xs text-gray-300">{r.userName}</span>
          </div>
        ))}
      </div>

      <div className="p-4 flex flex-wrap justify-between items-center gap-2 border-b border-gray-700">
        <div>
          <h1 className="text-lg font-semibold">
            {meetingTitle || `Meeting: ${meetingId}`}
          </h1>
          <p className="text-xs text-gray-500 break-all">ID: {meetingId}</p>
        </div>
        <span className="text-sm text-gray-400">
          {tileCount} participant{tileCount !== 1 ? "s" : ""}
          {presenterSocketId && " · someone is presenting"}
        </span>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4">
        <div className="flex-1 flex flex-col gap-3">
          <div className={`grid ${gridCols} gap-4`}>
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-2 left-2 text-xs bg-black/60 px-2 py-1 rounded">
                You {!camOn && "(camera off)"} {isScreenSharing && "· Presenting"}
              </span>
              {myHandRaised && (
                <span className="absolute top-2 right-2 text-lg">✋</span>
              )}
            </div>

            {remoteEntries.map(([socketId, stream]) => (
              <RemoteTile
                key={socketId}
                stream={stream}
                name={participantNames[socketId] || "Participant"}
                handRaised={!!raisedHands[socketId]}
                isPresenter={presenterSocketId === socketId}
                isHost={isHost}
                onMute={() => muteParticipant(socketId)}
                onRemove={() => removeParticipant(socketId)}
              />
            ))}
          </div>

          {/* reaction bar */}
          <div className="flex gap-2 justify-center bg-gray-800 rounded-xl p-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="text-xl hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* side panel: chat + participants/host controls */}
        {chatOpen && (
          <div className="w-full lg:w-80 bg-gray-800 rounded-xl p-3 flex flex-col gap-4">
            {isHost && (
              <div className="border-b border-gray-700 pb-3">
                <p className="text-sm font-semibold mb-2">Host controls</p>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={waitingRoomEnabled}
                      onChange={toggleWaitingRoom}
                    />
                    Waiting room
                  </label>
                  <button
                    onClick={muteAll}
                    className="bg-gray-700 text-sm px-3 py-1.5 rounded"
                  >
                    Mute all participants
                  </button>
                </div>

                {pendingRequests.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-400">Waiting to join:</p>
                    {pendingRequests.map((p) => (
                      <div
                        key={p.socketId}
                        className="flex justify-between items-center bg-gray-700 rounded px-2 py-1 text-sm"
                      >
                        <span>{p.userName}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => admitUser(p.socketId)}
                            className="bg-green-600 px-2 py-0.5 rounded text-xs"
                          >
                            Admit
                          </button>
                          <button
                            onClick={() => denyUser(p.socketId)}
                            className="bg-red-600 px-2 py-0.5 rounded text-xs"
                          >
                            Deny
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {Object.keys(raisedHands).length > 0 && (
              <div className="border-b border-gray-700 pb-3">
                <p className="text-xs text-gray-400 mb-1">Raised hands</p>
                {Object.entries(raisedHands).map(([socketId, name]) => (
                  <p key={socketId} className="text-sm">✋ {name}</p>
                ))}
              </div>
            )}

            <div className="flex-1 flex flex-col min-h-0">
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

            {recordingUrl && (
              <a
                href={recordingUrl}
                download={`meeting-${meetingId}.webm`}
                className="text-sm text-center bg-green-700 rounded px-3 py-2"
              >
                Download recording
              </a>
            )}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-wrap justify-center gap-3 border-t border-gray-700">
        <button
          onClick={toggleMic}
          className={`px-4 py-2 rounded-lg text-sm ${micOn ? "bg-gray-700" : "bg-red-600"}`}
        >
          {micOn ? "Mute mic" : "Unmute mic"}
        </button>
        <button
          onClick={toggleCam}
          className={`px-4 py-2 rounded-lg text-sm ${camOn ? "bg-gray-700" : "bg-red-600"}`}
        >
          {camOn ? "Turn camera off" : "Turn camera on"}
        </button>
        <button
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          className={`px-4 py-2 rounded-lg text-sm ${isScreenSharing ? "bg-blue-700" : "bg-gray-700"}`}
        >
          {isScreenSharing ? "Stop sharing" : "Share screen"}
        </button>
        <button
          onClick={toggleHand}
          className={`px-4 py-2 rounded-lg text-sm ${myHandRaised ? "bg-yellow-600" : "bg-gray-700"}`}
        >
          {myHandRaised ? "Lower hand" : "Raise hand ✋"}
        </button>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`px-4 py-2 rounded-lg text-sm ${isRecording ? "bg-red-600" : "bg-gray-700"}`}
          title="Records your screen/tab locally on this device and gives you a downloadable file"
        >
          {isRecording ? "Stop recording" : "Record meeting"}
        </button>
        <button
          onClick={() => setChatOpen((v) => !v)}
          className="px-4 py-2 rounded-lg text-sm bg-gray-700"
        >
          {chatOpen ? "Hide panel" : "Show panel"}
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

function RemoteTile({ stream, name, handRaised, isPresenter, isHost, onMute, onRemove }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative bg-black rounded-xl overflow-hidden aspect-video group">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <span className="absolute bottom-2 left-2 text-xs bg-black/60 px-2 py-1 rounded">
        {name} {isPresenter && "· Presenting"}
      </span>
      {handRaised && (
        <span className="absolute top-2 right-2 text-lg">✋</span>
      )}
      {isHost && (
        <div className="absolute top-2 left-2 hidden group-hover:flex gap-1">
          <button
            onClick={onMute}
            className="bg-gray-800/80 text-xs px-2 py-1 rounded"
          >
            Mute
          </button>
          <button
            onClick={onRemove}
            className="bg-red-700/80 text-xs px-2 py-1 rounded"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
