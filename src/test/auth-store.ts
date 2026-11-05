import type { AuthState } from '@/features/auth/auth-context';
import { signedOut } from './render-route';

/** Stands in for AuthProvider: tests change the state the way onAuthStateChange would. */
export const authStore = (() => {
  let state = signedOut;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next: AuthState) => {
      state = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
})();
