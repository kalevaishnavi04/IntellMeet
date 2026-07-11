import { useEffect, useState, useContext } from "react";
import API from "../api/axios";
import { AuthContext } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [meetingCount, setMeetingCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await API.get("/meetings/my-meetings");
        setMeetingCount(res.data.meetings?.length || 0);
      } catch (err) {
        // Fails silently on dashboard if backend isn't reachable
        console.error(err);
      }
    };
    fetchCount();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Dashboard 📊</h1>
      {user && (
        <p className="text-gray-500 mb-6">Welcome back, {user.name}!</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          Total Meetings: {meetingCount}
        </div>

        <div className="bg-white p-4 rounded shadow">
          Active Users: 45
        </div>

        <div className="bg-white p-4 rounded shadow">
          AI Summaries: 8
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Note: "Active Users" and "AI Summaries" are placeholder values —
        these will connect to real data once the Team and AI modules are
        built.
      </p>
    </div>
  );
}
