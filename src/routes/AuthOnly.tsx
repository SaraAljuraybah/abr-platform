import type { ReactNode } from 'react';
import { isAuthEnabled } from '@/lib/features';
import { ComingSoonPage } from '@/pages/ComingSoonPage';

/** An account screen: phase 1 launch mode (VITE_AUTH_ENABLED=false) shows "Coming soon" instead. */
export function AuthOnly({ children }: { children: ReactNode }) {
  return isAuthEnabled() ? children : <ComingSoonPage />;
}
