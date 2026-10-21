// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

/**
 * RTL guard (CLAUDE.md rule 5, ADR-0008): physical-direction Tailwind classes
 * break the Arabic layout. Use the logical equivalents instead.
 */
const PHYSICAL_CLASS_HINTS = [
  [/^-?m[lr]-/, 'ms-* / me-*'],
  [/^-?p[lr]-/, 'ps-* / pe-*'],
  [/^-?(left|right)-/, 'start-* / end-*'],
  [/^-?inset-[lr]-/, 'start-* / end-*'],
  [/^-?scroll-m[lr]-/, 'scroll-ms-* / scroll-me-*'],
  [/^-?scroll-p[lr]-/, 'scroll-ps-* / scroll-pe-*'],
  [/^rounded-[lr](-|$)/, 'rounded-s* / rounded-e*'],
  [/^rounded-[tb][lr](-|$)/, 'rounded-ss* / rounded-se* / rounded-es* / rounded-ee*'],
  [/^border-[lr](-|$)/, 'border-s* / border-e*'],
  [/^text-(left|right)$/, 'text-start / text-end'],
  [/^float-(left|right)$/, 'float-start / float-end'],
  [/^clear-(left|right)$/, 'clear-start / clear-end'],
];

/** @param {string} token */
function physicalHint(token) {
  // Strip variant prefixes (md:, hover:, rtl:, [&>svg]:) and the important modifier.
  const utility = token.slice(token.lastIndexOf(':') + 1).replace(/^!/, '');
  for (const [pattern, hint] of PHYSICAL_CLASS_HINTS) {
    if (/** @type {RegExp} */ (pattern).test(utility)) return /** @type {string} */ (hint);
  }
  return null;
}

/** @type {import('eslint').ESLint.Plugin} */
const abrPlugin = {
  rules: {
    'no-physical-direction-classes': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow physical left/right Tailwind classes; use logical ones for RTL.',
        },
        messages: {
          physical: '"{{token}}" is a physical-direction class and breaks RTL. Use {{hint}}.',
        },
        schema: [],
      },
      create(context) {
        /** @param {import('estree').Node} node @param {string} text */
        function check(node, text) {
          for (const token of text.split(/\s+/)) {
            if (!token) continue;
            const hint = physicalHint(token);
            if (hint) context.report({ node, messageId: 'physical', data: { token, hint } });
          }
        }
        return {
          Literal(node) {
            if (typeof node.value === 'string') check(node, node.value);
          },
          TemplateElement(node) {
            check(node, node.value.cooked ?? node.value.raw);
          },
        };
      },
    },
  },
};

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
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.node },
  },
  prettier,
);
