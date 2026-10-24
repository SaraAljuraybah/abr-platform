import { Check, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthActions } from '@/components/AuthActions';

/** The page's single gradient moment (Deep gradient, mirrored in RTL so text sits on the dark end). */
export function Hero() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="hero-title" className="bg-hero-gradient text-white">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-16 lg:py-24">
        <div className="lg:col-span-7">
          <p className="text-sm font-semibold text-light-pink">{t('landing.hero.eyebrow')}</p>
          <h1 id="hero-title" className="mt-3 max-w-3xl">
            {t('landing.hero.title')}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/90">{t('landing.hero.subtitle')}</p>
          <AuthActions placement="hero" className="mt-8" />
        </div>
        <div className="lg:col-span-5">
          <ExampleProjectCard />
        </div>
      </div>
    </section>
  );
}

/** Decorative illustration of a reviewed project card. Hidden from assistive tech and not focusable. */
function ExampleProjectCard() {
  const { t } = useTranslation();

  return (
    <div aria-hidden="true" inert className="mx-auto max-w-md lg:max-w-none">
      <div className="rounded-xl bg-card p-6 text-foreground shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-sm bg-muted px-2.5 py-1 text-xs font-medium text-brand">
            {t('landing.hero.card.field')}
          </span>
          <span className="inline-flex items-center gap-1 rounded-sm bg-success-bg px-2.5 py-1 text-xs font-semibold text-success">
            <Check className="size-3.5" strokeWidth={2.25} />
            {t('landing.hero.card.reviewed')}
          </span>
        </div>
        <p className="mt-4 text-xl font-bold text-brand">{t('landing.hero.card.title')}</p>
        <div className="mt-4 space-y-2">
          <div className="h-2 w-full rounded-full bg-muted" />
          <div className="h-2 w-5/6 rounded-full bg-muted" />
          <div className="h-2 w-2/3 rounded-full bg-muted" />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
            {t('landing.hero.card.request')}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" strokeWidth={1.75} />
            {t('landing.hero.card.lockNote')}
          </span>
        </div>
      </div>
    </div>
  );
}
