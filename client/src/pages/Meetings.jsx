import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

export default function Meetings() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const fetchMeetings = async () => {
    try {
      const res = await API.get("/meetings/my-meetings");
      setMeetings(res.data.meetings || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load meetings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setCreating(true);
    setError("");
    try {
      await API.post("/meetings/create", {
        title,
        scheduledAt: scheduledAt || null,
      });
      setTitle("");
      setScheduledAt("");
      fetchMeetings();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create meeting");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setJoining(true);
    setError("");
    try {
      // Registers the current user as a participant (even if they
      // didn't create this meeting) before entering the call.
      await API.post(`/meetings/${joinCode.trim()}/join`);
      navigate(`/meeting/${joinCode.trim()}`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not join meeting");
    } finally {
      setJoining(false);
    }
  };

  const handleJoinExisting = async (meetingId) => {
    setError("");
    try {
      await API.post(`/meetings/${meetingId}/join`);
      navigate(`/meeting/${meetingId}`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not join meeting");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Meetings 🎥</h1>
      </div>

      {/* Create meeting form */}
      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title"
          className="flex-1 border p-3 rounded-lg"
        />
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="border p-3 rounded-lg text-sm text-gray-600"
          title="Optional: schedule for later"
        />
        <button
          type="submit"
          disabled={creating}
          className="bg-black text-white px-4 py-2 rounded-lg disabled:opacity-60 whitespace-nowrap"
        >
          {creating ? "Creating..." : "+ Create Meeting"}
        </button>
      </form>

      {/* Join an existing meeting by ID/link — this is how invited
          participants (not just the host) get into a call. */}
      <form onSubmit={handleJoin} className="flex gap-3 mb-6">
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Have a meeting ID? Paste it here to join"
          className="flex-1 border p-3 rounded-lg"
        />
        <button
          type="submit"
          disabled={joining}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-60"
        >
          {joining ? "Joining..." : "Join Meeting"}
        </button>
      </form>

      {error && (
        <div className="bg-red-100 text-red-600 text-sm p-2 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading meetings...</p>
      ) : meetings.length === 0 ? (
        <p className="text-gray-500">No meetings yet. Create one above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meetings.map((m) => (
            <div key={m._id} className="bg-white p-5 rounded-xl shadow">
              <h2 className="font-bold text-lg">{m.title}</h2>
              <p className="text-gray-500 capitalize">Status: {m.status}</p>
              {m.scheduledAt && (
                <p className="text-gray-400 text-sm">
                  Scheduled: {new Date(m.scheduledAt).toLocaleString()}
                </p>
              )}
              <p className="text-gray-400 text-sm break-all">
                Meeting ID: {m.meetingId}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleJoinExisting(m.meetingId)}
                  className="bg-blue-500 text-white px-3 py-2 rounded"
                >
                  Join Meeting
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(m.meetingId);
                  }}
                  className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm"
                  title="Copy meeting ID to share with others"
                >
                  Copy ID
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
