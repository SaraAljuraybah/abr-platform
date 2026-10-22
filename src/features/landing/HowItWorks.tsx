import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STEPS = ['discover', 'request', 'decide', 'connect', 'contact'] as const;

/**
 * Five steps joined by a line: vertical below lg, a row from lg with arrows between steps.
 * Arrows mirror in RTL (rtl:-scale-x-100); step numbers are never transformed.
 */
export function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 py-16 lg:py-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <h2 id="how-title" className="text-brand">
          {t('landing.how.title')}
        </h2>
        <ol className="relative mt-10 grid gap-8 before:absolute before:start-5 before:top-5 before:bottom-5 before:w-0.5 before:-translate-x-1/2 before:bg-border lg:grid-cols-5 lg:gap-6 lg:before:start-5 lg:before:end-[calc((100%-6rem)/5-1.25rem)] lg:before:bottom-auto lg:before:h-0.5 lg:before:w-auto lg:before:translate-x-0 lg:before:-translate-y-1/2 rtl:before:translate-x-1/2 rtl:lg:before:translate-x-0">
          {STEPS.map((step, index) => (
            <li key={step} className="relative flex gap-4 lg:flex-col lg:gap-4">
              <span
                aria-hidden="true"
                className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground ring-4 ring-background"
              >
                {index + 1}
              </span>
              {index < STEPS.length - 1 && (
                <ArrowRight
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="absolute -end-6 top-2 z-10 hidden size-6 bg-background text-primary lg:block rtl:-scale-x-100"
                />
              )}
              <div>
                <h3 className="text-lg font-semibold text-brand">
                  {t(`landing.how.steps.${step}.title`)}
                </h3>
                <p className="mt-1 text-muted-foreground">{t(`landing.how.steps.${step}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
