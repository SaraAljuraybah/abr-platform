import { cn } from '@/lib/utils';

/** A grey placeholder block. Pulses only without prefers-reduced-motion; always aria-hidden. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block rounded-md bg-muted motion-safe:animate-pulse', className)}
    />
  );
}
