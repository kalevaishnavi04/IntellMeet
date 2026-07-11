import { useEffect, useState } from "react";
import API from "../api/axios";

export default function AISummary() {
  const [meetings, setMeetings] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [form, setForm] = useState({ meetingId: "", notes: "", actionItems: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const [meetingsRes, summariesRes] = await Promise.all([
        API.get("/meetings/my-meetings"),
        API.get("/summaries/my-summaries"),
      ]);
      setMeetings(meetingsRes.data.meetings || []);
      setSummaries(summariesRes.data.summaries || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.meetingId || !form.notes.trim()) return;

    setSaving(true);
    try {
      await API.post("/summaries/create", form);
      setForm({ meetingId: "", notes: "", actionItems: "" });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save summary");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Meeting Summary 🤖</h1>
      <p className="text-sm text-gray-400 mb-6">
        Add notes and action items for a meeting. (Manually entered for now —
        automatic AI transcription/summary is a planned future upgrade.)
      </p>

      {error && (
        <div className="bg-red-100 text-red-600 text-sm p-2 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl shadow mb-6 space-y-3">
        <select
          name="meetingId"
          value={form.meetingId}
          onChange={handleChange}
          required
          className="w-full border p-3 rounded-lg"
        >
          <option value="">-- Select a meeting --</option>
          {meetings.map((m) => (
            <option key={m._id} value={m._id}>
              {m.title}
            </option>
          ))}
        </select>

        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          required
          placeholder="Meeting notes / summary"
          rows={3}
          className="w-full border p-3 rounded-lg"
        />

        <input
          type="text"
          name="actionItems"
          value={form.actionItems}
          onChange={handleChange}
          placeholder="Action items, comma separated (e.g. Fix login bug, Deploy to prod)"
          className="w-full border p-3 rounded-lg"
        />

        <button
          type="submit"
          disabled={saving}
          className="bg-black text-white px-4 py-2 rounded-lg disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Summary"}
        </button>
      </form>

      {loading ? (
        <p className="text-gray-500">Loading summaries...</p>
      ) : summaries.length === 0 ? (
        <p className="text-gray-500">No summaries saved yet.</p>
      ) : (
        <div className="space-y-4">
          {summaries.map((s) => (
            <div key={s._id} className="bg-white p-5 rounded-xl shadow">
              <h2 className="font-bold text-lg mb-2">
                {s.meeting?.title || "Untitled Meeting"}
              </h2>
              <p className="text-gray-600">{s.notes}</p>

              {s.actionItems?.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold">Action Items:</h3>
                  <ul className="list-disc ml-5 mt-2">
                    {s.actionItems.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
