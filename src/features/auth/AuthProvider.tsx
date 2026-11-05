import { type ReactNode, useEffect, useMemo } from 'react';
import { useSession } from '@/hooks/useSession';
import { AuthContext, type AuthState } from './auth-context';
import { useOwnProfile } from './profile-api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { status, session } = useSession();
  const userId = session?.user.id;
  const profile = useOwnProfile(userId);

  useEffect(() => {
    // Technical detail goes to the console; the guards treat the user as having no profile.
    if (profile.error) console.error('Profile failed to load', profile.error);
  }, [profile.error]);

  // Pending only while a signed-in user's first fetch runs; a background refetch keeps the data.
  const profileLoading = userId !== undefined && profile.isPending && !profile.isError;
  const row = userId !== undefined ? profile.data : undefined;

  const value = useMemo<AuthState>(
    () => ({
      status: status === 'loading' || profileLoading ? 'loading' : 'ready',
      session,
      role: row?.role ?? null,
      verificationStatus: row?.verificationStatus ?? null,
      onboarded: row?.onboarded ?? false,
    }),
    [status, profileLoading, session, row],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
