import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, Info } from 'lucide-react';
import { type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const calloutVariants = cva('flex items-start gap-3 rounded-md border px-4 py-3 text-sm', {
  variants: {
    variant: {
      // AA status pairs from SCRUM-31 (5.30:1 and 5.49:1 on their tints).
      info: 'border-info/30 bg-info-bg text-info',
      error: 'border-error/30 bg-error-bg text-error',
    },
  },
  defaultVariants: { variant: 'info' },
});

const icons = { info: Info, error: CircleAlert } as const;

type CalloutProps = ComponentProps<'div'> &
  VariantProps<typeof calloutVariants> & {
    /**
     * Announce on appearance. Use it only for messages that appear WITHOUT a focus move; a callout
     * that receives focus is read when focused, and a live region would read it a second time.
     */
    live?: boolean;
  };

/** Status message. The icon and text carry the meaning; colour never does on its own. */
export function Callout({ variant, live = false, className, children, ...props }: CalloutProps) {
  const Icon = icons[variant ?? 'info'];
  const liveProps = live
    ? variant === 'error'
      ? { role: 'alert' }
      : { role: 'status', 'aria-live': 'polite' as const }
    : {};

  return (
    <div className={cn(calloutVariants({ variant, className }))} {...liveProps} {...props}>
      <Icon aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
