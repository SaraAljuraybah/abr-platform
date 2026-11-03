import { cn } from '@/lib/utils';

/**
 * Vector logo (a redraw pending approval, D-13). Transparent, so it sits on any light surface.
 * Never mirrored, recoloured or stretched, including in RTL. 44 px tall renders about 119 px
 * wide, above the 96 px minimum digital width.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/brand/abr-logo.svg"
      alt="ABR"
      width={428}
      height={158}
      className={cn('h-11 w-auto max-w-none shrink-0', className)}
    />
  );
}
