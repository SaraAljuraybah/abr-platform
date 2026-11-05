import { OTHER } from '@shared/interest-options';
import { z } from '@/lib/zod-i18n';
import {
  ACADEMIC_LEVELS,
  FIELD_OF_STUDY,
  GITHUB_URL_PATTERN,
  GRADUATION_YEARS,
  INTERESTS,
  normalizeGithubUrl,
  ONBOARDING_LIMITS,
  type OnboardingStep,
} from './options';

/**
 * One form state for all four steps, so Back never loses anything. Selects hold '' until chosen.
 * Each step validates only its own fields (stepSchemas). Messages are i18n keys (zod-i18n).
 */
export interface OnboardingValues {
  fullName: string;
  bio: string;
  major: string;
  majorOther: string;
  academicLevel: string;
  graduationYear: string;
  skills: string[];
  interests: string[];
  githubUrl: string;
}

const L = ONBOARDING_LIMITS;

const about = z.object({
  fullName: z.string().trim().min(L.fullName.min).max(L.fullName.max),
  bio: z.string().trim().max(L.bio.max),
});

const studies = z
  .object({
    major: z.enum(FIELD_OF_STUDY),
    majorOther: z.string(),
    academicLevel: z.enum(ACADEMIC_LEVELS),
    graduationYear: z.enum(GRADUATION_YEARS),
  })
  .superRefine((values, ctx) => {
    if (values.major !== OTHER) return;
    const length = values.majorOther.trim().length;
    const { min, max } = L.majorOther;
    const message =
      length === 0
        ? 'validation.required'
        : length < min
          ? `validation.tooShort:${String(min)}`
          : length > max
            ? `validation.tooLong:${String(max)}`
            : null;
    if (message) ctx.addIssue({ code: 'custom', path: ['majorOther'], message });
  });

const skills = z.object({
  skills: z.array(z.string().trim().min(1).max(L.skills.chipMax)).max(L.skills.max),
  interests: z.array(z.enum(INTERESTS)).max(L.interests.max),
});

const links = z.object({
  githubUrl: z
    .string()
    .transform(normalizeGithubUrl)
    .refine((value) => value === '' || GITHUB_URL_PATTERN.test(value), {
      message: 'validation.githubUrl',
    }),
});

export const stepSchemas = { about, studies, skills, links } satisfies Record<
  OnboardingStep,
  z.ZodType
>;

export const emptyOnboarding: OnboardingValues = {
  fullName: '',
  bio: '',
  major: '',
  majorOther: '',
  academicLevel: '',
  graduationYear: '',
  skills: [],
  interests: [],
  githubUrl: '',
};
