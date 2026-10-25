import { Check, CircleCheck, Lock, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthActions } from '@/components/AuthActions';
import { cn } from '@/lib/utils';

/**
 * The page's top gradient moment (Deep, softened pink, mirrored in RTL so text sits on the dark
 * end), as an inset panel: the page background shows around it. The final band matches it.
 */
export function Hero() {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="hero-title"
      className="inset-panel mt-4 bg-hero-gradient text-white sm:mt-6 lg:mt-8"
    >
      <div className="container-page grid gap-12 py-12 lg:grid-cols-12 lg:items-center lg:gap-16 lg:py-18">
        <div className="lg:col-span-7">
          <p className="eyebrow text-light-pink">{t('landing.hero.eyebrow')}</p>
          <h1 id="hero-title" className="mt-3 max-w-3xl text-hero-title">
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

const AVATARS = [
  { key: 'first', className: 'bg-light-pink text-brand' },
  { key: 'second', className: 'bg-muted text-brand' },
  { key: 'third', className: 'bg-brand-accent text-white' },
] as const;

/**
 * Decorative illustration: a reviewed project card with an "accepted" toast tucked over its
 * bottom edge at the end side (mirrors in RTL). Hidden from assistive tech and not focusable.
 * The bottom padding leaves room for the half of the toast that hangs below the card.
 */
function ExampleProjectCard() {
  const { t } = useTranslation();

  return (
    <div aria-hidden="true" inert className="mx-auto max-w-md pb-6 lg:max-w-none">
      <div className="relative rounded-xl bg-card p-6 text-foreground shadow-lg">
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
        <p className="mt-2 text-sm text-muted-foreground">{t('landing.hero.card.summary')}</p>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex -space-x-2">
            {AVATARS.map(({ key, className }) => (
              <span
                key={key}
                className={cn(
                  'flex size-8 items-center justify-center rounded-full text-xs font-bold ring-2 ring-card',
                  className,
                )}
              >
                {t(`landing.hero.card.initials.${key}`)}
              </span>
            ))}
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" strokeWidth={1.75} />
            {t('landing.hero.card.team')}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
            {t('landing.hero.card.request')}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" strokeWidth={1.75} />
            {t('landing.hero.card.lockNote')}
          </span>
        </div>

        {/* Toast: half over the card's bottom edge, aligned to its end side. */}
        <div className="absolute end-4 bottom-0 flex max-w-[85%] translate-y-1/2 items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm font-medium text-foreground shadow-lg ring-1 ring-border">
          <CircleCheck className="size-5 shrink-0 text-success" strokeWidth={2} />
          {t('landing.hero.card.toast')}
        </div>
      </div>
    </div>
  );
}
