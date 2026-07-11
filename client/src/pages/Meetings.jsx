import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

export default function Meetings() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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
    try {
      await API.post("/meetings/create", { title });
      setTitle("");
      fetchMeetings();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create meeting");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Meetings 🎥</h1>
      </div>

      {/* Create meeting form */}
      <form onSubmit={handleCreate} className="flex gap-3 mb-6">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title"
          className="flex-1 border p-3 rounded-lg"
        />
        <button
          type="submit"
          disabled={creating}
          className="bg-black text-white px-4 py-2 rounded-lg disabled:opacity-60"
        >
          {creating ? "Creating..." : "+ Create Meeting"}
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
              <p className="text-gray-400 text-sm">
                Meeting ID: {m.meetingId}
              </p>
              <button
                onClick={() => navigate(`/meeting/${m.meetingId}`)}
                className="mt-3 bg-blue-500 text-white px-3 py-2 rounded"
              >
                Join Meeting
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
