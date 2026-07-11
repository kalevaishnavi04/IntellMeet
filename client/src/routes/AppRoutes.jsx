import { Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import Register from "../pages/Register";
import Dashboard from "../pages/Dashboard";
import Meetings from "../pages/Meetings";
import Teams from "../pages/Teams";
import AISummary from "../pages/AISummary";
import MeetingRoom from "../pages/MeetingRoom";
import MainLayout from "../layouts/MainLayout";
import PrivateRoute from "./PrivateRoute";

function AppRoutes() {
  return (
    <Routes>
      {/* default → login */}
      <Route path="/" element={<Navigate to="/login" />} />

      {/* auth pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* protected app pages (share sidebar/navbar layout) */}
      <Route
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/ai" element={<AISummary />} />
      </Route>

      {/* full-screen video call room (no sidebar) */}
      <Route
        path="/meeting/:meetingId"
        element={
          <PrivateRoute>
            <MeetingRoom />
          </PrivateRoute>
        }
      />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default AppRoutes;
