import { describe, expect, it } from 'vitest';
import { initials, initialsFromEmail } from './initials';

describe('initials', () => {
  it('first and last word, Arabic too; no name → "?"', () => {
    expect(initials('Sara Al Juraybah')).toBe('SJ');
    expect(initials('سارة الجريبة')).toBe('سا');
    expect(initials('  ')).toBe('?');
  });
});

describe('initialsFromEmail (accounts with no name, such as provisioned admins)', () => {
  it.each([
    ['ops.team@abr.sa', 'OT'],
    ['admin@abr.sa', 'A'],
    ['first_middle-last@abr.sa', 'FL'],
    ['sara+abr@abr.sa', 'SA'],
    ['2admin@abr.sa', 'A'],
    ['42@abr.sa', '4'],
  ])('%s → %s', (email, expected) => {
    expect(initialsFromEmail(email)).toBe(expected);
  });

  it('no email → "?"', () => {
    expect(initialsFromEmail(null)).toBe('?');
    expect(initialsFromEmail('')).toBe('?');
  });
});
