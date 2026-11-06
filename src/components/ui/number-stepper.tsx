import { CircleAlert, Minus, Plus } from 'lucide-react';
import { type ReactNode, type Ref, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface NumberStepperProps {
  label: string;
  hint?: ReactNode;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  /** Already-translated message; joins aria-describedby. */
  error?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

const stepButton =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-muted-foreground/80 bg-card text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50';

/**
 * A whole number between min and max: a number input (type a value, or use the arrow keys) between
 * "decrease" and "increase" buttons. Typed values are clamped on blur; the buttons stop at the
 * limits and say so by being disabled.
 */
export function NumberStepper({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  error,
  ref,
}: NumberStepperProps) {
  const { t } = useTranslation();
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)));
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={stepButton}
          aria-label={t('numberStepper.decrease', { label })}
          disabled={value <= min}
          onClick={() => {
            onChange(clamp(value - 1));
          }}
        >
          <Minus aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </button>
        <input
          ref={ref}
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={Number.isFinite(value) ? value : ''}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => {
            const next = event.target.valueAsNumber;
            if (Number.isFinite(next)) onChange(next);
          }}
          onBlur={() => {
            onChange(clamp(Number.isFinite(value) ? value : min));
          }}
          className={cn(
            'h-11 w-20 rounded-md border border-muted-foreground/80 bg-card px-3 text-center text-base text-foreground shadow-sm',
            'focus-visible:border-brand-accent aria-invalid:border-error',
          )}
        />
        <button
          type="button"
          className={stepButton}
          aria-label={t('numberStepper.increase', { label })}
          disabled={value >= max}
          onClick={() => {
            onChange(clamp(value + 1));
          }}
        >
          <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </button>
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
