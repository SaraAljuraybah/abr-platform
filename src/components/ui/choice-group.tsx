import { Check, CircleAlert } from 'lucide-react';
import { RadioGroup } from 'radix-ui';
import { type ReactNode, type Ref, useId } from 'react';
import { cn } from '@/lib/utils';

interface ChoiceGroupProps {
  label: ReactNode;
  options: readonly { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  /** Already-translated message; joins aria-describedby. */
  error?: ReactNode;
  /** Reading direction, so arrow keys follow it (no app-wide Radix DirectionProvider). */
  dir: 'ltr' | 'rtl';
  name?: string;
  /** 'pills' (default) wraps short options in a row; 'list' stacks longer ones full width. */
  layout?: 'pills' | 'list';
  /** Receives the first option, so form libraries can focus the group on an error. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A single choice as pills (2–4 short options) or a vertical list (longer options). Radix radio group: one tab stop, arrow keys move
 * and select. The selected option shows a check icon (pills) or a filled circle (list) and a thicker
 * border, never colour alone.
 */
export function ChoiceGroup({
  label,
  options,
  value,
  onValueChange,
  error,
  dir,
  name,
  layout = 'pills',
  ref,
}: ChoiceGroupProps) {
  const list = layout === 'list';
  const id = useId();
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <p id={labelId} className="text-sm font-semibold text-foreground">
        {label}
      </p>
      <RadioGroup.Root
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : undefined}
        aria-required="true"
        dir={dir}
        orientation={list ? 'vertical' : undefined}
        name={name}
        value={value}
        onValueChange={onValueChange}
        // Radix's hidden inputs are shifted by translateX(-100%), which widens RTL pages.
        className={cn(
          'relative flex gap-2 [&>input]:[transform:none]!',
          list ? 'flex-col' : 'flex-wrap',
        )}
      >
        {options.map((option, index) => (
          <RadioGroup.Item
            key={option.value}
            value={option.value}
            ref={index === 0 ? ref : undefined}
            className={cn(
              'min-h-11 items-center gap-2 rounded-md border border-muted-foreground/80 bg-card px-4 text-sm font-medium text-foreground transition-colors',
              list
                ? 'group flex w-full py-2.5 text-start data-[state=checked]:py-[9px]'
                : 'inline-flex',
              'hover:bg-accent',
              'data-[state=checked]:border-2 data-[state=checked]:border-primary data-[state=checked]:bg-secondary data-[state=checked]:px-[15px]',
              error && 'border-error',
            )}
          >
            {list ? (
              // A radio circle, filled when chosen (shape, not only colour).
              <span
                aria-hidden="true"
                className="flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground group-data-[state=checked]:border-primary"
              >
                <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
              </span>
            ) : (
              <RadioGroup.Indicator asChild>
                <Check aria-hidden="true" strokeWidth={2} className="size-4 text-primary" />
              </RadioGroup.Indicator>
            )}
            <span dir="auto">{option.label}</span>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-error">
          <CircleAlert aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
