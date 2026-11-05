import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';
import type { Database } from '@/types/database';

export type AppRole = Database['public']['Enums']['user_role'];
export type VerificationStatus = Database['public']['Enums']['verification_status'];

/**
 * What the UI knows about the current user. UX only: PostgreSQL (RLS, RPCs) is the authority for
 * every permission. role, verificationStatus and onboarded come from the user's own profile row
 * (RLS lets each user read it); they are null/false when signed out or when it could not load.
 * status stays 'loading' until both the session and, for a signed-in user, the profile are known.
 */
export interface AuthState {
  status: 'loading' | 'ready';
  session: Session | null;
  role: AppRole | null;
  verificationStatus: VerificationStatus | null;
  onboarded: boolean;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
