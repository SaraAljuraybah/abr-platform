import { afterAll, describe, expect, it } from 'vitest';
import i18n, { changeLanguage } from '@/lib/i18n';
import { validationMessage, z } from '@/lib/zod-i18n';

const name = z.string().min(2).max(5);

function messageFor(input: string) {
  return name.safeParse(input).error?.issues[0]?.message;
}

describe('validation messages carry the limit from the Zod issue', () => {
  afterAll(async () => {
    await changeLanguage('en');
  });

  it('encodes the limit with the key', () => {
    expect(messageFor('A')).toBe('validation.tooShort:2');
    expect(messageFor('ABCDEF')).toBe('validation.tooLong:5');
  });

  it.each([
    ['en', 'Minimum length: 2 characters.', 'Maximum length: 5 characters.'],
    ['ar', 'الحد الأدنى للأحرف: 2', 'الحد الأقصى للأحرف: 5'],
  ] as const)('translates the limits in %s', async (language, tooShort, tooLong) => {
    await changeLanguage(language);
    expect(validationMessage(i18n.t, messageFor('A'))).toBe(tooShort);
    expect(validationMessage(i18n.t, messageFor('ABCDEF'))).toBe(tooLong);
  });

  it('ignores anything that is not a validation key', () => {
    expect(validationMessage(i18n.t, 'Some raw text')).toBeUndefined();
    expect(validationMessage(i18n.t, undefined)).toBeUndefined();
  });
});
