import { Trans, useTranslation } from 'react-i18next';
import { formatLegalDate } from '@/features/legal/format';
import {
  ContactEmail,
  DevTodo,
  LegalList as List,
  LegalSection as Section,
} from '@/features/legal/parts';
import { useDirection } from '@/hooks/useDirection';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { TERMS_LAST_UPDATED } from './terms';

const ELIGIBILITY = ['age', 'students', 'others'] as const;
const ACCOUNT = ['accurate', 'one', 'password'] as const;
const USE = [
  'falseInfo',
  'scraping',
  'contactDetails',
  'harassment',
  'content',
  'security',
] as const;
const PROJECTS = ['ownership', 'licence', 'noRights'] as const;
const CONNECTIONS = ['private', 'purpose'] as const;
const SUSPENSION = ['suspend', 'close'] as const;
const LIABILITY = ['asIs', 'endorsement', 'limit'] as const;

/**
 * /terms: the Terms and Conditions (draft pending legal review; the open points show only in
 * development builds). Same layout as /privacy. Its version for sign-up consent is TERMS_VERSION
 * (src/features/legal/versions.ts).
 */
export function TermsPage() {
  const { t } = useTranslation();
  const { language } = useDirection();
  useDocumentTitle(t('terms.metaTitle'));
  const list = (group: string, keys: readonly string[]) =>
    keys.map((key) => t(`terms.${group}.items.${key}` as never));

  return (
    <div className="container-page py-12 lg:py-16">
      <article className="mx-auto max-w-[720px] leading-relaxed text-foreground">
        <p className="eyebrow text-pink-text">{t('terms.eyebrow')}</p>
        <h1 className="mt-2 text-brand">{t('terms.title')}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t('terms.updated', { date: formatLegalDate(TERMS_LAST_UPDATED, language) })}
        </p>
        <DevTodo ns="terms" todo="legalReview" />
        <p className="mt-6">{t('terms.intro')}</p>

        <Section title={t('terms.who.title')}>
          <p>{t('terms.who.body')}</p>
          <DevTodo ns="terms" todo="legalName" />
        </Section>

        <Section title={t('terms.eligibility.title')}>
          <List items={list('eligibility', ELIGIBILITY)} />
          <DevTodo ns="terms" todo="age" />
        </Section>

        <Section title={t('terms.account.title')}>
          <List items={list('account', ACCOUNT)} />
        </Section>

        <Section title={t('terms.use.title')}>
          <p>{t('terms.use.intro')}</p>
          <List items={list('use', USE)} />
        </Section>

        <Section title={t('terms.projects.title')}>
          <List items={list('projects', PROJECTS)} />
          <DevTodo ns="terms" todo="universityIp" />
          <DevTodo ns="terms" todo="licence" />
        </Section>

        <Section title={t('terms.connections.title')}>
          <List items={list('connections', CONNECTIONS)} />
        </Section>

        <Section title={t('terms.suspension.title')}>
          <List items={list('suspension', SUSPENSION)} />
        </Section>

        <Section title={t('terms.liability.title')}>
          <List items={list('liability', LIABILITY)} />
          <DevTodo ns="terms" todo="liability" />
        </Section>

        <Section title={t('terms.changes.title')}>
          <p>{t('terms.changes.body')}</p>
          <DevTodo ns="terms" todo="changesNotice" />
        </Section>

        <Section title={t('terms.law.title')}>
          <p>{t('terms.law.body')}</p>
          <DevTodo ns="terms" todo="law" />
        </Section>

        <Section title={t('terms.contact.title')}>
          <p>
            <Trans i18nKey="terms.contact.body" components={{ email: <ContactEmail /> }} />
          </p>
        </Section>
      </article>
    </div>
  );
}
