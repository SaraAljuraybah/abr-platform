// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import {
  ACADEMIC_YEARS,
  DESCRIPTION_MIN,
  missingForSubmit,
  NEEDS,
  REQUIRED_FOR_SUBMIT,
  PROJECT_FILES,
  PROJECT_LIMITS,
  PROJECT_STATUSES,
  SECTORS,
  SPECIALIZATIONS,
  STAGES,
  TECH_SPECIALIZATIONS,
  TRACKS,
  URL_PATTERNS,
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

  it('stages, wanted specializations and needs (SCRUM-27)', () => {
    expect(checkValues('projects_stage_values')).toEqual([...STAGES]);
    expect(checkValues('projects_wanted_specializations_values')).toEqual([...SPECIALIZATIONS]);
    expect(checkValues('projects_needs_values')).toEqual([...NEEDS]);
  });

  it('team, list and URL limits (SCRUM-27)', () => {
    const L = PROJECT_LIMITS;
    expect(migrations).toContain(
      `team_size between ${String(L.teamSize.min)} and ${String(L.teamSize.max)}`,
    );
    expect(migrations).toContain(
      `cardinality(wanted_specializations) <= ${String(L.wantedSpecializations.max)}`,
    );
    expect(migrations).toContain(`cardinality(needs) <= ${String(L.needs.max)}`);
    for (const column of ['video_url', 'repo_url', 'demo_url']) {
      expect(migrations).toContain(`char_length(${column}) <= ${String(L.url.max)}`);
    }
  });

  it('the URL patterns are the CHECKs on video_url, repo_url and demo_url', () => {
    const sql = (pattern: RegExp) =>
      pattern.source.replaceAll('\\/', '/').replaceAll('[^\\s]', '[^[:space:]]');
    expect(migrations).toContain(`video_url ~ '${sql(URL_PATTERNS.videoUrl)}'`);
    expect(migrations).toContain(`repo_url ~ '${sql(URL_PATTERNS.repoUrl)}'`);
    expect(migrations).toContain(`demo_url ~ '${sql(URL_PATTERNS.demoUrl)}'`);
  });

  it('bucket limits and types are the ones the migration creates', () => {
    const { image, document } = PROJECT_FILES;
    expect(migrations).toContain(
      `('${image.bucket}', '${image.bucket}', false, ${String(image.maxBytes)},\n   array[${image.types.map((type) => `'${type}'`).join(', ')}])`,
    );
    expect(migrations).toContain(
      `('${document.bucket}', '${document.bucket}', false, ${String(document.maxBytes)}, array['${document.types[0]}'])`,
    );
  });
});

describe('the submit rule matches submit_project() (page 8)', () => {
  it('the required fields, in the order the error lists them', () => {
    const body = migrations.slice(migrations.lastIndexOf('create function public.submit_project'));
    const appended = [...body.matchAll(/array_append\(v_missing, '([a-z_]+)'\)/g)].map((m) => m[1]);
    expect(appended).toEqual([...REQUIRED_FOR_SUBMIT]);
    expect(body).toContain(
      `char_length(pg_catalog.btrim(coalesce(v_project.description, ''))) < ${String(DESCRIPTION_MIN)}`,
    );
  });

  const complete = {
    title: 'Campus Navigator',
    summary: 'Indoor maps.',
    description: 'x'.repeat(DESCRIPTION_MIN),
    track: 'mobile',
    academicYear: '2026',
    stage: 'mvp',
  };

  it('a complete project misses nothing; each gap is named', () => {
    expect(missingForSubmit(complete)).toEqual([]);
    expect(missingForSubmit({ ...complete, summary: '  ' })).toEqual(['summary']);
    expect(missingForSubmit({ ...complete, description: 'x'.repeat(DESCRIPTION_MIN - 1) })).toEqual(
      ['description'],
    );
    expect(missingForSubmit({ ...complete, description: ` ${'x'.repeat(99)} ` })).toEqual([
      'description',
    ]);
    expect(
      missingForSubmit({ ...complete, summary: '', track: '', academicYear: '', stage: '' }),
    ).toEqual(['summary', 'track', 'academic_year', 'stage']);
  });
});

describe('URL patterns', () => {
  it.each([
    ['videoUrl', 'https://www.youtube.com/watch?v=abc', true],
    ['videoUrl', 'https://youtu.be/abc', true],
    ['videoUrl', 'https://vimeo.com/123', true],
    ['videoUrl', 'https://www.loom.com/share/abc', true],
    ['videoUrl', 'http://youtube.com/watch?v=abc', false],
    ['videoUrl', 'https://youtube.com.evil.example/x', false],
    ['videoUrl', 'https://youtube.com', false],
    ['repoUrl', 'https://github.com/team/project', true],
    ['repoUrl', 'https://gitlab.com/team/project', true],
    ['repoUrl', 'https://bitbucket.org/team/project', false],
    ['demoUrl', 'https://demo.example.com', true],
    ['demoUrl', 'https://demo.example.com/app?x=1', true],
    ['demoUrl', 'http://demo.example.com', false],
    ['demoUrl', 'javascript:alert(1)', false],
  ] as const)('%s %s → %s', (field, url, valid) => {
    expect(URL_PATTERNS[field].test(url)).toBe(valid);
  });
});

describe('project labels exist in both languages', () => {
  it.each([
    ['en', en],
    ['ar', ar],
  ] as const)('%s: every track and status has a label', (_language, copy) => {
    expect(Object.keys(copy.projects.options.track)).toEqual([...TRACKS]);
    expect(Object.keys(copy.projectStatus)).toEqual([...PROJECT_STATUSES]);
    expect(Object.keys(copy.projects.options.stage)).toEqual([...STAGES]);
    expect(Object.keys(copy.projects.options.need)).toEqual([...NEEDS]);
    // Tech specializations use the field-of-study names; the rest have their own.
    expect(Object.keys(copy.projects.options.specialization)).toEqual(
      SPECIALIZATIONS.filter((code) => !(TECH_SPECIALIZATIONS as readonly string[]).includes(code)),
    );
  });
});
