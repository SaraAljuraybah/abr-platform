/**
 * Interest form option values (SCRUM-34): the single source for the frontend, the submit-interest
 * Edge Function and the database CHECK constraints in
 * supabase/migrations/20261103121006_interest_signups.sql (a Vitest test compares them).
 * Values are stable codes; labels live in src/locales under forms.interest.options.
 * Plain TypeScript with no imports, so Deno and Vite can both load it.
 */
/** University codes for this form, by group (not public.universities, which is for sign-up). */
export const INTEREST_UNIVERSITY_GROUPS = {
  public: ['king_saud', 'imam', 'pnu', 'ksau_hs', 'seu', 'naif'],
  private: ['psu', 'alfaisal', 'yamamah', 'dau', 'reu', 'maarefa', 'aou'],
} as const;

/** The option that reveals a required free-text field. */
export const OTHER = 'other';

export const INTEREST_OPTIONS = {
  role: ['student', 'organization', 'mentor'],
  university_code: [
    ...INTEREST_UNIVERSITY_GROUPS.public,
    ...INTEREST_UNIVERSITY_GROUPS.private,
    'other',
  ],
  field_of_study: ['cs', 'se', 'it', 'is', 'cyber', 'ai', 'data', 'ce', 'other'],
  // Newest first; years are shown as digits, only 2027_or_later has a label.
  graduation_year: [
    '2027_or_later',
    '2026',
    '2025',
    '2024',
    '2023',
    '2022',
    '2021',
    '2020',
    '2019',
    '2018',
    '2017',
    '2016',
    '2015',
    '2014',
    '2013',
    '2012',
    '2011',
    '2010',
    '2009',
    '2008',
    '2007',
    '2006',
    '2005',
    '2004',
    '2003',
    '2002',
    '2001',
    '2000',
  ],
  project_stage: ['not_started', 'idea', 'in_progress', 'finished', 'business'],
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
  heard_from: ['x', 'linkedin', 'instagram', 'friend', 'university', 'event', 'other'],
  locale: ['en', 'ar'],
} as const;

export type InterestOptionKey = keyof typeof INTEREST_OPTIONS;
export type InterestOption<K extends InterestOptionKey> = (typeof INTEREST_OPTIONS)[K][number];
export type InterestRole = InterestOption<'role'>;

/**
 * Version of the consent text the form shows (forms.interest.consent in src/locales). Change it
 * whenever that text changes: the function accepts only this version and stores it with the
 * consent, so every row says which text the person agreed to.
 */
export const INTEREST_CONSENT_VERSION = '2026-11-v2';

/** Length limits shared with the CHECK constraints. */
export const INTEREST_LIMITS = {
  fullName: { min: 2, max: 120 },
  email: { max: 254 },
  universityOther: { min: 2, max: 150 },
  fieldOfStudyOther: { min: 2, max: 100 },
  heardFromOther: { min: 2, max: 100 },
  organizationName: { min: 2, max: 150 },
} as const;

/** Same pattern as the email CHECK constraint. */
export const INTEREST_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
