import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type SectionKey = 'how' | 'who' | 'trust' | 'faq';

/**
 * Eyebrow (functional pink #BE185D, at least 5.28:1 on every section background), the h2 that
 * labels the section, and a one-line intro (text-secondary, at least 5.17:1). `center` is used by
 * alternate sections so the page does not repeat the same start-aligned header.
 */
export function SectionHeader({
  section,
  titleId,
  align = 'start',
  className,
}: {
  section: SectionKey;
  titleId: string;
  align?: 'start' | 'center';
  className?: string;
}) {
  const { t } = useTranslation();
  const centered = align === 'center';

  return (
    <div className={cn('max-w-3xl', centered && 'mx-auto text-center', className)}>
      <p className="eyebrow text-pink-text">{t(`landing.${section}.eyebrow`)}</p>
      <h2 id={titleId} className="mt-2 text-brand">
        {t(`landing.${section}.title`)}
      </h2>
      <p className={cn('mt-3 max-w-[60ch] text-lg text-muted-foreground', centered && 'mx-auto')}>
        {t(`landing.${section}.intro`)}
      </p>
    </div>
  );
}
