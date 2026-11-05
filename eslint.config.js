// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import abrPlugin from './eslint-rules/abr-plugin.js';

export default defineConfig(
  { ignores: ['dist', 'coverage', 'node_modules', 'supabase', 'src/types/database.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    plugins: { abr: abrPlugin },
    rules: {
      'abr/no-physical-direction-classes': 'error',
    },
  },
  {
    // Tests take the route table from src/test/routes.ts, which preloads the lazy routes, so a
    // findBy never waits on code-splitting.
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    ignores: ['src/test/routes.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/routes/routes',
              message: "Import routes from '@/test/routes' in tests (it preloads the lazy routes).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.node },
  },
  prettier,
);
