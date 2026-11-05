import { useQuery } from '@tanstack/react-query';
import type { AppRole, VerificationStatus } from './auth-context';

export interface OwnProfile {
  role: AppRole;
  verificationStatus: VerificationStatus;
  onboarded: boolean;
}

export const ownProfileKey = (userId: string | undefined) => ['profile', 'own', userId] as const;

/**
 * The signed-in user's own profile (RLS: profiles_select). AuthProvider runs on every page, so the
 * client loads with a dynamic import, like useSession, to keep it off the landing page's critical
 * path. Disabled without a user id.
 */
export function useOwnProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ownProfileKey(userId),
    enabled: userId !== undefined,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<OwnProfile | null> => {
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase
        .from('profiles')
        .select('role, verification_status, onboarding_completed')
        .eq('id', userId ?? '')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        role: data.role,
        verificationStatus: data.verification_status,
        onboarded: data.onboarding_completed,
      };
    },
  });
}
