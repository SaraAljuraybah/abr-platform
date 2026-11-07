import { ArrowLeft, ArrowRight, SearchX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Callout } from '@/components/ui/callout';
import { EmptyState } from '@/components/ui/empty-state';
import { formatLegalDate } from '@/features/legal/format';
import { ProjectDetails } from '@/features/projects/components/ProjectDetails';
import { ProjectStatusChip } from '@/features/projects/components/ProjectStatusChip';
import { useDirection } from '@/hooks/useDirection';
import { useReviewHistory, useReviewProject } from './api';
import { DecisionPanel } from './components/DecisionPanel';
import { AdminLoadError, AdminLoading } from './components/states';

function BackLink() {
  const { t } = useTranslation();
  const { direction } = useDirection();
  const Arrow = direction === 'rtl' ? ArrowRight : ArrowLeft;
  return (
    <Link
      to="/admin/projects"
      className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-primary underline-offset-4 hover:underline"
    >
      <Arrow aria-hidden="true" strokeWidth={1.75} className="size-4" />
      {t('admin.review.back')}
    </Link>
  );
}

function History({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { language } = useDirection();
  const history = useReviewHistory(projectId);
  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3">
      <h2 id="history-title" className="text-lg font-bold text-brand">
        {t('admin.review.historyTitle')}
      </h2>
      {history.isPending ? (
        <AdminLoading />
      ) : history.isError ? (
        <AdminLoadError retrying={history.isRefetching} onRetry={() => void history.refetch()} />
      ) : history.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.review.historyEmpty')}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {history.data.map((entry) => (
            <li key={entry.id} className="rounded-md border border-border bg-card p-4">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-foreground">
                  {t(`admin.review.decision.${entry.decision}`)}
                </span>
                <span className="text-muted-foreground">
                  · {formatLegalDate(entry.createdAt.slice(0, 10), language)}
                  {entry.reviewerName && (
                    <>
                      {' · '}
                      <span dir="auto">{t('admin.review.by', { name: entry.reviewerName })}</span>
                    </>
                  )}
                </span>
              </p>
              {entry.notes && (
                <p dir="auto" className="mt-2 text-sm whitespace-pre-line text-foreground">
                  {entry.notes}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * /admin/projects/:id: everything the student entered, the review history and, while the project
 * is pending review, the decision panel. review_project() re-checks the status under a row lock.
 */
export function ReviewPage() {
  const { t } = useTranslation();
  const { language } = useDirection();
  const { id = '' } = useParams();
  const project = useReviewProject(id, language);
  const [notPending, setNotPending] = useState(false);

  if (project.isPending) {
    return (
      <>
        <h1 className="sr-only">{t('admin.review.title')}</h1>
        <AdminLoading />
      </>
    );
  }
  if (project.isError) {
    return (
      <>
        <h1 className="auth-title text-brand">{t('admin.review.title')}</h1>
        <div className="mt-6">
          <AdminLoadError retrying={project.isRefetching} onRetry={() => void project.refetch()} />
        </div>
      </>
    );
  }
  if (!project.data) {
    return (
      <>
        <h1 className="auth-title text-brand">{t('projects.notFound.title')}</h1>
        <EmptyState icon={SearchX} className="mt-6 max-w-2xl" action={<BackLink />}>
          {t('admin.review.notFound')}
        </EmptyState>
      </>
    );
  }

  const p = project.data;
  const pending = p.status === 'pending_review' && !notPending;

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 dir="auto" className="auth-title text-brand">
            {p.title}
          </h1>
          <ProjectStatusChip status={p.status} />
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1">
            <dt className="text-muted-foreground">{t('admin.review.student')}:</dt>
            <dd dir="auto" className="text-foreground">
              {p.studentName ?? t('admin.queue.unknownStudent')}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-muted-foreground">{t('admin.review.university')}:</dt>
            <dd dir="auto" className="text-foreground">
              {p.universityName ?? '—'}
            </dd>
          </div>
          {p.submittedAt && (
            <div className="flex gap-1">
              <dt className="text-muted-foreground">{t('admin.review.submitted')}:</dt>
              <dd className="text-foreground">
                {formatLegalDate(p.submittedAt.slice(0, 10), language)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {pending ? (
        <DecisionPanel
          projectId={p.id}
          onNotPending={() => {
            setNotPending(true);
            void project.refetch();
          }}
        />
      ) : (
        <Callout live={notPending} className="max-w-3xl">
          <p>{t('admin.review.notPending')}</p>
        </Callout>
      )}

      <ProjectDetails project={p} />
      <History projectId={p.id} />
    </div>
  );
}
