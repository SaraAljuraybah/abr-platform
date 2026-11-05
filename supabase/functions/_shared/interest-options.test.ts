// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  INTEREST_LIMITS,
  INTEREST_OPTIONS,
  INTEREST_UNIVERSITY_GROUPS,
} from './interest-options.ts';

// Every migration in apply order: a later migration replaces a CHECK, so the last one wins.
const directory = new URL('../../migrations/', import.meta.url);
const migrations = readdirSync(directory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, directory), 'utf8'))
  .join('\n');

/** The text inside the parentheses that open at `start`. */
function balanced(text: string, start: number): string {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    if (text[i] === ')') depth -= 1;
    if (depth === 0) return text.slice(start + 1, i);
  }
  throw new Error('unbalanced parentheses');
}

/** The quoted values of the latest `<table>_<column>_values` CHECK, in order. */
function checkValues(column: string, table = 'interest_signups'): string[] {
  const marker = `constraint ${table}_${column}_values check `;
  const at = migrations.lastIndexOf(marker);
  if (at === -1) throw new Error(`no CHECK constraint for ${column}`);
  const body = balanced(migrations, at + marker.length);
  return [...body.matchAll(/'([^']*)'/g)].map((m) => m[1] ?? '');
}

describe('interest option lists match the database CHECK constraints', () => {
  it.each(Object.keys(INTEREST_OPTIONS) as (keyof typeof INTEREST_OPTIONS)[])('%s', (column) => {
    expect(checkValues(column)).toEqual([...INTEREST_OPTIONS[column]]);
  });

  // Student onboarding (SCRUM-15) stores the same codes in student_profiles.
  it.each([
    ['major', 'field_of_study'],
    ['graduation_year', 'graduation_year'],
  ] as const)('student_profiles.%s uses the %s list', (column, option) => {
    expect(checkValues(column, 'student_profiles')).toEqual([...INTEREST_OPTIONS[option]]);
  });

  it('universities: public, then private, then other last', () => {
    expect(INTEREST_OPTIONS.university_code).toEqual([
      ...INTEREST_UNIVERSITY_GROUPS.public,
      ...INTEREST_UNIVERSITY_GROUPS.private,
      'other',
    ]);
  });

  it('graduation years: 2027 or later first, then 2026 down to 2000', () => {
    const years = Array.from({ length: 27 }, (_, i) => String(2026 - i));
    expect(INTEREST_OPTIONS.graduation_year).toEqual(['2027_or_later', ...years]);
    expect(years.at(-1)).toBe('2000');
  });

  it('length limits match', () => {
    const limit = (column: string, { min, max }: { min: number; max: number }) =>
      `char_length(${column}) between ${String(min)} and ${String(max)}`;
    expect(migrations).toContain(limit('full_name', INTEREST_LIMITS.fullName));
    expect(migrations).toContain(limit('university_other', INTEREST_LIMITS.universityOther));
    expect(migrations).toContain(limit('field_of_study_other', INTEREST_LIMITS.fieldOfStudyOther));
    expect(migrations).toContain(limit('heard_from_other', INTEREST_LIMITS.heardFromOther));
    expect(migrations).toContain(limit('major_other', INTEREST_LIMITS.fieldOfStudyOther));
    expect(migrations).toContain(limit('organization_name', INTEREST_LIMITS.organizationName));
    expect(migrations).toContain(`char_length(email) <= ${String(INTEREST_LIMITS.email.max)}`);
  });
});
