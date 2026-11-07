import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PROJECT_STATUSES } from '@/features/projects/options';
import { useDirection } from '@/hooks/useDirection';
import { cn } from '@/lib/utils';
import { useInterestStats, useProjectCounts } from './api';
import { AdminLoadError, AdminLoading } from './components/states';

/** /admin: projects per status (pending review first and highlighted) and interest sign-ups. */
export function OverviewPage() {
  const { t } = useTranslation();
  const { direction } = useDirection();
  const counts = useProjectCounts();
  const interest = useInterestStats();
  const Arrow = direction === 'rtl' ? ArrowLeft : ArrowRight;
  const number = (value: number) => new Intl.NumberFormat('en').format(value);

  const order = [
    'pending_review',
    ...PROJECT_STATUSES.filter((s) => s !== 'pending_review'),
  ] as const;
  const signUps = interest.data
    ?.filter((row) => row.dimension === 'role')
    .reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <h1 className="auth-title text-brand">{t('admin.overview.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('admin.overview.intro')}</p>

      <section aria-labelledby="overview-projects" className="mt-8">
        <h2 id="overview-projects" className="text-lg font-bold text-brand">
          {t('admin.overview.projects')}
        </h2>
        {counts.isPending ? (
          <div className="mt-4">
            <AdminLoading />
          </div>
        ) : counts.isError ? (
          <div className="mt-4">
            <AdminLoadError retrying={counts.isRefetching} onRetry={() => void counts.refetch()} />
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {order.map((status) => {
              const pending = status === 'pending_review';
              return (
                <li
                  key={status}
                  className={cn(
                    'flex flex-col gap-2 rounded-lg border bg-card p-5 shadow-sm',
                    pending ? 'border-2 border-primary' : 'border-border',
                  )}
                >
                  <p className="text-sm font-semibold text-muted-foreground">
                    {t(`projectStatus.${status}`)}
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {number(counts.data[status])}
                  </p>
                  {status !== 'draft' && (
                    <Link
                      to={pending ? '/admin/projects' : `/admin/projects?status=${status}`}
                      className="mt-auto inline-flex items-center gap-1 self-start rounded-sm text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {pending ? t('admin.overview.reviewNow') : t('admin.overview.view')}
                      <span className="sr-only">: {t(`projectStatus.${status}`)}</span>
                      <Arrow aria-hidden="true" strokeWidth={1.75} className="size-4" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="overview-interest" className="mt-10">
        <h2 id="overview-interest" className="text-lg font-bold text-brand">
          {t('admin.overview.interestTitle')}
        </h2>
        {interest.isPending ? (
          <div className="mt-4">
            <AdminLoading />
          </div>
        ) : interest.isError ? (
          <div className="mt-4">
            <AdminLoadError
              retrying={interest.isRefetching}
              onRetry={() => void interest.refetch()}
            />
          </div>
        ) : (
          <div className="mt-4 flex max-w-sm flex-col gap-2 rounded-lg border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold text-muted-foreground">
              {t('admin.interest.total')}
            </p>
            <p className="text-3xl font-bold text-foreground">{number(signUps ?? 0)}</p>
            <Link
              to="/admin/interest"
              className="inline-flex items-center gap-1 self-start rounded-sm text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t('admin.overview.interestCta')}
              <Arrow aria-hidden="true" strokeWidth={1.75} className="size-4" />
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
