import { useEffect, useState } from "react";
import API from "../api/axios";

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [teamName, setTeamName] = useState("");
  const [memberEmail, setMemberEmail] = useState({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchTeams = async () => {
    try {
      const res = await API.get("/teams/my-teams");
      setTeams(res.data.teams || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load teams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setCreating(true);
    try {
      await API.post("/teams/create", { name: teamName });
      setTeamName("");
      fetchTeams();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create team");
    } finally {
      setCreating(false);
    }
  };

  const handleAddMember = async (e, teamId) => {
    e.preventDefault();
    const email = memberEmail[teamId];
    if (!email?.trim()) return;

    try {
      await API.post("/teams/add-member", { teamId, email });
      setMemberEmail({ ...memberEmail, [teamId]: "" });
      fetchTeams();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add member");
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Teams 👥</h1>

      <form onSubmit={handleCreateTeam} className="flex gap-3 mb-6">
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="New team name"
          className="flex-1 border p-3 rounded-lg"
        />
        <button
          type="submit"
          disabled={creating}
          className="bg-black text-white px-4 py-2 rounded-lg disabled:opacity-60"
        >
          {creating ? "Creating..." : "+ Create Team"}
        </button>
      </form>

      {error && (
        <div className="bg-red-100 text-red-600 text-sm p-2 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading teams...</p>
      ) : teams.length === 0 ? (
        <p className="text-gray-500">No teams yet. Create one above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((team) => (
            <div key={team._id} className="bg-white p-5 rounded-xl shadow">
              <h2 className="font-bold text-lg">{team.name}</h2>
              <p className="text-gray-500 mb-3">
                Members: {team.members.length}
              </p>

              <ul className="text-sm text-gray-600 mb-3 space-y-1">
                {team.members.map((m) => (
                  <li key={m._id}>
                    {m.name} ({m.email})
                  </li>
                ))}
              </ul>

              <form
                onSubmit={(e) => handleAddMember(e, team._id)}
                className="flex gap-2"
              >
                <input
                  type="email"
                  placeholder="Add member by email"
                  value={memberEmail[team._id] || ""}
                  onChange={(e) =>
                    setMemberEmail({
                      ...memberEmail,
                      [team._id]: e.target.value,
                    })
                  }
                  className="flex-1 border p-2 rounded text-sm"
                />
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-3 py-2 rounded text-sm"
                >
                  Add
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
