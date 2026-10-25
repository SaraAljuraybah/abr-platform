import { useTranslation } from 'react-i18next';
import { AuthActions } from '@/components/AuthActions';

/** Flat Surface band (#F3EDFF via bg-muted), not a second gradient. Primary stays #7C3AED. */
export function FinalCta() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="cta-title" className="pb-10 lg:pb-16">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="flex flex-col gap-6 rounded-xl bg-muted px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
          <h2 id="cta-title" className="max-w-2xl text-brand">
            {t('landing.cta.title')}
          </h2>
          <AuthActions placement="band" className="shrink-0" />
        </div>
      </div>
    </section>
  );
}
