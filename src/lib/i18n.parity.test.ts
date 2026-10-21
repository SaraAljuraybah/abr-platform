import { describe, expect, it } from 'vitest';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';

type Tree = Record<string, unknown>;

function flatten(tree: Tree, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of flatten(value as Tree, path)) out.set(k, v);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

const enKeys = flatten(en);
const arKeys = flatten(ar);

describe('locale parity', () => {
  it('has no key in English that is missing in Arabic', () => {
    expect([...enKeys.keys()].filter((k) => !arKeys.has(k))).toEqual([]);
  });

  it('has no key in Arabic that is missing in English', () => {
    expect([...arKeys.keys()].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it.each([
    ['en', enKeys],
    ['ar', arKeys],
  ] as const)('has only non-empty string values in %s', (_lang, keys) => {
    const bad = [...keys]
      .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });
});
