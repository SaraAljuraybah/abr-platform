import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from './SectionHeader';

const QUESTIONS = ['join', 'university', 'contact', 'messaging'] as const;

/**
 * From lg: two columns, the header column sticky within the section and the accordion beside it.
 * Native <details>/<summary>: keyboard and screen-reader support built in. An open answer sits on
 * Surface (text-secondary 5.17:1); the chevron only animates under motion-safe.
 */
export function Faq() {
  const { t } = useTranslation();

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 py-10 lg:py-16">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12">
        <div data-faq-intro="" className="lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
          <SectionHeader section="faq" titleId="faq-title" />
        </div>
        <div
          data-faq-list=""
          className="divide-y divide-border border-y border-border lg:col-span-7"
        >
          {QUESTIONS.map((key) => (
            <details key={key} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-4 text-lg font-semibold text-brand [&::-webkit-details-marker]:hidden">
                {t(`landing.faq.items.${key}.question`)}
                <ChevronDown
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-5 shrink-0 text-primary group-open:rotate-180 motion-safe:transition-transform"
                />
              </summary>
              <p className="mb-4 rounded-md bg-muted px-4 py-3 text-muted-foreground">
                {t(`landing.faq.items.${key}.answer`)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
