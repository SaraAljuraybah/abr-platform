// @vitest-environment node
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import abrPlugin from '../../eslint-rules/abr-plugin.js';

const RULE = 'abr/no-physical-direction-classes';

// Untyped parser so virtual files can be linted; the rule needs no type information.
const ruleOnly = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.tsx', '**/*.ts'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      plugins: { abr: abrPlugin },
      rules: { [RULE]: 'error' },
    },
  ],
});

async function lint(code: string): Promise<string[]> {
  const [result] = await ruleOnly.lintText(code, { filePath: 'src/probe.tsx' });
  const fatal = result?.messages.find((m) => m.fatal);
  if (fatal) throw new Error(fatal.message);
  return (result?.messages ?? []).filter((m) => m.ruleId === RULE).map((m) => m.message);
}

describe('RTL lint rule', () => {
  it('is enabled as an error for application source in the real config', async () => {
    const config = (await new ESLint().calculateConfigForFile('src/main.tsx')) as {
      rules: Record<string, unknown>;
    };
    expect(config.rules[RULE]).toEqual([2]);
  }, 60_000); // loads the full type-aware config

  it.each([
    'ml-4',
    'mr-2',
    'pl-3',
    'pr-1',
    '-ml-2',
    'ml-auto',
    'ml-[12px]',
    'pr-(--gutter)',
    'left-0',
    'left-1/2',
    'right-4',
    'md:ml-4',
    'hover:pr-2',
    '!ml-1',
    'rounded-l-lg',
    'rounded-tr',
    'border-l',
    'border-r-2',
    'text-left',
    'text-right',
    'float-left',
  ])('rejects the physical class "%s"', async (cls) => {
    const messages = await lint(`export const A = () => <div className="flex ${cls}" />;\n`);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain(`"${cls}"`);
  });

  it('rejects physical classes inside template literals', async () => {
    const messages = await lint('const gap = 2;\nexport const c = `ml-${gap} ps-2`;\n');
    expect(messages).toHaveLength(1);
  });

  it('allows logical classes', async () => {
    const messages = await lint(
      'export const A = () => <div className="ms-4 me-2 ps-3 pe-1 start-0 end-4 rounded-s-lg border-e text-start float-end" />;\n',
    );
    expect(messages).toEqual([]);
  });

  it('ignores prose that merely contains direction words', async () => {
    const messages = await lint(
      `export const label = 'Turn right at the left door; text runs left-to-right.';\n`,
    );
    expect(messages).toEqual([]);
  });
});
