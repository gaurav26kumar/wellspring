import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();

  // Still restoring the session from a stored token — render nothing
  // rather than redirect, or a refresh would always bounce to /login
  // for a split second even when the token is valid.
  if (!ready) return null;

  if (!user) return <Navigate to="/login" replace />;
  return children;
}
