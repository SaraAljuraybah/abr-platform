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
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Stable vendor chunks: better caching, and no single chunk over the 500 kB warning.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]@supabase[\\/]/.test(id)) return 'vendor-supabase';
            if (/[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id))
              return 'vendor-react';
            if (/[\\/](i18next|react-i18next)[\\/]/.test(id)) return 'vendor-i18n';
            if (/[\\/]zod[\\/]/.test(id)) return 'vendor-zod';
            return 'vendor';
          },
        },
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
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
