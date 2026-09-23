import { Routes, Route } from "react-router-dom";
import { AuthGuard } from "../components/auth/AuthGuard/AuthGuard.jsx";
import { MainLayout } from "../layouts/MainLayout/MainLayout.jsx";
import { Dashboard } from "../pages/Dashboard/Dashboard.jsx";
import { History } from "../pages/History/History.jsx";
import { Home } from "../pages/Home/Home.jsx";
import { Login } from "../pages/Login/Login.jsx";
import { Register } from "../pages/Register/Register.jsx";
import { Settings } from "../pages/Settings/Settings.jsx";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<AuthGuard />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
}
