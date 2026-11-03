// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INTEREST_LIMITS, INTEREST_OPTIONS } from './interest-options.ts';

const migration = readFileSync(
  new URL('../../migrations/20261103121006_interest_signups.sql', import.meta.url),
  'utf8',
);

/** The quoted values inside a named CHECK constraint, in order. */
function checkValues(column: string): string[] {
  // Each piece runs from one constraint name to the next.
  const body = migration
    .split('constraint interest_signups_')
    .find((piece) => piece.startsWith(`${column}_values check`));
  if (!body) throw new Error(`no CHECK constraint for ${column}`);
  return [...body.matchAll(/'([^']*)'/g)].map((m) => m[1] ?? '');
}

describe('interest option lists match the database CHECK constraints', () => {
  it.each(Object.keys(INTEREST_OPTIONS) as (keyof typeof INTEREST_OPTIONS)[])('%s', (column) => {
    expect(checkValues(column)).toEqual([...INTEREST_OPTIONS[column]]);
  });

  it('length limits match', () => {
    expect(migration).toContain(
      `char_length(full_name) between ${INTEREST_LIMITS.fullName.min} and ${INTEREST_LIMITS.fullName.max}`,
    );
    expect(migration).toContain(
      `char_length(university_other) between ${INTEREST_LIMITS.universityOther.min} and ${INTEREST_LIMITS.universityOther.max}`,
    );
    expect(migration).toContain(
      `char_length(organization_name) between ${INTEREST_LIMITS.organizationName.min} and ${INTEREST_LIMITS.organizationName.max}`,
    );
    expect(migration).toContain(`char_length(email) <= ${INTEREST_LIMITS.email.max}`);
  });
});
