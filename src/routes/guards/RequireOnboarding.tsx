// UX only: guards hide screens a user cannot use. The database is the authority (Plan v2.0 §7, principle 4).
import { Navigate, Outlet } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';

/** Must be nested inside RequireAuth. /onboarding itself is never wrapped in this guard. */
export function RequireOnboarding() {
  const { onboarded } = useAuth();
  return onboarded ? <Outlet /> : <Navigate to="/onboarding" replace />;
}
