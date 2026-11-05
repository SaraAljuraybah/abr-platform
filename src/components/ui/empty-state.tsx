import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A dashed panel for "nothing here yet": icon, one line of text and an optional action. */
export function EmptyState({
  icon: Icon,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-8 text-center',
        className,
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-8 text-muted-foreground" />
      <p className="text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}
