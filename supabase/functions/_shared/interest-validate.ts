import {
  INTEREST_EMAIL_PATTERN,
  INTEREST_LIMITS,
  INTEREST_OPTIONS,
  OTHER,
  type InterestOption,
  type InterestOptionKey,
  type InterestRole,
} from './interest-options.ts';

/** A validated submission, in the shape public.submit_interest() reads. */
export interface InterestSubmission {
  role: InterestRole;
  full_name: string;
  email: string;
  university_code: InterestOption<'university_code'> | null;
  university_other: string | null;
  field_of_study: InterestOption<'field_of_study'> | null;
  field_of_study_other: string | null;
  graduation_year: InterestOption<'graduation_year'> | null;
  project_stage: InterestOption<'project_stage'> | null;
  organization_name: string | null;
  sector: InterestOption<'sector'> | null;
  looking_for: InterestOption<'looking_for'>[] | null;
  org_size: InterestOption<'org_size'> | null;
  expertise: InterestOption<'expertise'> | null;
  experience: InterestOption<'experience'> | null;
  heard_from: InterestOption<'heard_from'>;
  heard_from_other: string | null;
  consent_contact: true;
  locale: InterestOption<'locale'>;
}

/** Keys each role may send, besides the common ones. Anything else is refused. */
const ROLE_KEYS: Record<InterestRole, readonly string[]> = {
  student: [
    'university_code',
    'university_other',
    'field_of_study',
    'field_of_study_other',
    'graduation_year',
    'project_stage',
  ],
  organization: ['organization_name', 'sector', 'looking_for', 'org_size'],
  mentor: ['expertise', 'experience'],
};
const COMMON_KEYS = [
  'role',
  'full_name',
  'email',
  'heard_from',
  'heard_from_other',
  'consent_contact',
  'locale',
];
/** The spam trap travels in the same body; the handler reads it before validation. */
export const HONEYPOT_KEY = 'website';

class Invalid extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function option<K extends InterestOptionKey>(key: K, value: unknown): InterestOption<K> {
  const list: readonly string[] = INTEREST_OPTIONS[key];
  if (typeof value !== 'string' || !list.includes(value)) throw new Invalid(key);
  return value as InterestOption<K>;
}

function text(key: string, value: unknown, min: number, max: number): string {
  if (typeof value !== 'string') throw new Invalid(key);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw new Invalid(key);
  return trimmed;
}

/** Absent, null and '' all mean "not given" for optional fields. */
const given = (value: unknown) => value !== undefined && value !== null && value !== '';

/** The text that goes with "Other": required with it, refused without it. */
function otherText(
  key: string,
  choice: string,
  value: unknown,
  limits: { min: number; max: number },
): string | null {
  if (choice === OTHER) return text(key, value, limits.min, limits.max);
  if (given(value)) throw new Invalid(key);
  return null;
}

/**
 * Validates an interest submission with the same rules as the database. Returns null when the
 * input is invalid; the caller answers 400 without echoing anything back.
 */
export function validateInterest(input: unknown): InterestSubmission | null {
  try {
    if (!isRecord(input)) throw new Invalid('body');
    const role = option('role', input.role);
    const allowed = new Set([...COMMON_KEYS, ...ROLE_KEYS[role], HONEYPOT_KEY]);
    for (const key of Object.keys(input)) {
      if (!allowed.has(key)) throw new Invalid(key);
    }
    if (input.consent_contact !== true) throw new Invalid('consent_contact');

    const email = text('email', input.email, 3, INTEREST_LIMITS.email.max);
    if (!INTEREST_EMAIL_PATTERN.test(email)) throw new Invalid('email');

    const heardFrom = option('heard_from', input.heard_from);
    const submission: InterestSubmission = {
      role,
      full_name: text(
        'full_name',
        input.full_name,
        INTEREST_LIMITS.fullName.min,
        INTEREST_LIMITS.fullName.max,
      ),
      email,
      university_code: null,
      university_other: null,
      field_of_study: null,
      field_of_study_other: null,
      graduation_year: null,
      project_stage: null,
      organization_name: null,
      sector: null,
      looking_for: null,
      org_size: null,
      expertise: null,
      experience: null,
      heard_from: heardFrom,
      heard_from_other: otherText(
        'heard_from_other',
        heardFrom,
        input.heard_from_other,
        INTEREST_LIMITS.heardFromOther,
      ),
      consent_contact: true,
      locale: option('locale', input.locale),
    };

    if (role === 'student') {
      const university = option('university_code', input.university_code);
      submission.university_code = university;
      submission.university_other = otherText(
        'university_other',
        university,
        input.university_other,
        INTEREST_LIMITS.universityOther,
      );
      const field = option('field_of_study', input.field_of_study);
      submission.field_of_study = field;
      submission.field_of_study_other = otherText(
        'field_of_study_other',
        field,
        input.field_of_study_other,
        INTEREST_LIMITS.fieldOfStudyOther,
      );
      submission.graduation_year = option('graduation_year', input.graduation_year);
      submission.project_stage = option('project_stage', input.project_stage);
    } else if (role === 'organization') {
      submission.organization_name = text(
        'organization_name',
        input.organization_name,
        INTEREST_LIMITS.organizationName.min,
        INTEREST_LIMITS.organizationName.max,
      );
      submission.sector = option('sector', input.sector);
      const items = input.looking_for;
      if (!Array.isArray(items) || items.length === 0 || new Set(items).size !== items.length) {
        throw new Invalid('looking_for');
      }
      submission.looking_for = items.map((item) => option('looking_for', item));
      submission.org_size = option('org_size', input.org_size);
    } else {
      submission.expertise = option('expertise', input.expertise);
      submission.experience = option('experience', input.experience);
    }
    return submission;
  } catch (error) {
    if (error instanceof Invalid) return null;
    throw error;
  }
}
