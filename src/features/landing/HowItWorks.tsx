import {
  ArrowRight,
  Link as LinkIcon,
  Lock,
  type LucideIcon,
  Scale,
  Search,
  Send,
  Unlock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from './SectionHeader';

type Consent = 'private' | 'shared' | null;
type StepKey = 'discover' | 'request' | 'decide' | 'connect' | 'contact';

const STEPS: readonly { key: StepKey; icon: LucideIcon; consent: Consent }[] = [
  { key: 'discover', icon: Search, consent: 'private' },
  { key: 'request', icon: Send, consent: 'private' },
  { key: 'decide', icon: Scale, consent: null },
  { key: 'connect', icon: LinkIcon, consent: null },
  { key: 'contact', icon: Unlock, consent: 'shared' },
];

/**
 * Five steps joined by a line: vertical below lg, a row from lg with arrows between steps.
 * Arrows mirror in RTL (rtl:-scale-x-100); step numbers are never transformed. Badges mark the
 * consent moment: contact stays private in steps 1-2 and is shared only at step 5.
 */
export function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="scroll-mt-20 bg-card py-10 lg:py-16"
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <SectionHeader section="how" titleId="how-title" />
        <ol className="relative mt-8 grid gap-8 before:absolute before:start-5 before:top-5 before:bottom-5 before:w-0.5 before:-translate-x-1/2 before:bg-border lg:grid-cols-5 lg:gap-6 lg:before:start-5 lg:before:end-[calc((100%-6rem)/5-1.25rem)] lg:before:bottom-auto lg:before:h-0.5 lg:before:w-auto lg:before:translate-x-0 lg:before:-translate-y-1/2 rtl:before:translate-x-1/2 rtl:lg:before:translate-x-0">
          {STEPS.map(({ key, icon: Icon, consent }, index) => (
            <li key={key} className="relative flex gap-4 lg:flex-col lg:gap-4">
              <span
                aria-hidden="true"
                className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground ring-4 ring-card"
              >
                {index + 1}
              </span>
              {index < STEPS.length - 1 && (
                <ArrowRight
                  aria-hidden="true"
                  data-step-arrow=""
                  strokeWidth={1.75}
                  className="absolute -end-6 top-2 z-10 hidden size-6 bg-card text-primary lg:block rtl:-scale-x-100"
                />
              )}
              <div>
                <h3 className="flex items-center gap-2 text-xl font-semibold text-brand">
                  <Icon
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-5 shrink-0 text-primary"
                  />
                  {t(`landing.how.steps.${key}.title`)}
                </h3>
                <p className="mt-1 text-muted-foreground">{t(`landing.how.steps.${key}.body`)}</p>
                {consent === 'private' && (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-sm bg-muted px-2 py-1 text-xs font-semibold text-brand">
                    <Lock aria-hidden="true" strokeWidth={2} className="size-3.5" />
                    {t('landing.how.badges.private')}
                  </p>
                )}
                {consent === 'shared' && (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-sm bg-success-bg px-2 py-1 text-xs font-semibold text-success">
                    <Unlock aria-hidden="true" strokeWidth={2} className="size-3.5" />
                    {t('landing.how.badges.shared')}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
