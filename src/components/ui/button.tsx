import { type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { type ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button-variants';

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
