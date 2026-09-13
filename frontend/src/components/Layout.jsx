import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { auth, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          Golf Course <span>Road</span>
        </div>
        <nav>
          <NavLink to="/listings" className={({ isActive }) => (isActive ? "active" : "")}>
            Buy
          </NavLink>
          <NavLink to="/rentals" className={({ isActive }) => (isActive ? "active" : "")}>
            Rent
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => (isActive ? "active" : "")}>
            Projects
          </NavLink>
          <NavLink to="/saved" className={({ isActive }) => (isActive ? "active" : "")}>
            Saved
          </NavLink>
          <NavLink to="/insights" className={({ isActive }) => (isActive ? "active" : "")}>
            Insights
          </NavLink>
          <span style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>{auth?.email}</span>
          <button className="secondary" onClick={logout}>
            Log out
          </button>
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
