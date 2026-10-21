import { type ReactNode, useMemo } from 'react';
import { useSession } from '@/hooks/useSession';
import { AuthContext, type AuthState } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { status, session } = useSession();

  const value = useMemo<AuthState>(
    () => ({
      status,
      session,
      // No profile table yet (SCRUM-12). Never derive these from client-editable data.
      role: null,
      onboarded: false,
    }),
    [status, session],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
