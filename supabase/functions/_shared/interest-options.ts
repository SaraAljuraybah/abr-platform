/**
 * Interest form option values (SCRUM-34): the single source for the frontend, the submit-interest
 * Edge Function and the database CHECK constraints in
 * supabase/migrations/20261103121006_interest_signups.sql (a Vitest test compares them).
 * Values are stable codes; labels live in src/locales under forms.interest.options.
 * Plain TypeScript with no imports, so Deno and Vite can both load it.
 */
export const INTEREST_OPTIONS = {
  role: ['student', 'organization', 'mentor'],
  field_of_study: ['cs_it', 'engineering', 'business', 'health', 'design', 'other'],
  graduation_year: ['2026', '2027', '2028_or_later'],
  project_stage: ['have_project', 'have_idea', 'not_yet'],
  sector: [
    'technology',
    'healthcare',
    'finance',
    'energy',
    'government',
    'education',
    'nonprofit',
    'other',
  ],
  looking_for: ['hire_talent', 'sponsor_projects', 'adopt_commercialize', 'offer_mentoring'],
  org_size: ['1_50', '51_500', '500_plus'],
  expertise: [
    'software_data',
    'engineering',
    'business_entrepreneurship',
    'health',
    'design',
    'other',
  ],
  experience: ['0_3', '4_7', '8_15', '15_plus'],
  region: ['riyadh', 'makkah', 'eastern', 'other'],
  channel: ['x', 'linkedin', 'instagram', 'friend', 'university', 'event', 'other'],
  locale: ['en', 'ar'],
} as const;

export type InterestOptionKey = keyof typeof INTEREST_OPTIONS;
export type InterestOption<K extends InterestOptionKey> = (typeof INTEREST_OPTIONS)[K][number];
export type InterestRole = InterestOption<'role'>;

/** Length limits shared with the CHECK constraints. */
export const INTEREST_LIMITS = {
  fullName: { min: 2, max: 120 },
  email: { max: 254 },
  universityOther: { min: 2, max: 150 },
  organizationName: { min: 2, max: 150 },
} as const;

/** Same pattern as the email CHECK constraint. */
export const INTEREST_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
