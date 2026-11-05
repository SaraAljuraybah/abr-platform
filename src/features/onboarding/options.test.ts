// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ACADEMIC_LEVELS,
  GITHUB_URL_PATTERN,
  INTERESTS,
  normalizeGithubUrl,
  ONBOARDING_LIMITS,
} from './options';

// Every migration in apply order: a later migration replaces a CHECK, so the last one wins.
const directory = new URL('../../../supabase/migrations/', import.meta.url);
const migrations = readdirSync(directory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, directory), 'utf8'))
  .join('\n');

function balanced(text: string, start: number): string {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    if (text[i] === ')') depth -= 1;
    if (depth === 0) return text.slice(start + 1, i);
  }
  throw new Error('unbalanced parentheses');
}

function checkValues(constraint: string): string[] {
  const marker = `constraint ${constraint} check `;
  const at = migrations.lastIndexOf(marker);
  if (at === -1) throw new Error(`no CHECK constraint ${constraint}`);
  return [...balanced(migrations, at + marker.length).matchAll(/'([^']*)'/g)].map(
    (m) => m[1] ?? '',
  );
}

describe('onboarding option lists and limits match the database', () => {
  it('academic levels', () => {
    expect(checkValues('student_profiles_academic_level_values')).toEqual([...ACADEMIC_LEVELS]);
  });

  it('interests', () => {
    expect(checkValues('student_profiles_interests_values')).toEqual([...INTERESTS]);
  });

  it('length and count limits', () => {
    const L = ONBOARDING_LIMITS;
    expect(migrations).toContain(
      `char_length(full_name) between ${String(L.fullName.min)} and ${String(L.fullName.max)}`,
    );
    expect(migrations).toContain(`char_length(bio) <= ${String(L.bio.max)}`);
    expect(migrations).toContain(`cardinality(skills) <= ${String(L.skills.max)}`);
    expect(migrations).toContain(`cardinality(interests) <= ${String(L.interests.max)}`);
    expect(migrations).toContain(`[^\\x1f]{1,${String(L.skills.chipMax)}}`);
  });

  it('the GitHub pattern is the github_url CHECK', () => {
    const source = GITHUB_URL_PATTERN.source.replaceAll('\\/', '/');
    expect(migrations).toContain(`github_url ~ '${source}'`);
  });
});

describe('GitHub URL', () => {
  it.each([
    ['https://github.com/student-a', true],
    ['https://www.github.com/student-a/', true],
    ['https://github.com/a', true],
    ['http://github.com/student-a', false],
    ['https://github.com/student-a/repo', false],
    ['https://github.com/-student', false],
    ['https://github.com/stu--dent', false],
    ['https://gitlab.com/student-a', false],
    [`https://github.com/${'a'.repeat(40)}`, false],
  ])('%s → %s', (url, valid) => {
    expect(GITHUB_URL_PATTERN.test(url)).toBe(valid);
  });

  it.each([
    ['github.com/student-a', 'https://github.com/student-a'],
    ['  www.github.com/student-a ', 'https://www.github.com/student-a'],
    ['https://github.com/student-a', 'https://github.com/student-a'],
    ['gitlab.com/student-a', 'gitlab.com/student-a'],
    ['', ''],
  ])('normalizes %j to %j', (raw, normalized) => {
    expect(normalizeGithubUrl(raw)).toBe(normalized);
  });
});
