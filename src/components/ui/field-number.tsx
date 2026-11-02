import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Two Latin digits in both languages; dir="ltr" keeps them in order inside RTL text. */
const twoDigits = (n: number) => String(n).padStart(2, '0');

/**
 * A field label with its number badge. The number is decorative (aria-hidden): the label alone is
 * the accessible name.
 */
export function NumberedLabel({ n, children }: { n: number; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        dir="ltr"
        className="inline-flex h-6 min-w-8 items-center justify-center rounded-sm bg-secondary px-1.5 text-xs font-semibold text-secondary-foreground tabular-nums"
      >
        {twoDigits(n)}
      </span>
      {children}
    </span>
  );
}

/** "01—04": decorative; pass the spoken equivalent as srLabel. */
export function FieldProgress({
  total,
  srLabel,
  className,
}: {
  total: number;
  srLabel: string;
  className?: string;
}) {
  return (
    <p className={cn('text-sm font-semibold text-muted-foreground', className)}>
      <span aria-hidden="true" dir="ltr" className="tabular-nums">
        {twoDigits(1)}—{twoDigits(total)}
      </span>
      <span className="sr-only">{srLabel}</span>
    </p>
  );
}

/** "12/120" under a length-limited field. Decorative: the input's maxLength enforces the limit. */
export function CharacterCount({ value, max }: { value: number; max: number }) {
  return (
    <p aria-hidden="true" className="text-end text-xs text-muted-foreground">
      <span dir="ltr" className="tabular-nums">
        {value}/{max}
      </span>
    </p>
  );
}
