import {
  isAuthApiError,
  isAuthError,
  isAuthRetryableFetchError,
  isAuthWeakPasswordError,
} from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { type Language } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import type { SignInValues, SignUpValues } from './schemas';

/** What the UI may tell the user. Never says whether an email has an account. */
export type AuthErrorKind =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'weakPassword'
  | 'signUpFailed'
  | 'rateLimited'
  | 'network'
  | 'unexpected';

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
  // supabase-js raises every 5xx as AuthRetryableFetchError with that status; only status 0 means
  // the request never got an answer. A 5xx is the server failing, so it gets the generic message.
  if ((isAuthRetryableFetchError(error) && error.status === 0) || error instanceof TypeError) {
    return new AuthFailure('network');
  }

  // Technical detail goes to the console, never to the screen.
  console.error(
    'Unexpected auth error',
    isAuthError(error) ? { code: error.code, status: error.status } : error,
  );
  return new AuthFailure('unexpected');
}

/** Where confirmation links (sign-up and resend) land. Must be in the Auth redirect allow-list. */
export const confirmationRedirectUrl = () => `${window.location.origin}/auth/confirmed`;

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
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: confirmationRedirectUrl() },
        });
        if (error) throw error;
        return null;
      } catch (error) {
        throw toAuthFailure(error);
      }
    },
  });
}

/**
 * Sign-up errors on top of toAuthFailure. The sign-up trigger's refusals reach the client as a
 * generic HTTP 500 ("unexpected_failure"), which supabase-js raises as AuthRetryableFetchError with
 * status 500 (every 5xx is "retryable"; a real network failure has status 0). They share one
 * message; the form pre-checks the student email to avoid most of them.
 */
export function toSignUpFailure(error: unknown): AuthFailure {
  // supabase-js raises AuthWeakPasswordError (not an AuthApiError) for weak_password.
  if (isAuthWeakPasswordError(error)) return new AuthFailure('weakPassword');
  if (
    (isAuthRetryableFetchError(error) && error.status === 500) ||
    (isAuthApiError(error) && error.code === 'email_address_invalid')
  ) {
    console.error('Sign-up refused', { code: error.code, status: error.status });
    return new AuthFailure('signUpFailed');
  }
  return toAuthFailure(error);
}

/** Metadata read by private.handle_new_user(): exactly these keys, per role. */
export function signUpMetadata(values: SignUpValues) {
  const common = { role: values.role, full_name: values.fullName };
  switch (values.role) {
    case 'student':
      return { ...common, university_id: values.universityId };
    case 'organization':
      return { ...common, organization_name: values.organizationName };
    case 'mentor':
      return common;
  }
}

/**
 * Resolves for a new account AND for an email that already has one: with email confirmations on,
 * Supabase answers an existing address with an obfuscated success, and the UI must not tell the
 * two apart (no account enumeration). user_already_exists is treated the same way.
 */
export function useSignUp() {
  return useMutation<null, AuthFailure, SignUpValues>({
    mutationFn: async (values) => {
      try {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: signUpMetadata(values),
            emailRedirectTo: confirmationRedirectUrl(),
          },
        });
        if (error && !(isAuthApiError(error) && error.code === 'user_already_exists')) throw error;
        return null;
      } catch (error) {
        throw toSignUpFailure(error);
      }
    },
  });
}

export interface University {
  id: string;
  name: string;
}

/** Active universities, named and sorted in the current language. RLS shows anon active rows only. */
export function useUniversities(language: Language) {
  return useQuery({
    queryKey: ['universities', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('universities')
        .select('id, name_ar, name_en')
        .eq('active', true);
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
    select: (rows): University[] => {
      const collator = new Intl.Collator(language);
      return rows
        .map((row) => ({ id: row.id, name: language === 'ar' ? row.name_ar : row.name_en }))
        .sort((a, b) => collator.compare(a.name, b.name));
    },
  });
}

/**
 * The sign-up pre-check (the trigger enforces the same rule). Cached per university and email, so
 * a check on blur is not repeated on submit. Throws AuthFailure when the check itself fails.
 */
export function useCheckStudentEmail() {
  const queryClient = useQueryClient();
  return useCallback(
    (universityId: string, email: string) =>
      queryClient
        .query({
          queryKey: ['check-student-email', universityId, email.trim().toLowerCase()],
          queryFn: async () => {
            const { data, error } = await supabase.rpc('check_student_email', {
              p_university_id: universityId,
              p_email: email.trim(),
            });
            if (error) throw error;
            return data;
          },
          staleTime: 60_000,
          retry: false,
        })
        .catch((error: unknown) => {
          throw toAuthFailure(error);
        }),
    [queryClient],
  );
}

/**
 * The confirmation link (implicit flow) lands on /auth/confirmed#access_token=… or, when it failed,
 * #error=…&error_code=otp_expired. supabase-js reads the URL once, when the client is created
 * (detectSessionInUrl), and initialize() returns that same result. Awaiting it means the link has
 * been processed, so the page may then clean the address bar. Resolves to whether a session exists
 * (from the link or from earlier).
 */
export function useAuthCallback() {
  return useQuery({
    queryKey: ['auth-callback'],
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    queryFn: async (): Promise<{ hasSession: boolean }> => {
      const { error } = await supabase.auth.initialize();
      // Expired or already used: the page shows the error state. Technical detail stays here.
      if (error) console.error('Confirmation link failed', { code: error.code, name: error.name });
      const { data } = await supabase.auth.getSession();
      return { hasSession: data.session !== null };
    },
  });
}

/**
 * Signs out on this device. The caller navigates away first, so the guards do not bounce the
 * user to /sign-in. The query cache is cleared, so no profile data survives in memory.
 * supabase-js removes the local session even when the network call fails.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) console.error('Sign-out failed', { code: error.code, status: error.status });
    queryClient.clear();
  }, [queryClient]);
}
