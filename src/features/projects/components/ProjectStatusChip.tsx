import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  EyeOff,
  PencilLine,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { ProjectStatus } from '../options';

const styles: Record<ProjectStatus, { icon: LucideIcon; className: string }> = {
  draft: { icon: PencilLine, className: 'border-border bg-muted text-foreground' },
  pending_review: { icon: Clock, className: 'border-info/30 bg-info-bg text-info' },
  changes_requested: { icon: CircleAlert, className: 'border-error/30 bg-error-bg text-error' },
  published: { icon: CircleCheck, className: 'border-success/30 bg-success-bg text-success' },
  rejected: { icon: CircleX, className: 'border-error/30 bg-error-bg text-error' },
  unpublished: { icon: EyeOff, className: 'border-border bg-muted text-muted-foreground' },
};

/** A project status as an icon and a label, like StatusChip. The label carries the meaning. */
export function ProjectStatusChip({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  const { icon: Icon, className: tone } = styles[status];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        tone,
        className,
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
      {t(`projectStatus.${status}`)}
    </span>
  );
}
