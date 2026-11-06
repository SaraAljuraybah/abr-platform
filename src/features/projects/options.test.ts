// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { ACADEMIC_YEARS, PROJECT_LIMITS, PROJECT_STATUSES, SECTORS, TRACKS } from './options';

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

describe('project option lists and limits match the database', () => {
  it('tracks', () => {
    expect(checkValues('projects_track_values')).toEqual([...TRACKS]);
  });

  it('sectors are the onboarding interest codes', () => {
    expect(checkValues('projects_sectors_values')).toEqual([...SECTORS]);
  });

  it('academic years are the graduation-year codes', () => {
    expect(checkValues('projects_academic_year_values')).toEqual([...ACADEMIC_YEARS]);
  });

  it('length and count limits', () => {
    const L = PROJECT_LIMITS;
    const title = `${String(L.title.min)} and ${String(L.title.max)}`;
    expect(migrations).toContain(`char_length(title) between ${title}`);
    expect(migrations).toContain(`char_length(v_title) not between ${title}`);
    expect(migrations).toContain(`char_length(summary) <= ${String(L.summary.max)}`);
    expect(migrations).toContain(`char_length(description) <= ${String(L.description.max)}`);
    expect(migrations).toContain(`cardinality(sectors) <= ${String(L.sectors.max)}`);
  });
});

describe('project labels exist in both languages', () => {
  it.each([
    ['en', en],
    ['ar', ar],
  ] as const)('%s: every track and status has a label', (_language, copy) => {
    expect(Object.keys(copy.projects.options.track)).toEqual([...TRACKS]);
    expect(Object.keys(copy.projectStatus)).toEqual([...PROJECT_STATUSES]);
  });
});
