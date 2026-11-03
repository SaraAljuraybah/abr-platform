import { type ReactNode } from 'react';

/** Two Latin digits in both languages; dir="ltr" keeps them in order inside RTL text. */
const twoDigits = (n: number) => String(n).padStart(2, '0');

/**
 * A field label with its number badge. The number is decorative (aria-hidden): the label alone is
 * the accessible name.
 */
export function NumberedLabel({ n, children }: { n: number; children: ReactNode }) {
  return (
    <span data-numbered-label="" className="flex items-center gap-2">
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
