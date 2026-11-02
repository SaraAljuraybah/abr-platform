import { ChevronDown, CircleAlert } from 'lucide-react';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { cn } from '@/lib/utils';

type SelectFieldProps = Omit<ComponentProps<'select'>, 'id'> & {
  label: ReactNode;
  hint?: ReactNode;
  /** Already-translated message. Sets aria-invalid and joins aria-describedby. */
  error?: ReactNode;
};

/** Native select with TextField's label, hint and error layout. */
export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...props
}: SelectFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {hint && (
        <div id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </div>
      )}
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            'h-11 w-full appearance-none rounded-md border border-muted-foreground/80 bg-card ps-3 pe-10 text-base text-foreground shadow-sm transition-colors',
            'focus-visible:border-brand-accent disabled:cursor-not-allowed disabled:opacity-50',
            'aria-invalid:border-error',
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-muted-foreground"
        />
      </div>
      {error && (
        <div id={errorId} className="flex items-start gap-1.5 text-sm text-error">
          <CircleAlert aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">{error}</div>
        </div>
      )}
    </div>
  );
}
