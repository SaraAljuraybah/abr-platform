import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

export type AppRole = 'student' | 'organization' | 'mentor' | 'admin';

/**
 * What the UI knows about the current user. UX only: PostgreSQL (RLS, RPCs) is the
 * authority for every permission. role and onboarded come from the profile once it
 * exists (SCRUM-12/13); until then they are null/false.
 */
export interface AuthState {
  status: 'loading' | 'ready';
  session: Session | null;
  role: AppRole | null;
  onboarded: boolean;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
