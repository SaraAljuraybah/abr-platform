import { z } from 'zod';

/**
 * Browser environment contract. Only the project URL and the publishable key may
 * reach the bundle (CLAUDE.md rule 8). A secret key or a service-role JWT is
 * rejected here as defence in depth; scripts/check-secrets.mjs is the CI gate.
 */

function jwtRole(token: string): string | null {
  const payload = token.split('.')[1];
  if (!token.startsWith('eyJ') || payload === undefined) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    if (json !== null && typeof json === 'object' && 'role' in json) {
      return typeof json.role === 'string' ? json.role : null;
    }
    return null;
  } catch {
    return null;
  }
}

const publishableKey = z
  .string({ error: 'VITE_SUPABASE_PUBLISHABLE_KEY is required' })
  .trim()
  .min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY is required')
  .refine((key) => !key.startsWith('sb_secret_'), {
    error: 'VITE_SUPABASE_PUBLISHABLE_KEY is a secret key. Use the publishable key.',
  })
  .refine((key) => jwtRole(key) !== 'service_role', {
    error: 'VITE_SUPABASE_PUBLISHABLE_KEY is a service-role key. Use the publishable key.',
  });

export const envSchema = z.object({
  VITE_SUPABASE_URL: z.url({
    protocol: /^https?$/,
    error: 'VITE_SUPABASE_URL must be an http(s) URL',
  }),
  VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration. Copy .env.example to .env.local and fill it in.\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
