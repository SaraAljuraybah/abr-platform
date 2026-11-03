import { CircleAlert } from 'lucide-react';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { cn } from '@/lib/utils';

const boxClass =
  'mt-0.5 size-5 shrink-0 cursor-pointer rounded-sm border-muted-foreground/80 accent-primary';

interface CheckboxGroupProps {
  legend: ReactNode;
  options: readonly { value: string; label: string }[];
  /** Already-translated message; joins the group's aria-describedby. */
  error?: ReactNode;
  /** Spread onto every checkbox (e.g. react-hook-form register(name)): values form an array. */
  inputProps: Omit<ComponentProps<'input'>, 'type' | 'value' | 'id'>;
}

/** Native checkboxes in a fieldset: several answers to one question. */
export function CheckboxGroup({ legend, options, error, inputProps }: CheckboxGroupProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold text-foreground">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-muted-foreground/80 bg-card px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent',
            'has-checked:border-primary has-checked:bg-secondary',
            error && 'border-error',
          )}
        >
          <input
            type="checkbox"
            value={option.value}
            aria-invalid={error ? true : undefined}
            className={boxClass}
            {...inputProps}
          />
          <span>{option.label}</span>
        </label>
      ))}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-error">
          <CircleAlert aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </fieldset>
  );
}

interface CheckboxFieldProps extends Omit<ComponentProps<'input'>, 'type' | 'id'> {
  label: ReactNode;
  error?: ReactNode;
}

/** One checkbox with its label (e.g. consent). */
export function CheckboxField({ label, error, className, ...props }: CheckboxFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={boxClass}
          {...props}
        />
        <label htmlFor={id} className="text-sm text-foreground">
          {label}
        </label>
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
