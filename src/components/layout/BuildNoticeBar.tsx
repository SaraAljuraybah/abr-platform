import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Slim bar above the header on every route. Not sticky: it scrolls away and the header then
 * sticks at the top. A labelled <aside> so its text sits inside a landmark (axe "region").
 */
export function BuildNoticeBar() {
  const { t } = useTranslation();

  return (
    <aside aria-label={t('app.buildStatus')} className="bg-info-bg text-info">
      <p className="mx-auto flex min-h-8 max-w-[1200px] items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-medium sm:px-6">
        <Info aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
        {t('landing.buildNotice')}
      </p>
    </aside>
  );
}
