/** "Sara Al Juraybah" → "SJ"; one word → its first letter; no name → "?". Works for Arabic too. */
export function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return '?';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return [first, last]
    .filter((word): word is string => word !== undefined)
    .map((word) => Array.from(word)[0]?.toLocaleUpperCase() ?? '')
    .join('');
}

/**
 * From an email's local part, for an account with no name yet: "ops.team@abr.sa" → "OT",
 * "admin@abr.sa" → "A". Dots, underscores, hyphens and plus signs separate the words; digits are
 * skipped when a letter follows. No email → "?".
 */
export function initialsFromEmail(email: string | null | undefined): string {
  const local = (email ?? '').split('@')[0] ?? '';
  const words = local
    .split(/[._+-]+/)
    .map((word) => word.replace(/^[^\p{L}]+(?=\p{L})/u, ''))
    .filter(Boolean);
  return initials(words.join(' '));
}
