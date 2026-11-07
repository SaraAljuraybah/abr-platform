import { initials, initialsFromEmail } from '@/lib/initials';
import { cn } from '@/lib/utils';

/**
 * Initials in a circle. Decorative: the name next to it (or the button's name) says who it is.
 * With no name, the email's initials ("ops.team@…" → "OT"); with neither, "?".
 */
export function Avatar({
  name,
  email,
  className,
}: {
  name: string | null | undefined;
  email?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground',
        className,
      )}
    >
      {name?.trim() ? initials(name) : initialsFromEmail(email)}
    </span>
  );
}
