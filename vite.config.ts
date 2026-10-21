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
      env: {
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_placeholder',
      },
    },
  };
});
