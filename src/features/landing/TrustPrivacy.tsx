import { BadgeCheck, ClipboardCheck, Lock, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from './SectionHeader';

const ITEMS = [
  { key: 'students', icon: BadgeCheck },
  { key: 'projects', icon: ClipboardCheck },
  { key: 'organizations', icon: ShieldCheck },
  { key: 'privacy', icon: Lock },
] as const;

/** Flat Surface background on purpose: the hero is the page's only gradient. */
export function TrustPrivacy() {
  const { t } = useTranslation();

  return (
    <section
      id="trust"
      aria-labelledby="trust-title"
      className="scroll-mt-20 bg-muted py-10 lg:py-16"
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <SectionHeader section="trust" titleId="trust-title" />
        <ul className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ key, icon: Icon }) => (
            <li key={key}>
              <span
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-full bg-card text-primary shadow-sm"
              >
                <Icon className="size-6" strokeWidth={1.75} />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-brand">
                {t(`landing.trust.items.${key}.title`)}
              </h3>
              <p className="mt-1 text-muted-foreground">{t(`landing.trust.items.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
