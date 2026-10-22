import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

export type SessionState =
  { status: 'loading'; session: null } | { status: 'ready'; session: Session | null };

/**
 * Read-only view of the Supabase Auth session. Sign-in and sign-up flows arrive in SCRUM-13.
 *
 * The client (supabase-js) and env validation (Zod) load with a dynamic import, keeping about
 * 80 kB gzip off the critical path of public pages. Until it resolves the status is 'loading':
 * guards show their loading state and public pages show the signed-out actions.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    import('@/lib/supabase')
      .then(({ supabase }) => {
        if (!active) return;

        void supabase.auth.getSession().then(({ data }) => {
          if (active) setState({ status: 'ready', session: data.session });
        });

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (active) setState({ status: 'ready', session });
        });
        unsubscribe = () => {
          data.subscription.unsubscribe();
        };
      })
      .catch((error: unknown) => {
        // Invalid configuration fails the build first (vite.config.ts); this is a last resort.
        console.error('Supabase client failed to load', error);
        if (active) setState({ status: 'ready', session: null });
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return state;
}
