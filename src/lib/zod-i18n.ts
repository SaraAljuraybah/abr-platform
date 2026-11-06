import type { TFunction } from 'i18next';
import { z } from 'zod';
import type en from '@/locales/en.json';

export type ValidationKey = `validation.${keyof typeof en.validation}`;

const VALIDATION_KEYS: readonly ValidationKey[] = [
  'validation.required',
  'validation.email',
  'validation.invalid',
  'validation.tooShort',
  'validation.tooLong',
  'validation.githubUrl',
  'validation.saudiMobile',
  'validation.videoUrl',
  'validation.repoUrl',
  'validation.demoUrl',
];

export function isValidationKey(value: unknown): value is ValidationKey {
  return typeof value === 'string' && (VALIDATION_KEYS as readonly string[]).includes(value);
}

/**
 * The single Zod error map. It returns i18n KEYS, not text: fields translate the key when they
 * render (see validationMessage), so messages follow a language switch without re-validating.
 * Length limits travel with the key as "validation.tooShort:2".
 * Schemas never set their own message strings, and import z from this module (not 'zod'), which
 * keeps zod off the landing page's critical path while guaranteeing the map is registered.
 */
export const errorMap: z.core.$ZodErrorMap = (issue) => {
  if (issue.code === 'invalid_type' && issue.input === undefined) return 'validation.required';
  // An unanswered select or radio group holds '' (not one of its options).
  if (issue.code === 'invalid_value' && issue.input === '') return 'validation.required';
  if (issue.code === 'too_small' && issue.origin === 'string' && issue.minimum === 1) {
    return 'validation.required';
  }
  if (issue.code === 'too_small' && issue.origin === 'string') {
    return `validation.tooShort:${String(issue.minimum)}`;
  }
  if (issue.code === 'too_big' && issue.origin === 'string') {
    return `validation.tooLong:${String(issue.maximum)}`;
  }
  if (issue.code === 'invalid_format' && issue.format === 'email') return 'validation.email';
  return 'validation.invalid';
};

z.config({ customError: errorMap });

/** Translates a message from errorMap ("validation.tooLong:150" → "Maximum length: 150 …"). */
export function validationMessage(t: TFunction, message: string | undefined): string | undefined {
  const [key, limit] = message?.split(':') ?? [];
  if (!isValidationKey(key)) return undefined;
  if (key === 'validation.tooShort') return t(key, { min: limit });
  if (key === 'validation.tooLong') return t(key, { max: limit });
  return t(key);
}

/** Schemas import z from here, so the error map is registered before any schema is built. */
export { z };
