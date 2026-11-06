import { type ReactNode, useId } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CheckboxField } from '@/components/ui/checkbox-group';
import { ToggleChips } from '@/components/ui/chip-input';
import { ChoiceGroup } from '@/components/ui/choice-group';
import { CharacterCount } from '@/components/ui/field-number';
import { NumberStepper } from '@/components/ui/number-stepper';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { TextareaField } from '@/components/ui/textarea-field';
import { useDirection } from '@/hooks/useDirection';
import { cn } from '@/lib/utils';
import { validationMessage } from '@/lib/zod-i18n';
import {
  ACADEMIC_YEARS,
  NEEDS,
  PROJECT_LIMITS as L,
  SECTORS,
  SPECIALIZATIONS,
  STAGES,
  TRACKS,
} from '../options';
import type { ProjectValues } from '../schemas';
import { panel } from '../styles';
import { useOptionLabels } from './labels';

type Form = UseFormReturn<ProjectValues>;

function useFieldError(form: Form) {
  const { t } = useTranslation();
  return (name: keyof ProjectValues) => {
    const error = form.formState.errors[name];
    const message = Array.isArray(error) ? undefined : error?.message;
    return validationMessage(t, message);
  };
}

/** One titled part of the edit page; the h2 names the region. */
export function EditorSection({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn(panel, 'flex flex-col gap-6')}>
      <div>
        <h2 id={id} className="text-lg font-bold text-brand">
          {title}
        </h2>
        {intro && <p className="mt-1 text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

export function BasicsSection({ form }: { form: Form }) {
  const { t } = useTranslation();
  const labels = useOptionLabels();
  const fieldError = useFieldError(form);
  const sectorsHintId = useId();
  const sectorsErrorId = useId();
  const [title, summary, description, sectors] = useWatch({
    control: form.control,
    name: ['title', 'summary', 'description', 'sectors'],
  });
  const atSectorLimit = sectors.length >= L.sectors.max;

  return (
    <EditorSection id="section-basics" title={t('projects.sections.basics')}>
      <TextField
        label={t('projects.fields.title')}
        maxLength={L.title.max}
        autoComplete="off"
        error={fieldError('title')}
        details={<CharacterCount value={title.length} max={L.title.max} />}
        {...form.register('title')}
      />
      <TextareaField
        label={t('projects.fields.summary')}
        hint={t('projects.fields.summaryHint')}
        rows={3}
        maxLength={L.summary.max}
        error={fieldError('summary')}
        details={<CharacterCount value={summary.length} max={L.summary.max} />}
        {...form.register('summary')}
      />
      <TextareaField
        label={t('projects.fields.description')}
        hint={t('projects.fields.descriptionHint')}
        rows={8}
        maxLength={L.description.max}
        error={fieldError('description')}
        details={<CharacterCount value={description.length} max={L.description.max} />}
        {...form.register('description')}
      />
      <SelectField
        label={t('projects.fields.track')}
        error={fieldError('track')}
        {...form.register('track')}
      >
        <option value="">{t('projects.fields.trackPlaceholder')}</option>
        {TRACKS.map((code) => (
          <option key={code} value={code}>
            {labels.track(code)}
          </option>
        ))}
      </SelectField>

      <fieldset
        aria-describedby={
          form.formState.errors.sectors ? `${sectorsHintId} ${sectorsErrorId}` : sectorsHintId
        }
        className="flex flex-col gap-2"
      >
        <legend className="mb-1.5 text-sm font-semibold text-foreground">
          {t('projects.fields.sectors')}
        </legend>
        <p id={sectorsHintId} className="text-sm text-muted-foreground">
          {t('projects.fields.sectorsHint', { max: L.sectors.max })}
        </p>
        <div className="flex flex-wrap gap-2">
          {SECTORS.map((code) => (
            <label
              key={code}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-muted-foreground/80 bg-card px-4 text-sm text-foreground transition-colors hover:bg-accent',
                'has-checked:border-primary has-checked:bg-secondary',
                'has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:bg-card',
              )}
            >
              <input
                type="checkbox"
                value={code}
                disabled={atSectorLimit && !sectors.includes(code)}
                className="size-4 shrink-0 accent-primary"
                {...form.register('sectors')}
              />
              {labels.sector(code)}
            </label>
          ))}
        </div>
        {form.formState.errors.sectors && (
          <p id={sectorsErrorId} className="text-sm text-error">
            {fieldError('sectors')}
          </p>
        )}
      </fieldset>

      <SelectField
        label={t('projects.fields.academicYear')}
        hint={t('projects.fields.academicYearHint')}
        error={fieldError('academicYear')}
        {...form.register('academicYear')}
      >
        <option value="">{t('projects.fields.academicYearPlaceholder')}</option>
        {ACADEMIC_YEARS.map((code) => (
          <option key={code} value={code}>
            {labels.year(code)}
          </option>
        ))}
      </SelectField>
    </EditorSection>
  );
}

export function StageTeamSection({ form }: { form: Form }) {
  const { t } = useTranslation();
  const { direction } = useDirection();
  const labels = useOptionLabels();
  const fieldError = useFieldError(form);
  const lookingForMembers = useWatch({ control: form.control, name: 'lookingForMembers' });
  const looking = form.register('lookingForMembers');

  return (
    <EditorSection id="section-stage-team" title={t('projects.sections.stageTeam')}>
      <Controller
        control={form.control}
        name="stage"
        render={({ field }) => (
          <ChoiceGroup
            ref={field.ref}
            label={t('projects.fields.stage')}
            layout="list"
            required={false}
            dir={direction}
            options={STAGES.map((code) => ({ value: code, label: labels.stage(code) }))}
            value={field.value}
            onValueChange={field.onChange}
            error={fieldError('stage')}
          />
        )}
      />
      <Controller
        control={form.control}
        name="teamSize"
        render={({ field }) => (
          <NumberStepper
            ref={field.ref}
            label={t('projects.fields.teamSize')}
            hint={t('projects.fields.teamSizeHint')}
            min={L.teamSize.min}
            max={L.teamSize.max}
            value={field.value}
            onChange={field.onChange}
            error={fieldError('teamSize')}
          />
        )}
      />
      <CheckboxField
        label={t('projects.fields.lookingForMembers')}
        {...looking}
        onChange={(event) => {
          void looking.onChange(event);
          // Unticking clears the specializations (the CHECK refuses them otherwise).
          if (!event.target.checked) {
            form.setValue('wantedSpecializations', [], { shouldDirty: true });
          }
        }}
      />
      {lookingForMembers && (
        <Controller
          control={form.control}
          name="wantedSpecializations"
          render={({ field }) => (
            <ToggleChips
              label={t('projects.fields.wantedSpecializations')}
              hint={t('projects.fields.wantedSpecializationsHint', {
                max: L.wantedSpecializations.max,
              })}
              options={SPECIALIZATIONS.map((code) => ({
                value: code,
                label: labels.specialization(code),
              }))}
              value={field.value}
              onChange={(next) => {
                field.onChange(next.slice(0, L.wantedSpecializations.max));
              }}
            />
          )}
        />
      )}
    </EditorSection>
  );
}

export function NeedsSection({ form }: { form: Form }) {
  const { t } = useTranslation();
  const labels = useOptionLabels();
  return (
    <EditorSection id="section-needs" title={t('projects.sections.needs')}>
      <Controller
        control={form.control}
        name="needs"
        render={({ field }) => (
          <ToggleChips
            label={t('projects.fields.needs')}
            hint={t('projects.fields.needsHint')}
            options={NEEDS.map((code) => ({ value: code, label: labels.need(code) }))}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </EditorSection>
  );
}

export function LinksSection({ form }: { form: Form }) {
  const { t } = useTranslation();
  const fieldError = useFieldError(form);
  const link = (name: 'videoUrl' | 'repoUrl' | 'demoUrl', placeholder: string) => (
    <TextField
      label={t(`projects.fields.${name}`)}
      hint={t(`projects.fields.${name}Hint`)}
      type="url"
      inputMode="url"
      autoComplete="url"
      spellCheck={false}
      dir="ltr"
      maxLength={L.url.max}
      placeholder={placeholder}
      error={fieldError(name)}
      {...form.register(name)}
    />
  );
  return (
    <EditorSection id="section-links" title={t('projects.sections.links')}>
      {link('videoUrl', 'https://www.youtube.com/watch?v=…')}
      {link('repoUrl', 'https://github.com/team/project')}
      {link('demoUrl', 'https://')}
    </EditorSection>
  );
}
