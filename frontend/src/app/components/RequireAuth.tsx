import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { email } = useAuth();
  const location = useLocation();

  if (email === undefined) {
    return null;
  }
  if (!email) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
