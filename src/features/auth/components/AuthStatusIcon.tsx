import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The round icon above the title on the check-email and confirmation screens. Decorative. */
export function AuthStatusIcon({
  icon: Icon,
  className,
  iconClassName,
}: {
  icon: LucideIcon;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn(
        'mb-5 inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary',
        className,
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className={cn('size-6', iconClassName)} />
    </span>
  );
}
