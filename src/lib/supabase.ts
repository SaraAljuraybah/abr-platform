import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * The browser client holds only the project URL and the publishable key.
 * It authenticates the user; PostgreSQL (RLS, RPCs) decides what they may do.
 * Feature code reaches it through typed query hooks, never from presentational components.
 */
export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
