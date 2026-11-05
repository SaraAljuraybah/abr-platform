import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Clock,
  MailWarning,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { VerificationStatus } from '@/features/auth/auth-context';
import { cn } from '@/lib/utils';

const styles: Record<VerificationStatus, { icon: LucideIcon; className: string }> = {
  unverified: { icon: MailWarning, className: 'border-border bg-muted text-foreground' },
  pending: { icon: Clock, className: 'border-info/30 bg-info-bg text-info' },
  verified: { icon: CircleCheck, className: 'border-success/30 bg-success-bg text-success' },
  rejected: { icon: CircleAlert, className: 'border-error/30 bg-error-bg text-error' },
  suspended: { icon: CircleDashed, className: 'border-border bg-muted text-muted-foreground' },
};

/** A verification status as an icon and a label. The label carries the meaning, never the colour. */
export function StatusChip({
  status,
  className,
}: {
  status: VerificationStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  const { icon: Icon, className: tone } = styles[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        tone,
        className,
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
      {t(`status.${status}`)}
    </span>
  );
}
