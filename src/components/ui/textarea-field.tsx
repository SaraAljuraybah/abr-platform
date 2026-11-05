import { CircleAlert } from 'lucide-react';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { cn } from '@/lib/utils';

type TextareaFieldProps = Omit<ComponentProps<'textarea'>, 'id'> & {
  label: ReactNode;
  hint?: ReactNode;
  /** Already-translated message. Sets aria-invalid and joins aria-describedby. */
  error?: ReactNode;
  /** Below the field (e.g. a character count); joins aria-describedby. */
  details?: ReactNode;
};

/** Multi-line text with TextField's label, hint and error layout. */
export function TextareaField({
  label,
  hint,
  error,
  details,
  className,
  rows = 4,
  ...props
}: TextareaFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const detailsId = `${id}-details`;
  const describedBy = [hint ? hintId : null, error ? errorId : null, details ? detailsId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'w-full resize-y rounded-md border border-muted-foreground/80 bg-card px-3 py-2.5 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground',
          'focus-visible:border-brand-accent disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-error',
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-error">
          <CircleAlert aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      {details && <div id={detailsId}>{details}</div>}
    </div>
  );
}
