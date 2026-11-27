// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EXPERTISE,
  LINKEDIN_PATTERN,
  ORG_SECTORS,
  ORG_SIZES,
  SUPPORT_TYPES,
  WEBSITE_PATTERN,
  withHttps,
} from './partner';

const migration = readFileSync(
  new URL('../../../supabase/migrations/20261127100000_partner_onboarding.sql', import.meta.url),
  'utf8',
);
const contact = readFileSync(
  new URL('../../../supabase/migrations/20261026200718_private_contact.sql', import.meta.url),
  'utf8',
);

/** The quoted codes in the SQL list that follows `marker` (up to the closing bracket). */
function codesAfter(sql: string, marker: string, close: string): string[] {
  const start = sql.indexOf(marker);
  if (start < 0) throw new Error(`marker not found: ${marker}`);
  const end = sql.indexOf(close, start + marker.length);
  return [...sql.slice(start + marker.length, end).matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '');
}

describe('partner option codes match the database CHECKs', () => {
  it('sector', () => {
    expect(codesAfter(migration, 'sector in (', ')')).toEqual([...ORG_SECTORS]);
  });
  it('organization size', () => {
    expect(codesAfter(migration, 'org_size in (', ')')).toEqual([...ORG_SIZES]);
  });
  it('support types', () => {
    expect(codesAfter(migration, 'support_types <@ array[', ']')).toEqual([...SUPPORT_TYPES]);
  });
  it('mentor expertise', () => {
    expect(codesAfter(migration, 'expertise <@ array[', ']')).toEqual([...EXPERTISE]);
  });
  it('the LinkedIn pattern is the contact_details CHECK', () => {
    expect(contact).toContain(
      String.raw`linkedin_url ~ '^https://(www\.)?linkedin\.com/(in|company)/[A-Za-z0-9_%-]{1,100}/?$'`,
    );
    expect(LINKEDIN_PATTERN.source).toBe(
      String.raw`^https:\/\/(www\.)?linkedin\.com\/(in|company)\/[A-Za-z0-9_%-]{1,100}\/?$`,
    );
  });
});

describe('links', () => {
  it.each([
    ['clinic.sa', 'https://clinic.sa'],
    ['  linkedin.com/in/majed ', 'https://linkedin.com/in/majed'],
    ['https://clinic.sa', 'https://clinic.sa'],
    ['', ''],
  ])('withHttps(%j) is %j', (raw, expected) => {
    expect(withHttps(raw)).toBe(expected);
  });

  it('websites must be https with a real host', () => {
    expect(WEBSITE_PATTERN.test('https://clinic.sa/about')).toBe(true);
    expect(WEBSITE_PATTERN.test('http://clinic.sa')).toBe(false);
    expect(WEBSITE_PATTERN.test('https://localhost')).toBe(false);
  });

  it('LinkedIn accepts profiles and company pages only', () => {
    expect(LINKEDIN_PATTERN.test('https://www.linkedin.com/in/majed')).toBe(true);
    expect(LINKEDIN_PATTERN.test('https://linkedin.com/company/clinic-co/')).toBe(true);
    expect(LINKEDIN_PATTERN.test('https://linkedin.com/feed')).toBe(false);
    expect(LINKEDIN_PATTERN.test('https://evil.test/in/majed')).toBe(false);
  });
});
