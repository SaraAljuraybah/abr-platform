import { Check, CircleCheck, Lock, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthActions } from '@/components/AuthActions';
import { cn } from '@/lib/utils';

/** The page's top gradient moment (Deep, softened pink, mirrored in RTL so text sits on the dark end). */
export function Hero() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="hero-title" className="overflow-hidden bg-hero-gradient text-white">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-16 lg:py-18">
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

const AVATARS = [
  { key: 'first', className: 'bg-light-pink text-brand' },
  { key: 'second', className: 'bg-muted text-brand' },
  { key: 'third', className: 'bg-brand-accent text-white' },
] as const;

/**
 * Decorative illustration: a reviewed project card, a second card peeking behind it and an
 * "accepted" toast. Hidden from assistive tech and not focusable. Offsets and rotation mirror in RTL.
 */
function ExampleProjectCard() {
  const { t } = useTranslation();

  return (
    <div aria-hidden="true" inert className="relative mx-auto max-w-md pb-8 lg:max-w-none">
      {/* Second card peeking behind (offset toward the end side, slightly rotated). */}
      <div className="absolute inset-x-0 top-0 bottom-8 translate-x-4 -translate-y-3 rotate-3 rounded-xl bg-white/25 rtl:-translate-x-4 rtl:-rotate-3" />

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
      </div>

      {/* Toast overlapping the card's bottom end corner. */}
      <div className="absolute -end-2 bottom-0 flex max-w-[85%] items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm font-medium text-foreground shadow-lg sm:-end-6">
        <CircleCheck className="size-5 shrink-0 text-success" strokeWidth={2} />
        {t('landing.hero.card.toast')}
      </div>
    </div>
  );
}
