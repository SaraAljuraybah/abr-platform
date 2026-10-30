import { isAuthApiError, isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { SignInValues } from './schemas';

/** What the UI may tell the user. Never says whether an email has an account. */
export type AuthErrorKind =
  'invalidCredentials' | 'emailNotConfirmed' | 'rateLimited' | 'network' | 'unexpected';

export class AuthFailure extends Error {
  constructor(readonly kind: AuthErrorKind) {
    super(kind);
    this.name = 'AuthFailure';
  }
}

/** Maps Supabase Auth errors by code and status, never by message text. */
export function toAuthFailure(error: unknown): AuthFailure {
  if (error instanceof AuthFailure) return error;

  if (isAuthApiError(error)) {
    if (error.code === 'invalid_credentials') return new AuthFailure('invalidCredentials');
    if (error.code === 'email_not_confirmed') return new AuthFailure('emailNotConfirmed');
    if (
      error.status === 429 ||
      error.code === 'over_request_rate_limit' ||
      error.code === 'over_email_send_rate_limit'
    ) {
      return new AuthFailure('rateLimited');
    }
  }
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) {
    return new AuthFailure('network');
  }

  // Technical detail goes to the console, never to the screen.
  console.error(
    'Unexpected auth error',
    isAuthError(error) ? { code: error.code, status: error.status } : error,
  );
  return new AuthFailure('unexpected');
}

export function useSignIn() {
  return useMutation<null, AuthFailure, SignInValues>({
    mutationFn: async ({ email, password }) => {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return null;
      } catch (error) {
        throw toAuthFailure(error);
      }
    },
  });
}

export function useResendConfirmation() {
  return useMutation<null, AuthFailure, { email: string }>({
    mutationFn: async ({ email }) => {
      try {
        const { error } = await supabase.auth.resend({ type: 'signup', email });
        if (error) throw error;
        return null;
      } catch (error) {
        throw toAuthFailure(error);
      }
    },
  });
}
