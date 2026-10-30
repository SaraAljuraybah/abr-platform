import { cva } from 'class-variance-authority';

// Kept apart from button.tsx so the component file exports only components (react-refresh).
// A busy (loading) button stays at full opacity: its "Signing in…" label must remain AA-readable.
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 aria-busy:opacity-100 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-action-hover active:bg-action-pressed',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        outline: 'border border-border bg-card text-brand hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'text-brand hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        // On the hero gradient only (white reverse, Brand Guidelines p. 8). White focus ring:
        // the accent ring would not reach 3:1 against the dark purple.
        inverse:
          'bg-white text-brand hover:bg-muted focus-visible:outline-white active:bg-light-pink',
        outlineInverse:
          'border border-white bg-transparent text-white hover:bg-white/10 focus-visible:outline-white active:bg-white/15',
      },
      size: {
        default: 'h-10 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-11 px-6 has-[>svg]:px-4',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
