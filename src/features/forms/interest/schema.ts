import { INTEREST_LIMITS, INTEREST_OPTIONS } from '@shared/interest-options';
import type { InterestSubmission } from '@shared/interest-validate';
import { z } from '@/lib/zod-i18n';
import type { FormRole } from '../roles';

/** Last university option: reveals the free-text "University name" field. */
export const UNIVERSITY_NOT_LISTED = 'not_listed';

/** Flat form state: every role's fields live in one form so switching role keeps what was typed. */
export interface InterestFormValues {
  role: FormRole;
  fullName: string;
  email: string;
  universityId: string;
  universityOther: string;
  fieldOfStudy: string;
  graduationYear: string;
  projectStage: string;
  organizationName: string;
  sector: string;
  lookingFor: string[];
  orgSize: string;
  expertise: string;
  experience: string;
  region: string;
  channel: string;
  consent: boolean;
  /** Spam trap. Not in the schema, so it never reaches the submitted values. */
  website: string;
}

export const interestDefaults = (role: FormRole): InterestFormValues => ({
  role,
  fullName: '',
  email: '',
  universityId: '',
  universityOther: '',
  fieldOfStudy: '',
  graduationYear: '',
  projectStage: '',
  organizationName: '',
  sector: '',
  lookingFor: [],
  orgSize: '',
  expertise: '',
  experience: '',
  region: '',
  channel: '',
  consent: false,
  website: '',
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const { fullName, organizationName, universityOther, email } = INTEREST_LIMITS;

// Same rules as the Edge Function and the CHECK constraints (shared option lists and limits).
const common = z.object({
  fullName: z.string().trim().min(1).min(fullName.min).max(fullName.max),
  email: z.string().trim().min(1).max(email.max).pipe(z.email()),
  region: z.union([z.literal(''), z.enum(INTEREST_OPTIONS.region)]),
  channel: z.enum(INTEREST_OPTIONS.channel),
  consent: z.literal(true),
});

export const interestSchema = z
  .discriminatedUnion('role', [
    common.extend({
      role: z.literal('student'),
      universityId: z.string().min(1),
      universityOther: z.string(),
      fieldOfStudy: z.enum(INTEREST_OPTIONS.field_of_study),
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
    if (values.role !== 'student') return;
    if (values.universityId === UNIVERSITY_NOT_LISTED) {
      const length = values.universityOther.trim().length;
      // Messages are i18n keys, as the error map returns (limits travel after the colon).
      const message =
        length === 0
          ? 'validation.required'
          : length < universityOther.min
            ? `validation.tooShort:${String(universityOther.min)}`
            : length > universityOther.max
              ? `validation.tooLong:${String(universityOther.max)}`
              : null;
      if (message) ctx.addIssue({ code: 'custom', path: ['universityOther'], message });
    } else if (!UUID.test(values.universityId)) {
      ctx.addIssue({ code: 'custom', path: ['universityId'], message: 'validation.invalid' });
    }
  });

export type InterestValues = z.infer<typeof interestSchema>;

/** The Edge Function payload: exactly the keys its validator accepts for the role. */
export function toSubmission(
  values: InterestValues,
  locale: 'en' | 'ar',
): InterestSubmission & { website: string } {
  const base = {
    role: values.role,
    full_name: values.fullName.trim(),
    email: values.email.trim(),
    region: values.region === '' ? null : values.region,
    channel: values.channel,
    consent_contact: true as const,
    locale,
    website: '',
    university_id: null,
    university_other: null,
    field_of_study: null,
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
    case 'student': {
      const unlisted = values.universityId === UNIVERSITY_NOT_LISTED;
      return {
        ...base,
        university_id: unlisted ? null : values.universityId,
        university_other: unlisted ? values.universityOther.trim() : null,
        field_of_study: values.fieldOfStudy,
        graduation_year: values.graduationYear,
        project_stage: values.projectStage,
      };
    }
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
      'university_id',
      'university_other',
      'field_of_study',
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
    'region',
    'channel',
    'consent_contact',
    'locale',
  ] as const;
  const payload: Record<string, unknown> = { website: submission.website };
  for (const key of [...common, ...keep[submission.role]]) payload[key] = submission[key];
  return payload;
}
