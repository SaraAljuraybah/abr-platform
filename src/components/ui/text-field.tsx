import { CircleAlert } from 'lucide-react';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { cn } from '@/lib/utils';

export type TextFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
  label: ReactNode;
  hint?: ReactNode;
  /** Already-translated message. Sets aria-invalid and joins aria-describedby. */
  error?: ReactNode;
  /** Content inside the input's end edge (e.g. the password toggle). Reserve room with inputClassName. */
  endAdornment?: ReactNode;
  inputClassName?: string;
};

export function TextField({
  label,
  hint,
  error,
  endAdornment,
  className,
  inputClassName,
  ...props
}: TextFieldProps) {
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
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            // Border at 80% of the secondary text colour keeps the field edge above 3:1 (WCAG 1.4.11).
            'h-11 w-full rounded-md border border-muted-foreground/80 bg-card px-3 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground',
            'focus-visible:border-brand-accent disabled:cursor-not-allowed disabled:opacity-50',
            'aria-invalid:border-error',
            inputClassName,
          )}
          {...props}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 end-0 flex items-center pe-1">{endAdornment}</div>
        )}
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-error">
          <CircleAlert aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
