import { z } from '@/lib/zod-i18n';

/** Sign-in checks presence and email shape only; password rules apply at sign-up. */
export const signInSchema = z.object({
  email: z.string().trim().min(1).pipe(z.email()),
  password: z.string().min(1),
});

export type SignInValues = z.infer<typeof signInSchema>;

/** The only roles the sign-up form can send. Admin is never one of them (app_metadata only). */
export const SIGN_UP_ROLES = ['student', 'organization', 'mentor'] as const;
export type SignUpRole = (typeof SIGN_UP_ROLES)[number];

export function isSignUpRole(value: unknown): value is SignUpRole {
  return typeof value === 'string' && (SIGN_UP_ROLES as readonly string[]).includes(value);
}

/** ?role= from the landing cards. Anything else, including "admin", falls back to student. */
export function roleFromParam(value: string | null): SignUpRole {
  return isSignUpRole(value) ? value : 'student';
}

/** Mirror the database CHECKs: profiles.full_name and organization_profiles.organization_name. */
export const FULL_NAME_MAX = 120;
export const ORGANIZATION_NAME_MIN = 2;
export const ORGANIZATION_NAME_MAX = 150;

/**
 * Mirrors supabase/config.toml: minimum_password_length = 10 and
 * password_requirements = "lower_upper_letters_digits" (ASCII classes, as Supabase Auth checks).
 */
export const PASSWORD_RULES = [
  { key: 'length', test: (value: string) => value.length >= 10 },
  { key: 'case', test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { key: 'digit', test: (value: string) => /[0-9]/.test(value) },
] as const;

export const meetsPasswordRules = (value: string) =>
  PASSWORD_RULES.every(({ test }) => test(value));

const base = z.object({
  fullName: z.string().trim().min(1).max(FULL_NAME_MAX),
  email: z.string().trim().min(1).pipe(z.email()),
  // The checklist shows which rule is missing; the field error only says the rules are not met.
  password: z.string().min(1).refine(meetsPasswordRules),
});

export const signUpSchema = z.discriminatedUnion('role', [
  base.extend({
    role: z.literal('student'),
    universityId: z.string().min(1).pipe(z.uuid()),
  }),
  base.extend({
    role: z.literal('organization'),
    organizationName: z.string().trim().min(ORGANIZATION_NAME_MIN).max(ORGANIZATION_NAME_MAX),
  }),
  base.extend({ role: z.literal('mentor') }),
]);

export type SignUpValues = z.infer<typeof signUpSchema>;

/** Flat form state: every role's fields live in one form so switching role keeps what was typed. */
export interface SignUpFormValues {
  role: SignUpRole;
  fullName: string;
  organizationName: string;
  universityId: string;
  email: string;
  password: string;
  /** Spam trap. Not in signUpSchema, so it is never part of the submitted values. */
  website: string;
}
