import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Loader } from "../../ui/Loader/Loader.jsx";

export function AuthGuard() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loader label="Restoring session..." />;
  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  );
}
