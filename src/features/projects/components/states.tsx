import { SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { page } from '../styles';

/** Loading: a hidden heading and status for screen readers, skeletons for everyone else. */
export function ProjectSkeleton({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <div className={page}>
      <h1 className="sr-only">{title}</h1>
      <p role="status" className="sr-only">
        {t('projects.loading')}
      </p>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-8 h-96 max-w-3xl" />
    </div>
  );
}

export function ProjectLoadError({
  title,
  retrying,
  onRetry,
}: {
  title: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={page}>
      <h1 className="auth-title text-brand">{title}</h1>
      <Callout variant="error" live className="mt-8 max-w-2xl">
        <p>{t('projects.loadError')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          loading={retrying}
          loadingText={t('projects.retrying')}
          onClick={onRetry}
        >
          {t('projects.retry')}
        </Button>
      </Callout>
    </div>
  );
}

export function ProjectNotFound() {
  const { t } = useTranslation();
  return (
    <div className={page}>
      <h1 className="auth-title text-brand">{t('projects.notFound.title')}</h1>
      <EmptyState
        icon={SearchX}
        className="mt-8 max-w-2xl"
        action={
          <Button asChild variant="outline">
            <Link to="/app">{t('projects.backToDashboard')}</Link>
          </Button>
        }
      >
        {t('projects.notFound.body')}
      </EmptyState>
    </div>
  );
}
