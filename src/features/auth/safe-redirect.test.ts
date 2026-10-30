import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-redirect';

describe('safeNext (open-redirect protection)', () => {
  it.each([
    null,
    undefined,
    '',
    'app',
    '//evil.com',
    '//evil.com/app',
    'https://evil.com',
    'http://evil.com/app',
    'javascript:alert(1)',
    '/\\evil.com',
    '/\\/evil.com',
    '/\tevil.com',
    '/\n/evil.com',
    ' /app',
  ])('rejects %j and falls back to /app', (raw) => {
    expect(safeNext(raw)).toBe('/app');
  });

  it.each(['/app', '/app/projects?tab=open', '/onboarding#step-2', '/admin'])('keeps %s', (raw) => {
    expect(safeNext(raw)).toBe(raw);
  });
});
