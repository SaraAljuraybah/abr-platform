// UX only, like the other guards. Phase 1 launch mode (VITE_AUTH_ENABLED=false): accounts are not
// open yet, so the signed-in area redirects to the "Coming soon" page shown at /sign-in.
import { Navigate, Outlet } from 'react-router';
import { isAuthEnabled } from '@/lib/features';

export function RequireAuthEnabled() {
  return isAuthEnabled() ? <Outlet /> : <Navigate to="/sign-in" replace />;
}
