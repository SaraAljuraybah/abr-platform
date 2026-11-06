import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { linkClass } from '@/features/forms/styles';

/**
 * A legal page linked from a form's consent box (<termsLink>, <privacyLink> in the copy). It opens
 * in a new tab so the form is not lost, and says so to screen readers.
 */
export function LegalLink({ to, children }: { to: '/terms' | '/privacy'; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <a
      href={to}
      target="_blank"
      rel="noopener noreferrer"
      className={`${linkClass} inline-flex items-center gap-1`}
    >
      {children}
      <ExternalLink aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
      {/* A separate space: one inside the hidden span is dropped from the name. */}{' '}
      <span className="sr-only">{t('legal.opensInNewTab')}</span>
    </a>
  );
}
