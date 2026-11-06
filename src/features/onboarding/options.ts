/**
 * Student onboarding option codes and limits (SCRUM-15). Field of study and graduation year come
 * from the interest form's shared list (supabase/functions/_shared/interest-options.ts); the lists
 * here are onboarding-only. options.test.ts compares every list and limit with the CHECK
 * constraints in supabase/migrations/20261105072134_student_onboarding.sql and the earlier
 * role_profiles migration. Labels live in src/locales under onboarding.options.
 */
import { INTEREST_LIMITS, INTEREST_OPTIONS } from '@shared/interest-options';

export const FIELD_OF_STUDY = INTEREST_OPTIONS.field_of_study;
export const GRADUATION_YEARS = INTEREST_OPTIONS.graduation_year;
export const ACADEMIC_LEVELS = [
  'undergraduate',
  'final_year',
  'recent_graduate',
  'postgraduate',
] as const;
export const INTERESTS = [
  'fintech',
  'health_tech',
  'education',
  'smart_cities',
  'ecommerce',
  'sustainability',
  'gaming',
  'other',
] as const;

/** Offered as one-click skills. Technology names, shown and stored as written in both languages. */
export const SKILL_SUGGESTIONS = [
  'React',
  'Python',
  'Machine Learning',
  'Flutter',
  'UI/UX',
  'Cybersecurity',
  'Data Analysis',
  'Cloud',
] as const;

export const ONBOARDING_LIMITS = {
  fullName: { min: 1, max: 120 },
  bio: { max: 1000 },
  majorOther: INTEREST_LIMITS.fieldOfStudyOther,
  skills: { max: 20, chipMax: 40 },
  interests: { max: 20 },
} as const;

/** The CHECK on student_profiles.github_url, as a JavaScript RegExp. */
export const GITHUB_URL_PATTERN =
  /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9](-?[A-Za-z0-9]){0,38}\/?$/;

/** "github.com/name" and "www.github.com/name" get https:// added; anything else is kept as typed. */
export function normalizeGithubUrl(raw: string): string {
  const value = raw.trim();
  return /^(www\.)?github\.com\//i.test(value) ? `https://${value}` : value;
}

/**
 * A Saudi mobile number as stored (E.164, +9665XXXXXXXX), or null. Accepts 05XXXXXXXX or
 * +9665XXXXXXXX, with spaces, dashes or brackets, and Arabic-Indic or Persian digits as typed on
 * an Arabic keyboard. The database only checks E.164; this is the form's rule (SCRUM-38).
 */
export function normalizeSaudiMobile(raw: string): string | null {
  const value = raw
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\s\-()]/g, '');
  const local = /^05(\d{8})$/.exec(value);
  if (local) return `+9665${local[1] ?? ''}`;
  return /^\+9665\d{8}$/.test(value) ? value : null;
}

export const ONBOARDING_STEPS = ['about', 'studies', 'skills', 'links'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
