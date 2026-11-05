import { Check, CircleAlert, Plus, X } from 'lucide-react';
import { type KeyboardEvent, type Ref, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface ChipInputProps {
  label: string;
  hint?: string;
  value: readonly string[];
  onChange: (next: string[]) => void;
  /** Most chips allowed; the input is disabled once reached. */
  max: number;
  /** Longest chip; the input's maxLength. */
  maxLength: number;
  /** Offered as "add" buttons until picked. */
  suggestions?: readonly string[];
  /** Already-translated message; joins aria-describedby. */
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

const sameChip = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/**
 * Free-text chips: type and press Enter (or pick a suggestion). Duplicates are ignored regardless
 * of case. Every chip has a remove button named "Remove <chip>"; after a removal, focus returns to
 * the input. Additions and removals are announced in a polite live region.
 */
export function ChipInput({
  label,
  hint,
  value,
  onChange,
  max,
  maxLength,
  suggestions = [],
  error,
  ref,
}: ChipInputProps) {
  const { t } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const full = value.length >= max;
  const describedBy = [`${id}-hint`, error ? `${id}-error` : null].filter(Boolean).join(' ');

  const add = (raw: string) => {
    const chip = raw.trim().replace(/\s+/g, ' ').slice(0, maxLength);
    if (!chip || full || value.some((existing) => sameChip(existing, chip))) return false;
    onChange([...value, chip]);
    setAnnouncement(t('chips.added', { chip }));
    return true;
  };

  const remove = (chip: string) => {
    onChange(value.filter((existing) => existing !== chip));
    setAnnouncement(t('chips.removed', { chip }));
    document.getElementById(`${id}-input`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    // Enter adds a chip and never submits the step.
    event.preventDefault();
    if (add(draft)) setDraft('');
  };

  const open = suggestions.filter((s) => !value.some((existing) => sameChip(existing, s)));

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-input`} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {hint ? `${hint} ` : ''}
        {t('chips.count', { count: value.length, max })}
      </p>

      {value.length > 0 && (
        <ul aria-label={label} className="flex flex-wrap gap-2">
          {value.map((chip) => (
            <li
              key={chip}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 py-1 ps-3 pe-1 text-sm text-foreground"
            >
              <span dir="auto">{chip}</span>
              <button
                type="button"
                aria-label={t('chips.remove', { chip })}
                onClick={() => {
                  remove(chip);
                }}
                className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/15 hover:text-foreground"
              >
                <X aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={ref}
        id={`${id}-input`}
        type="text"
        value={draft}
        maxLength={maxLength}
        disabled={full}
        autoComplete="off"
        enterKeyHint="enter"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        placeholder={full ? t('chips.full') : t('chips.placeholder')}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={onKeyDown}
        className={cn(
          'h-11 w-full rounded-md border border-muted-foreground/80 bg-card px-3 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground',
          'focus-visible:border-brand-accent disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-error',
        )}
      />
      {error && (
        <div id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-error">
          <CircleAlert aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">{error}</div>
        </div>
      )}

      {open.length > 0 && !full && (
        <div className="mt-1 flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground">{t('chips.suggestions')}</p>
          <ul className="flex flex-wrap gap-2">
            {open.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  aria-label={t('chips.add', { chip: suggestion })}
                  onClick={() => {
                    add(suggestion);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm text-foreground hover:border-primary/60"
                >
                  <Plus aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
                  <span dir="ltr">{suggestion}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

interface ToggleChipsProps {
  label: string;
  hint?: string;
  options: readonly { value: string; label: string }[];
  value: readonly string[];
  onChange: (next: string[]) => void;
}

/**
 * Multiple choice from a fixed list as toggle buttons (aria-pressed). Selected chips show a check
 * and a filled style, never colour alone. Kept in list order, whatever the click order.
 */
export function ToggleChips({ label, hint, options, value, onChange }: ToggleChipsProps) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-1.5">
      <p id={`${id}-label`} className="text-sm font-semibold text-foreground">
        {label}
      </p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => {
          const pressed = value.includes(option.value);
          return (
            <li key={option.value}>
              <button
                type="button"
                aria-pressed={pressed}
                onClick={() => {
                  const next = pressed
                    ? value.filter((v) => v !== option.value)
                    : [...value, option.value];
                  onChange(options.map((o) => o.value).filter((v) => next.includes(v)));
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                  pressed
                    ? 'border-2 border-primary bg-primary/10 font-semibold text-foreground'
                    : 'border-border bg-card text-foreground hover:border-primary/60',
                )}
              >
                {pressed && (
                  <Check aria-hidden="true" strokeWidth={2} className="size-3.5 text-primary" />
                )}
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
