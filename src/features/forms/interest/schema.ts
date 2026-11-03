import {
  INTEREST_CONSENT_VERSION,
  INTEREST_LIMITS,
  INTEREST_OPTIONS,
  OTHER,
} from '@shared/interest-options';
import type { InterestSubmission } from '@shared/interest-validate';
import { z } from '@/lib/zod-i18n';
import type { FormRole } from '../roles';

/** Flat form state: every role's fields live in one form so switching role keeps what was typed. */
export interface InterestFormValues {
  role: FormRole;
  fullName: string;
  email: string;
  universityCode: string;
  universityOther: string;
  fieldOfStudy: string;
  fieldOfStudyOther: string;
  graduationYear: string;
  projectStage: string;
  organizationName: string;
  sector: string;
  lookingFor: string[];
  orgSize: string;
  expertise: string;
  experience: string;
  heardFrom: string;
  heardFromOther: string;
  consent: boolean;
  /** Spam trap. Not in the schema, so it never reaches the submitted values. */
  website: string;
}

export const interestDefaults = (role: FormRole): InterestFormValues => ({
  role,
  fullName: '',
  email: '',
  universityCode: '',
  universityOther: '',
  fieldOfStudy: '',
  fieldOfStudyOther: '',
  graduationYear: '',
  projectStage: '',
  organizationName: '',
  sector: '',
  lookingFor: [],
  orgSize: '',
  expertise: '',
  experience: '',
  heardFrom: '',
  heardFromOther: '',
  consent: false,
  website: '',
});

const { fullName, organizationName, email } = INTEREST_LIMITS;

// Same rules as the Edge Function and the CHECK constraints (shared option lists and limits).
const common = z.object({
  fullName: z.string().trim().min(1).min(fullName.min).max(fullName.max),
  email: z.string().trim().min(1).max(email.max).pipe(z.email()),
  heardFrom: z.enum(INTEREST_OPTIONS.heard_from),
  heardFromOther: z.string(),
  consent: z.literal(true),
});

export const interestSchema = z
  .discriminatedUnion('role', [
    common.extend({
      role: z.literal('student'),
      universityCode: z.enum(INTEREST_OPTIONS.university_code),
      universityOther: z.string(),
      fieldOfStudy: z.enum(INTEREST_OPTIONS.field_of_study),
      fieldOfStudyOther: z.string(),
      graduationYear: z.enum(INTEREST_OPTIONS.graduation_year),
      projectStage: z.enum(INTEREST_OPTIONS.project_stage),
    }),
    common.extend({
      role: z.literal('organization'),
      organizationName: z
        .string()
        .trim()
        .min(1)
        .min(organizationName.min)
        .max(organizationName.max),
      sector: z.enum(INTEREST_OPTIONS.sector),
      lookingFor: z.array(z.enum(INTEREST_OPTIONS.looking_for)).min(1),
      orgSize: z.enum(INTEREST_OPTIONS.org_size),
    }),
    common.extend({
      role: z.literal('mentor'),
      expertise: z.enum(INTEREST_OPTIONS.expertise),
      experience: z.enum(INTEREST_OPTIONS.experience),
    }),
  ])
  .superRefine((values, ctx) => {
    // "Other" requires its text. Messages are i18n keys, as the error map returns (limits travel
    // after the colon).
    const requireText = (
      path: 'universityOther' | 'fieldOfStudyOther' | 'heardFromOther',
      value: string,
      { min, max }: { min: number; max: number },
    ) => {
      const length = value.trim().length;
      const message =
        length === 0
          ? 'validation.required'
          : length < min
            ? `validation.tooShort:${String(min)}`
            : length > max
              ? `validation.tooLong:${String(max)}`
              : null;
      if (message) ctx.addIssue({ code: 'custom', path: [path], message });
    };
    if (values.heardFrom === OTHER) {
      requireText('heardFromOther', values.heardFromOther, INTEREST_LIMITS.heardFromOther);
    }
    if (values.role !== 'student') return;
    if (values.universityCode === OTHER) {
      requireText('universityOther', values.universityOther, INTEREST_LIMITS.universityOther);
    }
    if (values.fieldOfStudy === OTHER) {
      requireText('fieldOfStudyOther', values.fieldOfStudyOther, INTEREST_LIMITS.fieldOfStudyOther);
    }
  });

export type InterestValues = z.infer<typeof interestSchema>;

/** The text that goes with "Other", or null (the function refuses text without "Other"). */
const otherText = (choice: string, text: string) => (choice === OTHER ? text.trim() : null);

/** The Edge Function payload: exactly the keys its validator accepts for the role. */
export function toSubmission(
  values: InterestValues,
  locale: 'en' | 'ar',
): InterestSubmission & { website: string } {
  const base = {
    role: values.role,
    full_name: values.fullName.trim(),
    email: values.email.trim(),
    heard_from: values.heardFrom,
    heard_from_other: otherText(values.heardFrom, values.heardFromOther),
    consent_contact: true as const,
    // The version of the consent text shown in this bundle (forms.interest.consent).
    consent_version: INTEREST_CONSENT_VERSION,
    locale,
    website: '',
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
  };
  switch (values.role) {
    case 'student':
      return {
        ...base,
        university_code: values.universityCode,
        university_other: otherText(values.universityCode, values.universityOther),
        field_of_study: values.fieldOfStudy,
        field_of_study_other: otherText(values.fieldOfStudy, values.fieldOfStudyOther),
        graduation_year: values.graduationYear,
        project_stage: values.projectStage,
      };
    case 'organization':
      return {
        ...base,
        organization_name: values.organizationName.trim(),
        sector: values.sector,
        looking_for: values.lookingFor,
        org_size: values.orgSize,
      };
    case 'mentor':
      return { ...base, expertise: values.expertise, experience: values.experience };
  }
}

/** Only the keys that belong to the role; the function refuses any other key. */
export function payloadFor(submission: InterestSubmission & { website: string }) {
  const keep: Record<FormRole, readonly (keyof InterestSubmission)[]> = {
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
  const common = [
    'role',
    'full_name',
    'email',
    'heard_from',
    'heard_from_other',
    'consent_contact',
    'consent_version',
    'locale',
  ] as const;
  const payload: Record<string, unknown> = { website: submission.website };
  for (const key of [...common, ...keep[submission.role]]) payload[key] = submission[key];
  return payload;
}
