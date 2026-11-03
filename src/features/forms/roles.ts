/** The roles a public form can ask for. Admin is never one of them. */
export const FORM_ROLES = ['student', 'organization', 'mentor'] as const;
export type FormRole = (typeof FORM_ROLES)[number];

export function isFormRole(value: unknown): value is FormRole {
  return typeof value === 'string' && (FORM_ROLES as readonly string[]).includes(value);
}

/** ?role= from links such as the landing cards. Anything else, including "admin", is student. */
export function roleFromParam(value: string | null): FormRole {
  return isFormRole(value) ? value : 'student';
}
