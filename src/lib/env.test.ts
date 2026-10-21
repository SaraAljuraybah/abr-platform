import { describe, expect, it } from 'vitest';
import { parseEnv } from './env-schema';

function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

// Built at runtime so the repository never contains a secret-shaped literal (check-secrets).
const fakeSecretKey = ['sb', 'secret', 'abcdefghijklmnop'].join('_');

const valid = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123',
};

describe('parseEnv', () => {
  it('accepts a URL and a publishable key', () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it('accepts a legacy anon JWT', () => {
    const key = fakeJwt({ role: 'anon' });
    expect(
      parseEnv({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: key }).VITE_SUPABASE_PUBLISHABLE_KEY,
    ).toBe(key);
  });

  it('rejects a missing key', () => {
    expect(() => parseEnv({ VITE_SUPABASE_URL: valid.VITE_SUPABASE_URL })).toThrow(
      /VITE_SUPABASE_PUBLISHABLE_KEY is required/,
    );
  });

  it('rejects an invalid URL', () => {
    expect(() => parseEnv({ ...valid, VITE_SUPABASE_URL: 'not a url' })).toThrow(
      /VITE_SUPABASE_URL must be an http\(s\) URL/,
    );
  });

  it('rejects a non-http URL', () => {
    expect(() => parseEnv({ ...valid, VITE_SUPABASE_URL: 'ftp://example.com' })).toThrow(
      /VITE_SUPABASE_URL/,
    );
  });

  it('rejects a secret key', () => {
    expect(() => parseEnv({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: fakeSecretKey })).toThrow(
      /is a secret key/,
    );
  });

  it('rejects a service-role JWT', () => {
    expect(() =>
      parseEnv({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: fakeJwt({ role: 'service_role' }) }),
    ).toThrow(/is a service-role key/);
  });
});
