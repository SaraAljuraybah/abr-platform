/**
 * The privacy notice's "Last updated" date (ISO, YYYY-MM-DD). The single source for the page:
 * set it to the launch date, and change it whenever the notice text changes.
 */
export const PRIVACY_LAST_UPDATED = '2026-11-04';

/** Development builds show the notice's open TODOs; production builds never do. */
export function showsTodos(): boolean {
  return import.meta.env.DEV;
}
