import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isLoggedIn, ready } = useAuth();
  if (!ready) return null;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
}
