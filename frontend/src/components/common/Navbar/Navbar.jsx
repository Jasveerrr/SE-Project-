import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }
  return (
    <header className="topbar">
      <NavLink className="brand" to="/dashboard">
        <span className="brand-mark">S</span> SwiftShare
      </NavLink>
      <nav className="nav-links">
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
      <div className="account-actions">
        <span>{user?.displayName || user?.email}</span>
        <button className="link-button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}
