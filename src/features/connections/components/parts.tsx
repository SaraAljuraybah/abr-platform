import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  Clock,
  type LucideIcon,
  Undo2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { RequestStatus } from '../api';

const styles: Record<RequestStatus, { icon: LucideIcon; className: string }> = {
  pending: { icon: Clock, className: 'border-info/30 bg-info-bg text-info' },
  accepted: { icon: CircleCheck, className: 'border-success/30 bg-success-bg text-success' },
  declined: { icon: CircleAlert, className: 'border-error/30 bg-error-bg text-error' },
  withdrawn: { icon: Undo2, className: 'border-border bg-muted text-muted-foreground' },
  cancelled: { icon: CircleSlash, className: 'border-border bg-muted text-muted-foreground' },
  expired: { icon: CircleDashed, className: 'border-border bg-muted text-muted-foreground' },
};

/** A request status as an icon and a label; the label carries the meaning, never the colour. */
export function RequestStatusChip({ status }: { status: RequestStatus }) {
  const { t } = useTranslation();
  const { icon: Icon, className } = styles[status];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        className,
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
      {t(`connections.status.${status}`)}
    </span>
  );
}

export function ListSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{t('connections.loading')}</span>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function LoadError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Callout variant="error" live>
        <p>{t('connections.loadError')}</p>
      </Callout>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        loading={retrying}
        loadingText={t('connections.retrying')}
        onClick={onRetry}
      >
        {t('connections.retry')}
      </Button>
    </div>
  );
}
