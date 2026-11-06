import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { linkClass } from '@/features/forms/styles';
import type en from '@/locales/en.json';
import { LEGAL_CONTACT_EMAIL, showsTodos } from './format';

/** Shared building blocks of /privacy and /terms: one readable column, logical spacing for RTL. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 flex flex-col gap-3">
      <h2 className="text-2xl">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 ps-6 marker:text-primary">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function ContactEmail() {
  return (
    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} dir="ltr" className={linkClass}>
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}

type Todo =
  | { ns: 'privacy'; todo: keyof typeof en.privacy.todo }
  | { ns: 'terms'; todo: keyof typeof en.terms.todo };

/**
 * An open point on a legal page, visible only in development builds. Production builds render
 * nothing; the same points are listed in the CHANGELOG under "Before public launch".
 */
export function DevTodo({ ns, todo }: Todo) {
  const { t } = useTranslation();
  if (!showsTodos()) return null;
  return (
    <p
      data-todo={todo}
      className="my-3 rounded-sm border border-dashed border-warning bg-warning-bg px-3 py-2 text-sm font-medium text-warning"
    >
      <strong>{t(`${ns}.todoLabel`)}</strong> {t(`${ns}.todo.${todo}` as never)}
    </p>
  );
}
