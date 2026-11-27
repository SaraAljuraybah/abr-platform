import { formatLegalDate } from '@/features/legal/format';
import type { Language } from '@/lib/i18n';

/** A timestamp as a day in the reader's language (Gregorian, Latin digits), e.g. 27 November 2026. */
export function formatDay(iso: string, language: Language): string {
  return formatLegalDate(new Date(iso).toISOString().slice(0, 10), language);
}
