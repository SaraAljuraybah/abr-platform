/**
 * Build-time feature flags. Read straight from import.meta.env (no zod) so the landing page's
 * critical path stays small; env-schema.ts validates the values at build time and when env.ts
 * loads, so an invalid value never ships.
 */

/** VITE_AUTH_ENABLED: false in phase 1 production (accounts "coming soon"); true otherwise. */
export function isAuthEnabled(): boolean {
  const value: unknown = import.meta.env.VITE_AUTH_ENABLED;
  return value !== 'false';
}
