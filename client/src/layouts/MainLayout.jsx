import { useContext } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import { AuthContext } from "../context/AuthContext";

export default function MainLayout() {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-black text-white p-5 flex flex-col">
        <h1 className="text-2xl font-bold mb-8">IntellMeet 🚀</h1>

        <nav className="space-y-4 flex-1">
          <NavLink to="/dashboard" className="block hover:text-blue-400">
            Dashboard
          </NavLink>

          <NavLink to="/meetings" className="block hover:text-blue-400">
            Meetings
          </NavLink>

          <NavLink to="/teams" className="block hover:text-blue-400">
            Teams
          </NavLink>

          <NavLink to="/ai" className="block hover:text-blue-400">
            AI Summary
          </NavLink>
        </nav>

        <button
          onClick={handleLogout}
          className="mt-auto bg-gray-800 hover:bg-gray-700 text-sm py-2 rounded-lg"
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <Navbar />
        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
