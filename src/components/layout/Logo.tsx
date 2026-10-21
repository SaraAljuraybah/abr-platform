import { cn } from '@/lib/utils';

/**
 * Approved raster logo (D-13). Swap to /brand/abr-logo.svg once the vector is supplied.
 * Never mirrored, recoloured or stretched, including in RTL. 44 px tall keeps it above
 * the 96 px minimum digital width.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/brand/abr-logo.png"
      alt="ABR"
      width={470}
      height={200}
      className={cn('h-11 w-auto', className)}
    />
  );
}
