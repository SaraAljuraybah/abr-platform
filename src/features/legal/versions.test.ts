// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRIVACY_VERSION, TERMS_VERSION } from './versions';

// Every migration in apply order: the last definition of the function wins.
const directory = new URL('../../../supabase/migrations/', import.meta.url);
const migrations = readdirSync(directory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, directory), 'utf8'))
  .join('\n');

describe('legal versions', () => {
  it('match private.current_legal_versions() in the latest migration that defines it', () => {
    const definitions = [
      ...migrations.matchAll(/create (or replace )?function private\.current_legal_versions\(\)/g),
    ];
    const last = definitions.at(-1);
    expect(last?.index).toBeGreaterThan(-1);
    const body = migrations.slice(last?.index ?? 0);
    const match = /select '([^']+)'::text, '([^']+)'::text;/.exec(body);
    expect(match?.slice(1)).toEqual([TERMS_VERSION, PRIVACY_VERSION]);
  });
});
