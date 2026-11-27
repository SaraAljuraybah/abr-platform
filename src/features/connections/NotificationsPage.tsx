import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/features/auth/auth-context';
import { page } from '@/features/projects/styles';
import { useDirection } from '@/hooks/useDirection';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/lib/utils';
import { type NotificationItem, useMarkNotificationsRead, useNotifications } from './api';
import { ListSkeleton, LoadError } from './components/parts';
import { formatDay } from './format';

/** Where a notification leads: the received list for the owner, the sent list or connections. */
const target = (item: NotificationItem) =>
  item.type === 'request_accepted' ? '/app/connections' : '/app/requests';

/**
 * /app/notifications (SCRUM-21): the minimal in-app inbox for request received / answered /
 * closed (Plan D-08). Payloads carry a project title and a display name, never contact data.
 */
export function NotificationsPage() {
  const { t } = useTranslation();
  const { language } = useDirection();
  const { session } = useAuth();
  const list = useNotifications(session?.user.id);
  const mark = useMarkNotificationsRead();
  useDocumentTitle(t('connections.notifications.metaTitle'));
  const unread = list.data?.filter((item) => item.readAt === null).length ?? 0;

  const sentence = (item: NotificationItem) =>
    t(`connections.notifications.types.${item.type}`, {
      name: item.counterpartName ?? t('connections.notifications.fallbackName'),
      project: item.projectTitle ?? t('connections.notifications.fallbackProject'),
    });

  return (
    <div className={page}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="auth-title text-brand">{t('connections.notifications.title')}</h1>
        {unread > 0 && (
          <Button
            type="button"
            variant="outline"
            loading={mark.isPending}
            loadingText={t('connections.notifications.marking')}
            onClick={() => {
              mark.mutate(undefined);
            }}
          >
            {t('connections.notifications.markAll')}
          </Button>
        )}
      </div>
      {mark.isError && (
        <Callout variant="error" live className="mt-4 max-w-2xl">
          <p>{t('connections.errors.unexpected')}</p>
        </Callout>
      )}
      <div className="mt-6">
        {list.isPending ? (
          <ListSkeleton />
        ) : list.isError ? (
          <LoadError retrying={list.isRefetching} onRetry={() => void list.refetch()} />
        ) : list.data.length === 0 ? (
          <EmptyState icon={Bell} className="max-w-2xl">
            {t('connections.notifications.empty')}
          </EmptyState>
        ) : (
          <ul
            aria-label={t('connections.notifications.title')}
            className="flex max-w-3xl flex-col divide-y divide-border rounded-lg border border-border bg-card"
          >
            {list.data.map((item) => {
              const isUnread = item.readAt === null;
              return (
                <li key={item.id}>
                  <Link
                    to={target(item)}
                    onClick={() => {
                      if (isUnread) mark.mutate([item.id]);
                    }}
                    className={cn(
                      'flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-accent',
                      isUnread && 'bg-primary/5',
                    )}
                  >
                    <span className="flex items-start gap-2">
                      {isUnread && (
                        <span className="mt-0.5 shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                          {t('connections.notifications.unread')}
                        </span>
                      )}
                      <span
                        dir="auto"
                        className={cn('text-foreground', isUnread && 'font-semibold')}
                      >
                        {sentence(item)}
                      </span>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatDay(item.createdAt, language)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
