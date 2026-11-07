import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Skeleton } from '@/components/ui/skeleton';

/** Loading: a status for screen readers, skeletons for everyone else. */
export function AdminLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        {t('admin.loading')}
      </p>
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}

export function AdminLoadError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Callout variant="error" live className="max-w-2xl">
      <p>{t('admin.loadError')}</p>
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
  );
}
