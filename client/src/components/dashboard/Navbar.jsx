import { FaBell, FaUserCircle } from "react-icons/fa";

function Navbar() {
  return (
    <div className="bg-white shadow-sm p-4 flex justify-between items-center">
      <div>
        <h2 className="text-2xl font-semibold">
          Dashboard
        </h2>
      </div>

      <div className="flex items-center gap-5">
        <FaBell className="text-xl cursor-pointer" />
        <FaUserCircle className="text-3xl cursor-pointer" />
      </div>
    </div>
  );
}

export default Navbar;