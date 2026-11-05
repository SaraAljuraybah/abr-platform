import { initials } from '@/lib/initials';
import { cn } from '@/lib/utils';

/** Initials in a circle. Decorative: the name next to it (or the button's name) says who it is. */
export function Avatar({
  name,
  className,
}: {
  name: string | null | undefined;
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
      {initials(name)}
    </span>
  );
}
