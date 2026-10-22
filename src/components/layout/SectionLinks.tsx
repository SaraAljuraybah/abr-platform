import { useTranslation } from 'react-i18next';
import { LANDING_SECTIONS } from '@/features/landing/sections';
import { cn } from '@/lib/utils';

/** In-page anchors to the landing sections. Only rendered on "/" (native anchors + scroll-margin). */
export function SectionLinks({
  className,
  linkClassName,
}: {
  className?: string;
  linkClassName?: string;
}) {
  const { t } = useTranslation();
  return (
    <ul className={className}>
      {LANDING_SECTIONS.map((section) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className={cn(
              'inline-flex rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground',
              linkClassName,
            )}
          >
            {t(section.labelKey)}
          </a>
        </li>
      ))}
    </ul>
  );
}
