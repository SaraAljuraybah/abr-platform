/** "Last updated" in the reader's language, Gregorian with Latin digits in both. */
export function formatLegalDate(iso: string, language: 'en' | 'ar'): string {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** Development builds show the legal pages' open TODOs; production builds never do. */
export function showsTodos(): boolean {
  return import.meta.env.DEV;
}

export const LEGAL_CONTACT_EMAIL = 'try0abr@gmail.com';
