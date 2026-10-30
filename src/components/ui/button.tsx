import { type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { Slot } from 'radix-ui';
import { type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button-variants';

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * Pass it (true or false) on buttons that can load: it disables the button, shows a spinner and
     * sets aria-busy. Not supported with asChild.
     */
    loading?: boolean;
    /** Label while loading. The idle and loading labels share one grid cell, so the width holds. */
    loadingText?: ReactNode;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading,
  loadingText,
  disabled,
  children,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }

  if (loading === undefined) {
    return (
      <button
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled === true || loading}
      aria-busy={loading}
      {...props}
    >
      <span className="inline-grid items-center justify-items-center">
        <span
          className={cn(
            'col-start-1 row-start-1 inline-flex items-center gap-2',
            loading && 'invisible',
          )}
          aria-hidden={loading || undefined}
        >
          {children}
        </span>
        <span
          className={cn(
            'col-start-1 row-start-1 inline-flex items-center gap-2',
            !loading && 'invisible',
          )}
          aria-hidden={!loading || undefined}
        >
          <LoaderCircle
            aria-hidden="true"
            strokeWidth={1.75}
            className="animate-spin motion-reduce:animate-none"
          />
          {loadingText ?? children}
        </span>
      </span>
    </button>
  );
}
