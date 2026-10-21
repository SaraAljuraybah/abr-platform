// UX only: guards hide screens a user cannot use. The database is the authority (Plan v2.0 §7, principle 4).
import { Navigate, Outlet } from 'react-router';
import { type AppRole, useAuth } from '@/features/auth/auth-context';

/** Must be nested inside RequireAuth and RequireOnboarding, so /app (the fallback) never loops. */
export function RequireRole({ allow }: { allow: AppRole }) {
  const auth = useAuth();
  return auth.role === allow ? <Outlet /> : <Navigate to="/app" replace />;
}
