import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface StepperProps {
  /** Translated step names, in order. */
  steps: readonly string[];
  /** Zero-based index of the current step. */
  current: number;
  /** Accessible name of the list, e.g. "Profile setup". */
  label: string;
}

/**
 * Numbered progress for a multi-step flow. An ordered list (so screen readers announce the count),
 * aria-current="step" on the current item, and a visually hidden "Step 2 of 4" that the page
 * reads with the step name. Done steps show a check icon and a "completed" label, so status never
 * depends on colour alone. Flex and logical properties mirror it in RTL; numbers stay Latin.
 */
export function Stepper({ steps, current, label }: StepperProps) {
  const { t } = useTranslation();

  return (
    <nav aria-label={label}>
      <p className="sr-only">
        {t('stepper.position', { current: current + 1, total: steps.length })}
      </p>
      <ol className="flex items-start gap-2">
        {steps.map((name, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={name}
              aria-current={active ? 'step' : undefined}
              className="flex min-w-0 flex-1 flex-col gap-2"
            >
              <span
                aria-hidden="true"
                className={cn('h-1 rounded-full', done || active ? 'bg-primary' : 'bg-border')}
              />
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  dir="ltr"
                  className={cn(
                    'inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
                    done && 'border-primary bg-primary text-primary-foreground',
                    active && 'border-2 border-primary text-primary',
                    !done && !active && 'border-border text-muted-foreground',
                  )}
                >
                  {done ? <Check strokeWidth={2.5} className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'hidden truncate text-sm sm:inline',
                    active ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {name}
                </span>
                {/* The name is visible from sm; below that the list still names every step. */}
                <span className="sr-only sm:hidden">{name}</span>
                {done && <span className="sr-only">{t('stepper.completed')}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
