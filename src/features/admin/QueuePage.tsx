import { Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/ui/empty-state';
import { formatLegalDate } from '@/features/legal/format';
import { useOptionLabels } from '@/features/projects/components/labels';
import { ProjectImage } from '@/features/projects/components/ProjectImage';
import { ProjectStatusChip } from '@/features/projects/components/ProjectStatusChip';
import type { ProjectStatus } from '@/features/projects/options';
import { useDirection } from '@/hooks/useDirection';
import { cn } from '@/lib/utils';
import { useReviewQueue } from './api';
import { AdminLoadError, AdminLoading } from './components/states';

/** The queue first, then the other outcomes for reference. */
const QUEUE_FILTERS = [
  'pending_review',
  'changes_requested',
  'published',
  'rejected',
] as const satisfies readonly ProjectStatus[];
type QueueFilter = (typeof QUEUE_FILTERS)[number];

const isFilter = (value: string | null): value is QueueFilter =>
  (QUEUE_FILTERS as readonly (string | null)[]).includes(value);

/** /admin/projects: projects awaiting review, oldest first; a filter shows the other statuses. */
export function QueuePage() {
  const { t } = useTranslation();
  const { language } = useDirection();
  const labels = useOptionLabels();
  const [params] = useSearchParams();
  const raw = params.get('status');
  const status: QueueFilter = isFilter(raw) ? raw : 'pending_review';
  const queue = useReviewQueue(status, language);
  const date = (iso: string) => formatLegalDate(iso.slice(0, 10), language);

  return (
    <>
      <h1 className="auth-title text-brand">{t('admin.queue.title')}</h1>
      <nav aria-label={t('admin.queue.filterLabel')} className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {QUEUE_FILTERS.map((filter) => {
            const current = filter === status;
            return (
              <li key={filter}>
                <Link
                  to={
                    filter === 'pending_review'
                      ? '/admin/projects'
                      : `/admin/projects?status=${filter}`
                  }
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors',
                    current
                      ? 'border-2 border-primary bg-primary/10 font-semibold text-foreground'
                      : 'border-border bg-card text-foreground hover:border-primary/60',
                  )}
                >
                  {t(`projectStatus.${filter}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6">
        {queue.isPending ? (
          <AdminLoading />
        ) : queue.isError ? (
          <AdminLoadError retrying={queue.isRefetching} onRetry={() => void queue.refetch()} />
        ) : queue.data.length === 0 ? (
          <EmptyState icon={Inbox} className="max-w-2xl">
            {status === 'pending_review' ? t('admin.queue.emptyPending') : t('admin.queue.empty')}
          </EmptyState>
        ) : (
          <ul aria-label={t(`projectStatus.${status}`)} className="flex flex-col gap-3">
            {queue.data.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center"
              >
                <ProjectImage project={item} />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/admin/projects/${item.id}`}
                    dir="auto"
                    className="rounded-sm font-semibold break-words text-primary underline-offset-4 hover:underline"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span dir="auto">{item.studentName ?? t('admin.queue.unknownStudent')}</span>
                    {' · '}
                    <span dir="auto">{item.universityName ?? '—'}</span>
                    {' · '}
                    {item.track ? labels.track(item.track) : t('admin.queue.noTrack')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end">
                  <ProjectStatusChip status={item.status} />
                  <p className="text-sm text-muted-foreground">
                    {item.status === 'pending_review' && item.submittedAt
                      ? t('admin.queue.submitted', { date: date(item.submittedAt) })
                      : t('admin.queue.updated', { date: date(item.updatedAt) })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
