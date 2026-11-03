import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { toAuthFailure } from '@/features/auth/api';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

/** A real supabase-js client whose fetch answers every request the same way. */
function clientAnswering(fetch: typeof globalThis.fetch) {
  return createClient('http://127.0.0.1:54321', 'test-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
}

/** Signs in through the real client and returns the error supabase-js built. */
async function signInError(fetch: typeof globalThis.fetch) {
  const { error } = await clientAnswering(fetch).auth.signInWithPassword({
    email: 'student@uni.example',
    password: 'Password1',
  });
  return error;
}

const answer = (status: number, body: unknown) => () =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

describe('toAuthFailure with errors built by supabase-js', () => {
  it.each([500, 502, 503, 504])(
    'maps HTTP %i to the generic failure, not network',
    async (status) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const error = await signInError(answer(status, { code: 'unexpected_failure', msg: 'boom' }));
      expect(error?.name).toBe('AuthRetryableFetchError');
      expect(error?.status).toBe(status);
      expect(toAuthFailure(error).kind).toBe('unexpected');
    },
  );

  it('maps a request that never got an answer to network', async () => {
    const error = await signInError(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(error?.name).toBe('AuthRetryableFetchError');
    expect(error?.status).toBe(0);
    expect(toAuthFailure(error).kind).toBe('network');
  });

  it('maps a 429 to rate limited', async () => {
    const error = await signInError(
      answer(429, { code: 'over_request_rate_limit', msg: 'Too many requests' }),
    );
    expect(toAuthFailure(error).kind).toBe('rateLimited');
  });
});
