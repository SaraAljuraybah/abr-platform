import { BadgeCheck, ClipboardCheck, Lock, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from './SectionHeader';

const ITEMS = [
  { key: 'students', icon: BadgeCheck },
  { key: 'projects', icon: ClipboardCheck },
  { key: 'organizations', icon: ShieldCheck },
  { key: 'privacy', icon: Lock },
] as const;

/** Flat Surface background; the items are white cards (1 / 2 / 4 columns). */
export function TrustPrivacy() {
  const { t } = useTranslation();

  return (
    <section
      id="trust"
      aria-labelledby="trust-title"
      className="scroll-mt-20 bg-muted py-10 lg:py-16"
    >
      <div className="container-page">
        <SectionHeader section="trust" titleId="trust-title" align="center" />
        <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {ITEMS.map(({ key, icon: Icon }) => (
            <li key={key} className="rounded-lg bg-card p-6 shadow-sm">
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-md bg-muted text-primary"
              >
                <Icon className="size-5" strokeWidth={1.75} />
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
