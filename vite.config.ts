/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { parseEnv } from './src/lib/env-schema';

export default defineConfig(({ mode }) => {
  // Fail the dev server and the build early (not only at runtime) on missing or unsafe config.
  if (mode !== 'test') {
    // loadEnv also picks up VITE_* variables from process.env (as CI sets them).
    parseEnv(loadEnv(mode, process.cwd(), 'VITE_'));
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // Option lists and validation shared with the Edge Functions (plain TS, no Deno APIs).
        '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
      },
    },
    build: {
      // Read by scripts/check-chunk-cycles.mjs in `npm run ci`. No custom manualChunks: a hand-made
      // vendor split once put React and React-dependent libraries in chunks that imported each
      // other, and the built site crashed on load. Rollup's own splitting has no such cycles.
      manifest: true,
      // The entry chunk (React, router, i18n, zod, the shell) is about 610 kB (190 kB gzip). The
      // limit sits just above it so the warning means real growth again.
      chunkSizeWarningLimit: 650,
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
      restoreMocks: true,
      unstubEnvs: true,
      // Full-page render tests (landing) are heavy in jsdom. Half the cores and a 15 s budget keep
      // runs reliable on busy developer machines; one jsdom worker per core exhausted memory.
      maxWorkers: '50%',
      testTimeout: 15_000,
      env: {
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_placeholder',
      },
    },
  };
});
