import { useTranslation } from 'react-i18next';
import { CheckboxField } from '@/components/ui/checkbox-group';
import { SelectField } from '@/components/ui/select-field';
import { useUniversities } from '@/features/auth/api';
import { useOptionLabels } from '@/features/projects/components/labels';
import { NEEDS, SECTORS, STAGES, TRACKS } from '@/features/projects/options';
import { useDirection } from '@/hooks/useDirection';
import { cn } from '@/lib/utils';
import type { DirectoryFilters } from '../search-params';

/** Several codes as compact toggle chips: native checkboxes in a fieldset ("any of"). */
function ChipChoices({
  legend,
  options,
  selected,
  onChange,
}: {
  legend: string;
  options: readonly { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold text-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                'inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-muted-foreground/60 bg-card px-3 text-sm text-foreground transition-colors hover:bg-accent',
                'has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
              )}
            >
              <input
                type="checkbox"
                value={option.value}
                checked={checked}
                onChange={() => {
                  onChange(
                    checked
                      ? selected.filter((value) => value !== option.value)
                      : [...selected, option.value],
                  );
                }}
                className="size-4 shrink-0 cursor-pointer accent-primary outline-none"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Every directory filter. Each change applies at once (the URL updates and the list reloads); the
 * same fields sit in the panel on wide screens and in the Filters dialog on small ones.
 */
export function FilterFields({
  filters,
  onChange,
  className,
}: {
  filters: DirectoryFilters;
  onChange: (next: DirectoryFilters) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const { language } = useDirection();
  const labels = useOptionLabels();
  const universities = useUniversities(language);
  const set = (patch: Partial<DirectoryFilters>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label={t('explore.filter.track')}
          value={filters.track ?? ''}
          onChange={(event) => {
            set({ track: event.target.value || null });
          }}
        >
          <option value="">{t('explore.filter.allTracks')}</option>
          {TRACKS.map((code) => (
            <option key={code} value={code}>
              {labels.track(code)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('explore.filter.stage')}
          value={filters.stage ?? ''}
          onChange={(event) => {
            set({ stage: event.target.value || null });
          }}
        >
          <option value="">{t('explore.filter.allStages')}</option>
          {STAGES.map((code) => (
            <option key={code} value={code}>
              {labels.stage(code)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('explore.filter.university')}
          value={filters.university ?? ''}
          onChange={(event) => {
            set({ university: event.target.value || null });
          }}
        >
          <option value="">{t('explore.filter.allUniversities')}</option>
          {(universities.data ?? []).map((university) => (
            <option key={university.id} value={university.id}>
              {university.name}
            </option>
          ))}
        </SelectField>
      </div>
      <ChipChoices
        legend={t('explore.filter.sectors')}
        options={SECTORS.map((code) => ({ value: code, label: labels.sector(code) }))}
        selected={filters.sectors}
        onChange={(sectors) => {
          set({ sectors: SECTORS.filter((code) => sectors.includes(code)) });
        }}
      />
      <ChipChoices
        legend={t('explore.filter.needs')}
        options={NEEDS.map((code) => ({ value: code, label: labels.need(code) }))}
        selected={filters.needs}
        onChange={(needs) => {
          set({ needs: NEEDS.filter((code) => needs.includes(code)) });
        }}
      />
      <CheckboxField
        label={t('explore.filter.lookingForMembers')}
        checked={filters.lookingForMembers}
        onChange={(event) => {
          set({ lookingForMembers: event.target.checked });
        }}
      />
    </div>
  );
}
