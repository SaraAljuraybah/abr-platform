// UX only: guards hide screens a user cannot use. The database is the authority (Plan v2.0 §7, principle 4).
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { LoadingScreen } from './LoadingScreen';

export function RequireAuth() {
  const { status, session } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <LoadingScreen />;

  if (!session) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }

  return <Outlet />;
}
