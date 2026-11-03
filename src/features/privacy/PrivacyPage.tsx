import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { linkClass } from '@/features/forms/styles';
import { useDirection } from '@/hooks/useDirection';
import { DevTodo } from './DevTodo';
import { PRIVACY_LAST_UPDATED } from './notice';

const CONTACT_EMAIL = 'try0abr@gmail.com';

const ACCOUNT = [
  'identity',
  'password',
  'university',
  'organization',
  'profile',
  'verification',
  'universityRequest',
] as const;
const INTEREST = ['identity', 'answers', 'heardFrom', 'consent'] as const;
const SECURITY = ['log', 'rateLimit'] as const;
const WHY = ['account', 'discover', 'contact', 'secure'] as const;
const VISIBILITY = ['public', 'profile', 'contact', 'interest'] as const;
const PROCESSORS = ['supabase', 'vercel', 'email'] as const;
const RETENTION = ['interest', 'accounts', 'security', 'rateLimit'] as const;
const RIGHTS = ['know', 'access', 'correct', 'delete', 'withdraw'] as const;

/** "Last updated" in the reader's language, Gregorian with Latin digits in both. */
function formatDate(iso: string, language: 'en' | 'ar'): string {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 flex flex-col gap-3">
      <h2 className="text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 ps-6 marker:text-primary">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * /privacy: the privacy notice for what this platform actually stores (migrations and forms as of
 * the date below). One h1, a readable column, logical spacing so it mirrors in RTL.
 */
export function PrivacyPage() {
  const { t } = useTranslation();
  const { language } = useDirection();
  const email = (
    <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className={linkClass}>
      {CONTACT_EMAIL}
    </a>
  );

  return (
    <div className="container-page py-12 lg:py-16">
      <article className="mx-auto max-w-[720px] leading-relaxed text-foreground">
        <p className="eyebrow text-pink-text">{t('privacy.eyebrow')}</p>
        <h1 className="mt-2 text-brand">{t('privacy.title')}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t('privacy.updated', { date: formatDate(PRIVACY_LAST_UPDATED, language) })}
        </p>
        <DevTodo todo="legalReview" />

        <Section title={t('privacy.responsible.title')}>
          <p>
            <Trans i18nKey="privacy.responsible.body" components={{ email }} />
          </p>
          <DevTodo todo="legalName" />
          <p>{t('privacy.responsible.age')}</p>
          <DevTodo todo="minors" />
        </Section>

        <Section title={t('privacy.collect.title')}>
          <h3 className="mt-2 text-lg">{t('privacy.collect.account.title')}</h3>
          <List items={ACCOUNT.map((key) => t(`privacy.collect.account.items.${key}`))} />
          <h3 className="mt-4 text-lg">{t('privacy.collect.interest.title')}</h3>
          <List items={INTEREST.map((key) => t(`privacy.collect.interest.items.${key}`))} />
          <h3 className="mt-4 text-lg">{t('privacy.collect.contact.title')}</h3>
          <p>{t('privacy.collect.contact.body')}</p>
          <h3 className="mt-4 text-lg">{t('privacy.collect.security.title')}</h3>
          <List items={SECURITY.map((key) => t(`privacy.collect.security.items.${key}`))} />
        </Section>

        <Section title={t('privacy.why.title')}>
          <List items={WHY.map((key) => t(`privacy.why.items.${key}`))} />
          <p>{t('privacy.why.basis')}</p>
        </Section>

        <Section title={t('privacy.visibility.title')}>
          <List items={VISIBILITY.map((key) => t(`privacy.visibility.items.${key}`))} />
        </Section>

        <Section title={t('privacy.processors.title')}>
          <List items={PROCESSORS.map((key) => t(`privacy.processors.items.${key}`))} />
          <p>{t('privacy.processors.transfer')}</p>
        </Section>

        <Section title={t('privacy.browser.title')}>
          <p>{t('privacy.browser.body')}</p>
        </Section>

        <Section title={t('privacy.retention.title')}>
          <List items={RETENTION.map((key) => t(`privacy.retention.items.${key}`))} />
          <DevTodo todo="securityRetention" />
        </Section>

        <Section title={t('privacy.rights.title')}>
          <p>{t('privacy.rights.intro')}</p>
          <List items={RIGHTS.map((key) => t(`privacy.rights.items.${key}`))} />
          <p>
            <Trans i18nKey="privacy.rights.how" components={{ email }} />
          </p>
          <DevTodo todo="replyTime" />
          <p>{t('privacy.rights.complaint')}</p>
        </Section>

        <Section title={t('privacy.changes.title')}>
          <p>{t('privacy.changes.body')}</p>
        </Section>
      </article>
    </div>
  );
}
