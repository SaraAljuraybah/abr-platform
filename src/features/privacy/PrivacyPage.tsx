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
import { PRIVACY_LAST_UPDATED } from './notice';

const ACCOUNT = [
  'identity',
  'password',
  'university',
  'organization',
  'profile',
  'verification',
  'consent',
  'universityRequest',
] as const;
const INTEREST = ['identity', 'answers', 'heardFrom', 'consent'] as const;
const SECURITY = ['log', 'rateLimit'] as const;
const WHY = ['account', 'discover', 'contact', 'secure'] as const;
const VISIBILITY = ['public', 'profile', 'contact', 'interest'] as const;
const PROCESSORS = ['supabase', 'vercel', 'email'] as const;
const RETENTION = ['interest', 'accounts', 'security', 'rateLimit'] as const;
const RIGHTS = ['know', 'access', 'correct', 'delete', 'withdraw'] as const;

/**
 * /privacy: the Privacy Policy for what this platform actually stores (migrations and forms as of
 * the date below). One h1, a readable column, logical spacing so it mirrors in RTL. Its version
 * for sign-up consent is PRIVACY_VERSION (src/features/legal/versions.ts).
 */
export function PrivacyPage() {
  const { t } = useTranslation();
  const { language } = useDirection();
  useDocumentTitle(t('privacy.metaTitle'));
  const email = <ContactEmail />;

  return (
    <div className="container-page py-12 lg:py-16">
      <article className="mx-auto max-w-[720px] leading-relaxed text-foreground">
        <p className="eyebrow text-pink-text">{t('privacy.eyebrow')}</p>
        <h1 className="mt-2 text-brand">{t('privacy.title')}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t('privacy.updated', { date: formatLegalDate(PRIVACY_LAST_UPDATED, language) })}
        </p>
        <DevTodo ns="privacy" todo="legalReview" />

        <Section title={t('privacy.responsible.title')}>
          <p>
            <Trans i18nKey="privacy.responsible.body" components={{ email }} />
          </p>
          <DevTodo ns="privacy" todo="legalName" />
          <p>{t('privacy.responsible.age')}</p>
          <DevTodo ns="privacy" todo="minors" />
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
          <DevTodo ns="privacy" todo="securityRetention" />
        </Section>

        <Section title={t('privacy.rights.title')}>
          <p>{t('privacy.rights.intro')}</p>
          <List items={RIGHTS.map((key) => t(`privacy.rights.items.${key}`))} />
          <p>
            <Trans i18nKey="privacy.rights.how" components={{ email }} />
          </p>
          <DevTodo ns="privacy" todo="replyTime" />
          <p>{t('privacy.rights.complaint')}</p>
        </Section>

        <Section title={t('privacy.changes.title')}>
          <p>{t('privacy.changes.body')}</p>
        </Section>
      </article>
    </div>
  );
}
