import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { linkClass } from '../styles';

export const PRIVACY_URL = 'https://tryabr.com/privacy';

/** The privacy notice link used in consent lines (<privacyLink> in the copy). New tab. */
export function PrivacyLink({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <a
      href={PRIVACY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 ${linkClass}`}
    >
      {children}
      <span className="sr-only">{t('forms.common.opensInNewTab')}</span>
      <ExternalLink aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
    </a>
  );
}
