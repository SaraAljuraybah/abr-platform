import { z } from 'zod';
import type en from '@/locales/en.json';

export type ValidationKey = `validation.${keyof typeof en.validation}`;

const VALIDATION_KEYS: readonly ValidationKey[] = [
  'validation.required',
  'validation.email',
  'validation.invalid',
];

export function isValidationKey(value: unknown): value is ValidationKey {
  return typeof value === 'string' && (VALIDATION_KEYS as readonly string[]).includes(value);
}

/**
 * The single Zod error map. It returns i18n KEYS, not text: fields translate the key when they
 * render (see fieldError), so messages follow a language switch without re-validating.
 * Schemas never set their own message strings, and import z from this module (not 'zod'), which
 * keeps zod off the landing page's critical path while guaranteeing the map is registered.
 */
export const errorMap: z.core.$ZodErrorMap = (issue) => {
  if (issue.code === 'invalid_type' && issue.input === undefined) return 'validation.required';
  if (issue.code === 'too_small' && issue.origin === 'string' && issue.minimum === 1) {
    return 'validation.required';
  }
  if (issue.code === 'invalid_format' && issue.format === 'email') return 'validation.email';
  return 'validation.invalid';
};

z.config({ customError: errorMap });

/** Schemas import z from here, so the error map is registered before any schema is built. */
export { z };
