import { Handshake } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/features/auth/auth-context';
import { page } from '@/features/projects/styles';
import { useDirection } from '@/hooks/useDirection';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { type ConnectionItem, useConnectionContact, useConnections } from './api';
import { ListSkeleton, LoadError } from './components/parts';
import { formatDay } from './format';

/**
 * /app/connections (SCRUM-21): the user's active connections. Contact details load only when the
 * user asks, from get_connection_contact(), which checks the party and logs every read.
 */
export function ConnectionsPage() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const list = useConnections(session?.user.id);
  useDocumentTitle(t('connections.list.metaTitle'));

  return (
    <div className={page}>
      <h1 className="auth-title text-brand">{t('connections.list.title')}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t('connections.list.intro')}</p>
      <div className="mt-6">
        {list.isPending ? (
          <ListSkeleton />
        ) : list.isError ? (
          <LoadError retrying={list.isRefetching} onRetry={() => void list.refetch()} />
        ) : list.data.length === 0 ? (
          <EmptyState icon={Handshake} className="max-w-2xl">
            {t('connections.list.empty')}
          </EmptyState>
        ) : (
          <ul aria-label={t('connections.list.title')} className="grid gap-4 md:grid-cols-2">
            {list.data.map((item) => (
              <li key={item.id}>
                <ConnectionCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConnectionCard({ item }: { item: ConnectionItem }) {
  const { t } = useTranslation();
  const { language } = useDirection();
  const [open, setOpen] = useState(false);
  const contact = useConnectionContact(item.id, open);
  const name = item.counterpartName ?? t('connections.list.unknown');
  const headingId = `connection-${item.id}`;

  const row = (term: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-muted-foreground">{term}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
  const notShared = (
    <span className="text-muted-foreground">{t('connections.list.notShared')}</span>
  );

  return (
    <article
      aria-labelledby={headingId}
      className="flex h-full flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} dir="auto" className="text-lg font-bold text-brand">
          {name}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('connections.list.since', { date: formatDay(item.createdAt, language) })}
        </p>
      </div>
      <dl className="flex flex-col gap-3 text-sm">
        {row(
          t('connections.requests.project'),
          item.projectTitle && item.projectId ? (
            <Link
              to={`/projects/${item.projectId}`}
              dir="auto"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {item.projectTitle}
            </Link>
          ) : (
            t('connections.requests.projectGone')
          ),
        )}
      </dl>

      {!open ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => {
            setOpen(true);
          }}
        >
          {t('connections.list.show')}
        </Button>
      ) : contact.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('connections.loading')}
        </p>
      ) : contact.isError ? (
        <Callout variant="error" live>
          <p>{t('connections.list.contactError')}</p>
        </Callout>
      ) : contact.data === null ? (
        <Callout live>
          <p>{t('connections.list.unavailable')}</p>
        </Callout>
      ) : (
        <section aria-label={t('connections.list.contactLabel', { name })}>
          <dl className="flex flex-col gap-3 border-t border-border pt-4 text-sm">
            {row(
              t('connections.list.email'),
              <a
                href={`mailto:${contact.data.email}`}
                dir="ltr"
                className="break-all text-primary underline underline-offset-4"
              >
                {contact.data.email}
              </a>,
            )}
            {row(
              t('connections.list.phone'),
              contact.data.phone ? (
                <a
                  href={`tel:${contact.data.phone}`}
                  dir="ltr"
                  className="text-primary underline underline-offset-4"
                >
                  {contact.data.phone}
                </a>
              ) : (
                notShared
              ),
            )}
            {row(
              t('connections.list.linkedin'),
              contact.data.linkedinUrl ? (
                <a
                  href={contact.data.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="break-all text-primary underline underline-offset-4"
                >
                  {contact.data.linkedinUrl}
                  <span className="sr-only"> {t('legal.opensInNewTab')}</span>
                </a>
              ) : (
                notShared
              ),
            )}
          </dl>
        </section>
      )}
    </article>
  );
}
