import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { type FormFailure, toFormFailure } from '../errors';

/**
 * Sends the interest form to the submit-interest Edge Function (it validates, rate-limits and
 * saves). The same answer comes back for a new and a repeat email.
 */
export function useSubmitInterest() {
  return useMutation<null, FormFailure, Record<string, unknown>>({
    mutationFn: async (payload) => {
      const result = await supabase.functions
        .invoke('submit-interest', { body: payload })
        .catch((error: unknown) => ({ error }));
      const error: unknown = result.error;
      if (error) throw toFormFailure(error);
      return null;
    },
  });
}
