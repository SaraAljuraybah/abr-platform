import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from './SectionHeader';

const QUESTIONS = ['join', 'university', 'contact', 'messaging'] as const;

/** Native <details>/<summary>: keyboard and screen-reader support built in. */
export function Faq() {
  const { t } = useTranslation();

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 py-10 lg:py-16">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <SectionHeader section="faq" titleId="faq-title" />
        <div className="mt-8 max-w-3xl divide-y divide-border border-y border-border">
          {QUESTIONS.map((key) => (
            <details key={key} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-4 text-lg font-semibold text-brand [&::-webkit-details-marker]:hidden">
                {t(`landing.faq.items.${key}.question`)}
                <ChevronDown
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-5 shrink-0 text-primary transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="pb-4 text-muted-foreground">{t(`landing.faq.items.${key}.answer`)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
