import { Outlet } from "react-router-dom";
import { Navbar } from "../../components/common/Navbar/Navbar.jsx";

export function MainLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}
