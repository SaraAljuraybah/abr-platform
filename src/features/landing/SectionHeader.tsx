import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type SectionKey = 'how' | 'who' | 'trust' | 'faq';

/**
 * Eyebrow (functional pink #BE185D, at least 5.28:1 on every section background), the h2 that
 * labels the section, and a one-line intro (text-secondary, at least 5.17:1).
 */
export function SectionHeader({
  section,
  titleId,
  className,
}: {
  section: SectionKey;
  titleId: string;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn('max-w-3xl', className)}>
      <p className="text-sm font-semibold text-pink-text">{t(`landing.${section}.eyebrow`)}</p>
      <h2 id={titleId} className="mt-2 text-brand">
        {t(`landing.${section}.title`)}
      </h2>
      <p className="mt-3 max-w-[60ch] text-lg text-muted-foreground">
        {t(`landing.${section}.intro`)}
      </p>
    </div>
  );
}
