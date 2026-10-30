import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/** Internal-build notice, shown on every route until launch. */
export function BuildNotice({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 rounded-md bg-info-bg px-3 py-2 text-sm text-info',
        className,
      )}
    >
      <Info aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
      {t('landing.buildNotice')}
    </p>
  );
}
