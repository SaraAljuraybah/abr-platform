import { CircleCheck } from 'lucide-react';
import { RadioGroup } from 'radix-ui';
import { type ComponentProps, type ComponentType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A radio group drawn as cards (Radix: arrow keys move and select, one tab stop). Name the group
 * with aria-labelledby. The selected card shows a check icon and a thicker border, never colour
 * alone.
 */
export function RadioCardGroup({ className, ...props }: ComponentProps<typeof RadioGroup.Root>) {
  return (
    <RadioGroup.Root
      // Inside a form Radix adds hidden native inputs shifted by translateX(-100%); in RTL that
      // shift widens the page (horizontal scroll at 360 px). Keep them inside the group.
      className={cn('relative grid gap-3 [&>input]:[transform:none]!', className)}
      {...props}
    />
  );
}

type RadioCardProps = Omit<ComponentProps<typeof RadioGroup.Item>, 'children'> & {
  title: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;
};

export function RadioCard({ title, description, icon: Icon, className, ...props }: RadioCardProps) {
  return (
    <RadioGroup.Item
      className={cn(
        'group flex w-full items-center gap-3 rounded-md border border-muted-foreground/80 bg-card p-3 text-start transition-colors',
        'hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-2 data-[state=checked]:border-primary data-[state=checked]:bg-secondary data-[state=checked]:p-[11px]',
        className,
      )}
      {...props}
    >
      {Icon && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
          <Icon aria-hidden={true} strokeWidth={1.75} className="size-5" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-foreground">{title}</span>
        {description && <span className="text-sm text-muted-foreground">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/80 group-data-[state=checked]:border-0"
      >
        <RadioGroup.Indicator asChild>
          <CircleCheck strokeWidth={1.75} className="size-5 text-primary" />
        </RadioGroup.Indicator>
      </span>
    </RadioGroup.Item>
  );
}
