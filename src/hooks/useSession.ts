import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type SessionState =
  { status: 'loading'; session: null } | { status: 'ready'; session: Session | null };

/** Read-only view of the Supabase Auth session. Sign-in and sign-up flows arrive in SCRUM-13. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ status: 'ready', session: data.session });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ status: 'ready', session });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
