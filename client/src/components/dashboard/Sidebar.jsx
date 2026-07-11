import { FaHome, FaVideo, FaTasks, FaUsers, FaChartBar } from "react-icons/fa";

function Sidebar() {
  return (
    <div className="w-64 h-screen bg-slate-900 text-white p-5">
      <h1 className="text-2xl font-bold mb-8">
        IntellMeet
      </h1>

      <ul className="space-y-6">
        <li className="flex items-center gap-3 cursor-pointer">
          <FaHome />
          Dashboard
        </li>

        <li className="flex items-center gap-3 cursor-pointer">
          <FaVideo />
          Meetings
        </li>

        <li className="flex items-center gap-3 cursor-pointer">
          <FaTasks />
          Tasks
        </li>

        <li className="flex items-center gap-3 cursor-pointer">
          <FaUsers />
          Team
        </li>

        <li className="flex items-center gap-3 cursor-pointer">
          <FaChartBar />
          Analytics