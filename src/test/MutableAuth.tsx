import { type ReactNode, useSyncExternalStore } from 'react';
import { AuthContext } from '@/features/auth/auth-context';
import { authStore } from './auth-store';

/** Provides authStore's current state as the auth context. */
export function MutableAuth({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(authStore.subscribe, authStore.get);
  return <AuthContext value={state}>{children}</AuthContext>;
}
